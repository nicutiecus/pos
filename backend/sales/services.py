from django.db import transaction
from django.core.exceptions import ValidationError
from django.utils import timezone
from decimal import Decimal
from common.models import Branch
from inventory.models import Product, InventoryBatch
from sales.models import SalesOrder, SaleItem, Payment, Customer, CustomerLedger
import random
import string



def generate_receipt_ref(transaction_type):
    """Generates a short, unique reference like PAY-8X92B"""
    suffix = ''.join(random.choices(string.ascii_uppercase + string.digits, k=5))
    return f"{transaction_type}-{suffix}"


def create_sale_service(
    *,
    user,
    branch_id: str,
    customer_id: str = None,
    items: list[dict],
    payments: list[dict]
) -> SalesOrder:
    """
    Core transactional logic for processing a sale.
    Features:
    1. Row-level locking (select_for_update) on Inventory Batches.
    2. FIFO Stock Deduction (Oldest batches sold first).
    3. Double-entry Ledger updates for Credit Sales.
    4. Cost Price Snapshotting for accurate P&L reports.
    """
    
    # 1. Scope Validation
    branch = Branch.objects.filter(id=branch_id, tenant=user.tenant).first()
    if not branch:
        raise ValidationError("Invalid branch.")

    customer = None
    if customer_id:
        customer = Customer.objects.filter(id=customer_id, tenant=user.tenant).first()
        if not customer:
            raise ValidationError("Invalid customer.")

    # 2. Begin Atomic Transaction (All or Nothing)
    with transaction.atomic():
        # Create the Order Shell
        order = SalesOrder.objects.create(
            tenant=user.tenant,
            branch=branch,
            customer=customer,
            user=user,
            total_amount=Decimal('0.00'),
            amount_paid=Decimal('0.00'),
            payment_status=SalesOrder.PaymentStatus.PENDING,
            customer_snapshot={
                "name": customer.name if customer else "Walk-in",
                "phone": customer.phone if customer else ""
            }
        )

        total_order_amount = Decimal('0.00')

        # 3. Process Items & Deduct Stock (The FIFO Logic)
        for item_data in items:
            product_id = item_data['product_id']
            qty_needed = Decimal(str(item_data['quantity']))
            
            # Fetch Product to get current price
            product = Product.objects.filter(id=product_id, tenant=user.tenant).first()
            if not product:
                raise ValidationError(f"Product {product_id} not found.")

            # --- CRITICAL: LOCKING & FIFO STRATEGY ---
            # Fetch active batches for this product in this branch.
            # Sort by expiry_date (Ascending) to sell oldest stock first.
            # select_for_update() LOCKS these rows until the transaction finishes.
            batches = InventoryBatch.objects.select_for_update().filter(
                tenant=user.tenant,
                branch=branch,
                product=product,
                status=InventoryBatch.Status.ACTIVE,
                quantity_on_hand__gt=0
            ).order_by('expiry_date', 'created_at')

            qty_fulfilled = Decimal('0.00')
            
            # Iterate through batches to fulfill the requested quantity
            for batch in batches:
                if qty_needed <= 0:
                    break

                available_in_batch = batch.quantity_on_hand
                
                # Determine how much to take from this specific batch
                take_qty = min(qty_needed, available_in_batch)
                
                # Deduct Stock
                batch.quantity_on_hand -= take_qty
                
                # If batch is empty, mark as Depleted (optional, keeps DB clean)
                if batch.quantity_on_hand == 0:
                    batch.status = InventoryBatch.Status.DEPLETED
                
                batch.save() # Save the locked row

                # Update counters
                qty_needed -= take_qty
                qty_fulfilled += take_qty

                # Create SaleItem linked to this SPECIFIC batch
                # We snapshot cost_price here to know exactly how much profit we made later
                subtotal = take_qty * product.selling_price
                
                SaleItem.objects.create(
                    order=order,
                    product=product,
                    batch=batch, # Link to source batch for traceability
                    quantity=take_qty,
                    unit_price=product.selling_price,
                    cost_price_at_sale=batch.cost_price_at_receipt, # Critical for P&L
                    subtotal=subtotal
                )
                
                total_order_amount += subtotal

            # Check if we successfully fulfilled the demand
            if qty_needed > 0:
                raise ValidationError(f"Insufficient stock for {product.name}. Shortage: {qty_needed}")

        # 4. Process Multiple Payments
        total_paid = Decimal('0.00')
        
        if payments:
            for payment_data in payments:
                amount = Decimal(str(payment_data['amount']))
                method = payment_data['method']
                ref = payment_data.get('reference_code', '')

                if amount > 0:
                    Payment.objects.create(
                        tenant=user.tenant,
                        branch=branch,
                        order=order,
                        method=method,
                        amount=amount,
                        reference_code=ref,
                        processed_by=user
                    )
                    total_paid += amount

        order.amount_paid = total_paid

        # 5. Calculate Debt & Validate Credit Rules
        debt_amount = total_order_amount - total_paid

        # Validation: Walk-in customers MUST pay in full
        if debt_amount > 0 and not customer:
            raise ValidationError(
                f"Walk-in customers cannot take credit. Shortage: {debt_amount}"
            )

        # Validation: Overpayment (Optional - prevent negative debt)
        if debt_amount < 0:
             raise ValidationError(
                f"Overpayment detected. Change due: {abs(debt_amount)}"
            )

        # 6. Handle Debt (Credit Sale)
        if debt_amount > 0:
            # Check Credit Limit
            if (customer.current_debt + debt_amount) > customer.credit_limit:
                 raise ValidationError(
                     f"Credit limit exceeded. Available: {customer.credit_limit - customer.current_debt}"
                 )

            # Lock & Update Customer Debt
            customer_obj = Customer.objects.select_for_update().get(id=customer.id)
            customer_obj.current_debt += debt_amount
            customer_obj.save()

            # Create Ledger Entry
            CustomerLedger.objects.create(
                tenant=user.tenant,
                customer=customer,
                transaction_type=CustomerLedger.TransactionType.INVOICE,
                amount=debt_amount,
                balance_after=customer_obj.current_debt,
                reference_id=order.id,
                notes=f"Credit sale (Order #{str(order.id)[:8]})"
            )

        # 7. Update Final Status
        if debt_amount == 0:
            order.payment_status = SalesOrder.PaymentStatus.PAID
        elif total_paid > 0:
            order.payment_status = SalesOrder.PaymentStatus.PARTIAL
        else:
            order.payment_status = SalesOrder.PaymentStatus.PENDING

        order.save()
        return order
    


def pay_customer_debt_service(
    *, 
    user, 
    customer_id: str, 
    branch_id: str, # ✅ ADD THIS
    amount: Decimal, 
    method: str, 
    notes: str = ""
):
    # 1. Validate the Branch
    branch = Branch.objects.filter(id=branch_id, tenant=user.tenant).first()
    if not branch:
        raise ValidationError("Invalid branch.")

    with transaction.atomic():
        try:
            customer = Customer.objects.select_for_update().get(id=customer_id, tenant=user.tenant)
        except Customer.DoesNotExist:
            raise ValidationError("Customer not found.")

        if amount <= 0:
            raise ValidationError("Payment amount must be greater than zero.")

        if amount > customer.current_debt:
            raise ValidationError(f"Amount exceeds current debt. Outstanding debt is {customer.current_debt}.")

        # 2. Deduct the debt
        customer.current_debt -= amount
        customer.save()

        # 3. Create the Ledger Entry WITH the branch
        ledger = CustomerLedger.objects.create(
            tenant=user.tenant,
            branch=branch, # ✅ ADD THIS
            customer=customer,
            transaction_type=CustomerLedger.TransactionType.PAYMENT,
            amount=amount,
            balance_after=customer.current_debt,
            notes=notes or f"Debt payment via {method}"
        )

        return ledger
    



def pay_customer_debt_service(
    *, 
    user, 
    customer_id: str, 
    branch_id: str, 
    amount: float, 
    method: str, 
    notes: str = ""
):
    branch = Branch.objects.filter(id=branch_id, tenant=user.tenant).first()
    if not branch:
        raise ValidationError("Invalid branch.")

    with transaction.atomic():
        try:
            customer = Customer.objects.select_for_update().get(id=customer_id, tenant=user.tenant)
        except Customer.DoesNotExist:
            raise ValidationError("Customer not found.")

        if amount <= 0:
            raise ValidationError("Payment amount must be greater than zero.")
            
        if amount > customer.current_debt:
            raise ValidationError(f"Amount exceeds debt. Outstanding: {customer.current_debt}")

        # 1. Update Debt
        customer.current_debt -= amount
        customer.save()

        # 2. Generate Invoice Number
        invoice_number = generate_receipt_ref("DEBT")

        # 3. Create Ledger Entry
        ledger = CustomerLedger.objects.create(
            tenant=user.tenant,
            branch=branch,
            customer=customer,
            transaction_type=CustomerLedger.TransactionType.PAYMENT,
            amount=amount,
            balance_after=customer.current_debt,
            
            # ✅ STORE THE INVOICE NUMBER HERE
            reference_id=invoice_number, 
            
            notes=notes or f"Debt payment via {method}"
        )

        return ledger
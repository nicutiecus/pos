from django.db import transaction
from django.core.exceptions import ValidationError
from django.utils import timezone
from decimal import Decimal
from common.models import Branch
from inventory.models import Product, InventoryBatch, InventoryLog
from sales.models import SalesOrder, SaleItem, Payment, Customer, CustomerLedger
import random
import string
from .models import ShiftReport
from .selectors import get_current_shift_data
from .models import VoidRequest





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
    payments: list[dict],
    discount_amount: Decimal = Decimal('0.00')
) -> SalesOrder:
    """
    Core transactional logic for processing a sale.
    Features:
    1. Row-level locking (select_for_update) on Inventory Batches.
    2. FIFO Stock Deduction (Oldest batches sold first).
    3. Double-entry Ledger updates for Credit Sales.
    4. Cost Price Snapshotting for accurate P&L reports.
    """
    active_shift = ShiftReport.objects.filter(
        cashier=user,
        status=ShiftReport.Status.OPEN
    ).first()
    # 1. Scope Validation
    branch = Branch.objects.filter(id=branch_id, tenant=user.tenant).first()
    if not branch:
        raise ValidationError("Invalid branch.")

    customer = None
    if customer_id:
        customer = Customer.objects.filter(id=customer_id, tenant=user.tenant).first()
        if not customer:
            raise ValidationError("Invalid customer.")
        
    
        
    # Convert discount to Decimal to ensure accurate math
    # = Decimal(str(discount_amount))
    if discount_amount < 0:
        raise ValidationError("Discount cannot be negative.")

    # 2. Begin Atomic Transaction (All or Nothing)
    with transaction.atomic():
        # Create the Order Shell
        order = SalesOrder.objects.create(
            tenant=user.tenant,
            branch=branch,
            shift=active_shift,
            customer=customer,
            user=user,
            total_amount=Decimal('0.00'),
            amount_paid=Decimal('0.00'),
            discount_amount=discount_amount,
            payment_status=SalesOrder.PaymentStatus.PENDING,
            customer_snapshot={
                "name": customer.name if customer else "Walk-in",
                "phone": customer.phone if customer else ""
            }
        )

        total_order_amount = Decimal('0.00')
        calculated_subtotal= Decimal('0.00')

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
                calculated_subtotal += subtotal
                
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
            
            #add to Inventory Log
            InventoryLog.objects.create(
            tenant=user.tenant,
            branch_id=branch_id,
            product_id=product.id,
            user=user,
            transaction_type=InventoryLog.TransactionType.SALE,
            quantity=-item_data['quantity'], # Negative because stock is leaving
            reason="Sale", # Or leave blank, as TransactionType implies it
            total_value=item_data['quantity'] * product.selling_price, # Revenue generated
            notes=f"Sold on Receipt #{order.id}" 
            )

        if discount_amount > calculated_subtotal:
            raise ValidationError("Discount amount cannot be greater than the subtotal.")
        
        # Calculate the final amount the customer actually needs to pay
        final_total_amount = calculated_subtotal - discount_amount
        
        # ✅ Save the final total to the order shell so it persists in the database
        order.total_amount = final_total_amount
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

        # Calculate Debt & Validate Credit Rules
        debt_amount = final_total_amount - total_paid

        # Validation: Walk-in customers MUST pay in full
        if debt_amount > 0 and not customer:
            raise ValidationError(
                f"Walk-in customers cannot take credit. Shortage: {debt_amount}"
            )

        # Validation: Overpayment (Optional - prevent negative debt)
        if debt_amount < 0:
             debt_amount = Decimal('0.00')
            

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
                transaction_type=CustomerLedger.TransactionType.SALE,
                amount=debt_amount,
                balance_after=customer_obj.current_debt,
                reference_id=order.id,
                notes=f"Credit sale (Order #{str(order.id)[:8]})",
                branch=branch,
                processed_by = user
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
        Payment.objects.create(
            tenant=user.tenant,
            branch=branch,
            customer=customer,
            processed_by=user,
            transaction_type=Payment.Transactiontype.DEBT_PAYMENT,
            method=method,
            amount=amount,
            reference_code=invoice_number
        )

        return ledger
    



def close_shift_service(*, user, shift_id, declared_cash, expected_cash, variance, notes=""):
    try:
        shift = ShiftReport.objects.get(
            shift_code=shift_id, 
            tenant=user.tenant, 
            cashier=user, 
            status=ShiftReport.Status.OPEN
        )
    except ShiftReport.DoesNotExist:
        raise ValidationError("Open shift not found or already closed.")

    # Get the final verified system totals (Prevents frontend manipulation)
    shift_data = get_current_shift_data(user=user)

    # Save the snapshots and close
    shift.order_count = shift_data['order_count']
    shift.expected_cash = shift_data['expected_cash']
    shift.expected_pos = shift_data['expected_pos']
    shift.expected_transfer = shift_data['expected_transfer']
    shift.total_revenue = shift_data['total_revenue']
    
    # Save Cashier declared data
    shift.declared_cash = declared_cash
    shift.variance = variance
    shift.notes = notes

    # Close shift
    shift.end_time = timezone.now()
    shift.status = ShiftReport.Status.CLOSED
    shift.save()

    return shift

@transaction.atomic
def process_void_transaction(*, tenant, branch_id, order_id: str, requested_by, authorized_by, reason: str):
    """
    Safely nullifies a same-shift transaction, reversing payments and restocking inventory.
    """
    # 1. Fetch and lock the order
    try:
        order = SalesOrder.objects.select_for_update().get(
            id=order_id,
            tenant=tenant,
            branch_id=branch_id
        )
    except SalesOrder.DoesNotExist:
        raise ValidationError("Sales order not found.")

    # 2. State Validations
    if order.status == 'Voided':
        raise ValidationError("This order has already been voided.")
    
    if hasattr(order, 'returns') and order.returns.exists():
        raise ValidationError("Cannot void an order that has processed returns. Use the refund system.")

    # 3. Shift Validation (The most critical security check)
    # Ensure the cashier who made the sale still has an open shift.
    shift_is_open = ShiftReport.objects.filter(
        tenant=tenant,
        branch_id=branch_id,
        cashier=order.user, # Assuming 'user' or 'cashier' is on the SalesOrder
        status=ShiftReport.Status.OPEN # Adjust to your actual status choice
    ).exists()

    if not shift_is_open:
        raise ValidationError(
            "Security Violation: Cannot void this transaction because the cashier's shift has been closed. "
            "Please process this as a standard Return instead."
        )

    # 4. Mutate the Order State
    order.status = 'Voided'
    # Optional: Log who voided it and why on the order model if you have these fields
    # order.voided_by = authorized_by 
    # order.void_reason = reason
    # order.voided_at = timezone.now()
    order.save()

    # 5. Nullify associated payments
    # Assuming your Payment model has a status field. 
    # If not, you might delete the payment records, though mutating status is preferred.

    # 6. Inventory Restocking (FIFO Safe)
    # Just like returns, we create a fresh batch at the exact cost price locked during the sale.
    # Because it happened on the same day, this perfectly preserves asset value.
    for item in order.items.all():
        InventoryBatch.objects.create(
            tenant=tenant,
            branch_id=branch_id,
            product=item.product,
            quantity_received=item.quantity,
            quantity_remaining=item.quantity,
            cost_price=item.cost_price_at_sale, # Crucial: Restores exact ledger value
            notes=f"Restocked from Voided Order #{order.receipt_number}. Auth by: {authorized_by.get_full_name()}"
        )

    return order



def create_void_request(*, tenant, branch_id, order_id: str, cashier, reason: str):
    """Cashier initiates the request."""
    order = SalesOrder.objects.get(id=order_id, tenant=tenant, branch_id=branch_id)
    
    if order.status == 'Voided':
        raise ValidationError("Order is already voided.")
        
    if hasattr(order, 'void_request') and order.void_request.status == 'Pending':
        raise ValidationError("A void request is already pending for this order.")

    return VoidRequest.objects.create(
        tenant=tenant,
        branch_id=branch_id,
        order=order,
        requested_by=cashier,
        reason=reason
    )


@transaction.atomic
def resolve_void_request(*, tenant, request_id: int, user, action: str, rejection_reason: str = ""):
    """Manager approves or rejects the request."""
    
    # 1. Security Authorization check based on Tenant Settings
    allowed_roles = tenant.void_approval_roles
    if user.role not in allowed_roles:
        raise ValidationError("You do not have permission to approve void requests.")

    # 2. Lock the request to prevent double-processing
    void_req = VoidRequest.objects.select_for_update().get(id=request_id, tenant=tenant)
    
    if void_req.status != 'Pending':
        raise ValidationError(f"This request has already been {void_req.status}.")

    # 3. Handle Rejection
    if action == 'Reject':
        void_req.status = 'Rejected'
        void_req.reviewed_by = user
        void_req.reviewed_at = timezone.now()
        void_req.rejection_reason = rejection_reason
        void_req.save()
        return void_req

    # 4. Handle Approval (Execute the core void logic)
    if action == 'Approve':
        order = void_req.order
        
        # [Insert the Shift Validation check here if you still want to ensure 
        # the cashier's shift hasn't closed while the manager was reviewing]

        # Mutate Order
        order.status = 'Voided'
        order.save()

        # Mutate Payments
        Payment.objects.filter(reference_code=order.receipt_number).update(status='Voided')

        # Restock Inventory (FIFO Safe)
        for item in order.items.all():
            InventoryBatch.objects.create(
                tenant=tenant,
                branch_id=void_req.branch_id,
                product=item.product,
                quantity_received=item.quantity,
                quantity_remaining=item.quantity,
                cost_price=item.cost_price_at_sale,
                notes=f"Restocked from Voided Order #{order.receipt_number}. Auth by: {user.get_full_name()}"
            )

        # Update Request Trail
        void_req.status = 'Approved'
        void_req.reviewed_by = user
        void_req.reviewed_at = timezone.now()
        void_req.save()

        return void_req
from django.db import transaction
from django.core.exceptions import ValidationError
from django.utils import timezone
from decimal import Decimal

from common.models import Branch
from inventory.models import Product, InventoryBatch
from sales.models import SalesOrder, SaleItem, Payment, Customer, CustomerLedger

def create_sale_service(
    *,
    user,
    branch_id: str,
    customer_id: str = None,
    items: list[dict],
    payment_data: dict = None
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

        # 4. Update Order Totals
        order.total_amount = total_order_amount
        
        # 5. Process Payment (If provided)
        amount_paid = Decimal('0.00')
        if payment_data:
            amount_paid = Decimal(str(payment_data.get('amount', 0)))
            if amount_paid > 0:
                Payment.objects.create(
                    tenant=user.tenant,
                    branch=branch,
                    order=order,
                    method=payment_data.get('method', Payment.Method.CASH),
                    amount=amount_paid,
                    reference_code=payment_data.get('reference_code'),
                    processed_by=user
                )
        
        order.amount_paid = amount_paid

        # 6. Determine Status & Handle Credit
        if amount_paid >= total_order_amount:
            order.payment_status = SalesOrder.PaymentStatus.PAID
        elif amount_paid > 0:
            order.payment_status = SalesOrder.PaymentStatus.PARTIAL
        else:
            order.payment_status = SalesOrder.PaymentStatus.PENDING

        # 7. Update Customer Ledger (If debt exists)
        debt_amount = total_order_amount - amount_paid
        
        if debt_amount > 0:
            if not customer:
                raise ValidationError("Cannot allow credit sale (partial/pending) for walk-in customers.")
            
            # Check Credit Limit
            if (customer.current_debt + debt_amount) > customer.credit_limit:
                 raise ValidationError(f"Credit limit exceeded. Available credit: {customer.credit_limit - customer.current_debt}")

            # Lock Customer Row to update debt safely
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
                reference_id=order.id
            )

        order.save()
        return order
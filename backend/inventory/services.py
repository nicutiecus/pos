from django.db import transaction
from django.core.exceptions import ValidationError
from common.models import Branch
from .models import (Product, InventoryBatch, Category,
                      StockTransferLog, ProductPriceHistory, InventoryLog, Supplier, 
                      PurchaseOrder, PurchaseOrderItem, PurchaseInvoice, PurchaseInvoiceItem, SupplierLedger,
                       SupplierPayment )
from decimal import Decimal, InvalidOperation
import random
import string
from django.db.models import ProtectedError

def generate_receipt_ref(transaction_type):
    """Generates a short, unique reference like PAY-8X92B"""
    suffix = ''.join(random.choices(string.ascii_uppercase + string.digits, k=5))
    return f"{transaction_type}-{suffix}"

def create_purchase_order_service(
    *, 
    user, 
    branch_id: str, 
    supplier_id: str, 
    items: list, 
    expected_delivery_date: str = None,
    notes: str = ""
) -> PurchaseOrder:
    """
    Creates a draft Purchase Order (PO) to be sent to a supplier.
    This does NOT affect inventory or supplier debt.
    
    Expected items format:
    [
        {'product_id': 'uuid-1', 'expected_quantity': 50, 'agreed_unit_price': 1200.00},
        {'product_id': 'uuid-2', 'expected_quantity': 20, 'agreed_unit_price': 5000.00}
    ]
    """
    
    # 1. Validate Branch and Supplier belong to the user's tenant
    branch = Branch.objects.filter(id=branch_id, tenant=user.tenant).first()
    supplier = Supplier.objects.filter(id=supplier_id, tenant=user.tenant).first()
    
    if not branch:
        raise ValidationError("Invalid branch or branch belongs to another organization.")
    if not supplier:
        raise ValidationError("Invalid supplier selected.")
    if not items:
        raise ValidationError("A purchase order must contain at least one item.")

    with transaction.atomic():
        # 2. Create the base Purchase Order
        purchase_order = PurchaseOrder.objects.create(
            tenant=user.tenant,
            branch=branch,
            supplier=supplier,
            ordered_by=user,
            expected_delivery_date=expected_delivery_date,
            total_estimated_amount=Decimal('0.00'), # Will calculate below
            status=PurchaseOrder.OrderStatus.DRAFT,
            notes=notes
        )

        total_estimated_amount = Decimal('0.00')

        # 3. Process each item in the order
        for item in items:
            product = Product.objects.filter(id=item['product_id'], tenant=user.tenant).first()
            if not product:
                raise ValidationError(f"Product ID {item['product_id']} not found.")

            quantity = Decimal(str(item['expected_quantity']))
            unit_price = Decimal(str(item['agreed_unit_price']))
            subtotal = quantity * unit_price

            # Create the Line Item
            PurchaseOrderItem.objects.create(
                order=purchase_order,
                product=product,
                expected_quantity=quantity,
                agreed_unit_price=unit_price,
                subtotal=subtotal
            )

            total_estimated_amount += subtotal

        # 4. Update the total amount on the parent order
        purchase_order.total_estimated_amount = total_estimated_amount
        purchase_order.save(update_fields=['total_estimated_amount'])

    return purchase_order

def receive_stock_service(
    *, 
    user, 
    branch_id: str,
    supplier_id: str, # NEW: Must know who sent it
    items: list, 
    purchase_order_id: str = None, # NEW: Optional link to a PO
    amount_paid_upfront: Decimal = Decimal('0.00'), # NEW: If cash was handed to the driver
    payment_method: str=None,
    notes: str = ""
) -> PurchaseInvoice:
    """
    Receives stock into a branch, creates the invoice, generates batches, 
    and updates the supplier's financial ledger.
    """
    
    # 1. Validation
    branch = Branch.objects.filter(id=branch_id, tenant=user.tenant).first()
    supplier = Supplier.objects.filter(id=supplier_id, tenant=user.tenant).first()
    if not branch or not supplier:
        raise ValidationError("Invalid branch or supplier.")

    if amount_paid_upfront > 0 and not payment_method:
        raise ValidationError("Payment method is required if an upfront payment is made.")
    
    po = None
    if purchase_order_id:
        po = PurchaseOrder.objects.filter(id=purchase_order_id, tenant=user.tenant).first()

    with transaction.atomic():
        # 2. Create the Draft Invoice
        invoice = PurchaseInvoice.objects.create(
            tenant=user.tenant,
            branch=branch,
            supplier=supplier,
            received_by=user,
            purchase_order=po,
            amount_paid=amount_paid_upfront,
            total_amount=Decimal('0.00'), # We will calculate this below
            status=PurchaseInvoice.InvoiceStatus.CONFIRMED
        )

        total_invoice_amount = Decimal('0.00')

        # 3. Process Items: Create Batches and Invoice Items
        for item in items:
            product = Product.objects.filter(id=item['product_id'], tenant=user.tenant).first()
            if not product:
                raise ValidationError(f"Product ID {item['product_id']} not found.")

            quantity = Decimal(str(item['quantity']))
            cost_price = Decimal(str(item['cost_price']))
            subtotal = quantity * cost_price

            # a. Create the Physical Batch
            batch = InventoryBatch.objects.create(
                tenant=user.tenant,
                branch=branch,
                product=product,
                batch_number=item.get('batch_number', f"RCV-{invoice.id}"), # Auto-generate if missing
                expiry_date=item.get('expiry_date'),
                quantity_on_hand=quantity,
                cost_price_at_receipt=cost_price,
                status=InventoryBatch.Status.ACTIVE
            )

            # b. Create the Invoice Line Item
            PurchaseInvoiceItem.objects.create(
                invoice=invoice,
                product=product,
                batch=batch, # Link the physical stock to the financial document
                received_quantity=quantity,
                actual_unit_price=cost_price,
                subtotal=subtotal
            )

            # c. Log the physical movement
            InventoryLog.objects.create(
                tenant=user.tenant,
                branch_id=branch_id,
                product_id=product.id,
                user=user,
                transaction_type=InventoryLog.TransactionType.ADDITION,
                quantity=quantity,
                total_value=subtotal,
                notes=f"Received via Invoice {invoice.id}. {notes}"
            )

            total_invoice_amount += subtotal

        # 4. Finalize Invoice Financials
        invoice.total_amount = total_invoice_amount
        
        if amount_paid_upfront >= total_invoice_amount:
            invoice.payment_status = PurchaseInvoice.PaymentStatus.PAID
        elif amount_paid_upfront > 0:
            invoice.payment_status = PurchaseInvoice.PaymentStatus.PARTIAL
        else:
            invoice.payment_status = PurchaseInvoice.PaymentStatus.PENDING
            
        invoice.save()

        debt_incurred = total_invoice_amount - amount_paid_upfront

        # Fetch the supplier's most recent balance, locking the row for concurrency
        last_ledger_entry = SupplierLedger.objects.select_for_update().filter(
                supplier=supplier, 
                tenant=user.tenant
            ).order_by('-created_at', '-id').first()
            
        current_balance = last_ledger_entry.balance_after if last_ledger_entry else Decimal('0.00')
        final_debt_balance = current_balance + debt_incurred

        if debt_incurred > 0:

        # 5. Update Supplier Ledger (Accounts Payable)
        # Create a BILL entry for the total cost of the goods received
            SupplierLedger.objects.create(
                    tenant=user.tenant,
                    supplier=supplier,
                    branch=branch,
                    transaction_type='Purchase',
                    amount=debt_incurred,
                    balance_after=final_debt_balance,
                    reference_id=invoice.id,
                    notes=f"Stock received on Invoice {invoice.id}"
                )
            supplier.current_debt = final_debt_balance
            supplier.save(update_fields=['current_debt'])
                

        # If money was paid immediately, log the payment to reduce the debt
        if amount_paid_upfront > 0:
            SupplierPayment.objects.create(
                tenant=user.tenant,
                invoice= invoice,
                supplier=supplier,
                branch=branch,
                transaction_type='Purchase',
                method= payment_method,
                amount=amount_paid_upfront,
                reference_code=f"PAY-{invoice.id}",
            )

    

        #  Update Purchase Order Status (if applicable)
        if po:
            # You could add logic here to check if partial or full, but for now:
            po.status = PurchaseOrder.OrderStatus.RECEIVED
            po.save(update_fields=['status'])

    return invoice

def create_product_service(*, user, data):
    category_id = data.pop('category_id', None)
    
    product = Product.objects.create(
        tenant=user.tenant,
        category_id=category_id,
        **data
    )
    return product

def create_category_service(*, user, name: str) -> Category:
    """
    Creates a new category for the user's tenant.
    """
    category = Category.objects.create(
        tenant=user.tenant,
        name=name
    )
    return category

def remove_category_service(*, user, category_id: int):
    """
    Deletes a category for the user's tenant.
    Prevents deletion if products are currently assigned to it.
    """
    # 1. Find the category and ensure it belongs to this tenant
    category = Category.objects.filter(id=category_id, tenant=user.tenant).first()
    
    if not category:
        raise ValidationError("Category not found or you do not have permission to delete it.")

    # 2. Safety Check: Ensure no products are using this category
    # Query the Product table to see if any exist with this category_id
    has_linked_products = Product.objects.filter(category_id=category_id, tenant=user.tenant).exists()
    
    if has_linked_products:
        raise ValidationError(
            "Cannot delete this category because it contains active products. "
            "Please reassign or delete the products first."
        )

    # 3. Delete the category
    category.delete()
    
    return True




def initiate_transfer_service(
    *, 
    user, 
    source_branch_id: str, 
    destination_branch_id: str, 
    product_id: str, 
    quantity: Decimal, 
    notes: str = ""
):
    if str(source_branch_id) == str(destination_branch_id):
        raise ValidationError("Source and destination branches cannot be the same.")

    # 1. Validate Branches & Product
    source_branch = Branch.objects.filter(id=source_branch_id, tenant=user.tenant).first()
    dest_branch = Branch.objects.filter(id=destination_branch_id, tenant=user.tenant).first()
    product = Product.objects.filter(id=product_id, tenant=user.tenant).first()

    if not all([source_branch, dest_branch, product]):
        raise ValidationError("Invalid branch or product selection.")

    with transaction.atomic():
        # ✅ ADD THIS MISSING BLOCK: Fetch batches and lock them
        source_batches = InventoryBatch.objects.select_for_update().filter(
            tenant=user.tenant,
            branch=source_branch,
            product=product,
            quantity_on_hand__gt=0,
            status=InventoryBatch.Status.ACTIVE # Or 'Active' depending on your model choices
        ).order_by('created_at')

        # ✅ ADD THIS MISSING BLOCK: Check if we have enough stock
        total_available = sum(batch.quantity_on_hand for batch in source_batches)
        if quantity > total_available:
            raise ValidationError(f"Insufficient stock at source branch. Available: {total_available}")

        # 2. Create the Pending Log
        transfer_log = StockTransferLog.objects.create(
            tenant=user.tenant,
            source_branch=source_branch,
            destination_branch=dest_branch,
            product=product,
            quantity=quantity,
            transferred_by=user,
            notes=notes,
            status=StockTransferLog.Status.PENDING # 🚚 In Transit
        )

        remaining_to_transfer = quantity
        
        # 3. Deduct from Source and create IN TRANSIT destination batches
        for batch in source_batches: 
            if remaining_to_transfer <= 0: break
            transfer_qty = min(remaining_to_transfer, batch.quantity_on_hand)
            
            # Deduct source
            batch.quantity_on_hand -= transfer_qty
            if batch.quantity_on_hand == 0: 
                batch.status = 'Depleted' # Or InventoryBatch.Status.DEPLETED
            batch.save()

            # Create destination batch hidden in 'In_Transit'
            InventoryBatch.objects.create(
                tenant=user.tenant,
                branch=dest_branch,
                product=product,
                quantity_on_hand=transfer_qty,
                cost_price_at_receipt=batch.cost_price_at_receipt,
                expiry_date=batch.expiry_date,
                batch_number=f"TRF-{transfer_log.id}", 
                status='In_Transit' 
            )
            remaining_to_transfer -= transfer_qty

        # Optional: Call your email notification function here if you are using it!

        return transfer_log

def accept_transfer_service(*, user, transfer_id):
    with transaction.atomic():
        transfer = StockTransferLog.objects.select_for_update().get(id=transfer_id, tenant=user.tenant)
        
        if transfer.status != StockTransferLog.Status.PENDING:
            raise ValidationError(f"This transfer is already {transfer.status}.")

        # 🔒 Security: Only people in the receiving branch (or Admins) can accept
        if user.role not in ['Admin', 'Super_Admin'] and user.branch_id != transfer.destination_branch_id:
            raise ValidationError("You do not have permission to accept stock for this branch.")

        # 1. Find all 'In_Transit' batches linked to this transfer
        transit_batches = InventoryBatch.objects.filter(
            tenant=user.tenant,
            batch_number=f"TRF-{transfer.id}",
            status='In_Transit'
        )

        # 2. Make them active so they can be sold
        for batch in transit_batches:
            batch.status = 'Active'
            batch.save()

        # 3. Mark the transfer as Complete
        transfer.status = StockTransferLog.Status.COMPLETED
        transfer.received_by = user
        transfer.save()

        return transfer



def reject_transfer_service(*, user, transfer_id: str, reason: str = ""):
    with transaction.atomic():
        # 1. Fetch and lock the transfer record
        transfer = StockTransferLog.objects.select_for_update().get(id=transfer_id, tenant=user.tenant)
        
        if transfer.status != StockTransferLog.Status.PENDING:
            raise ValidationError(f"Cannot reject. This transfer is already {transfer.status}.")

        # 🔒 Security: Only people in the receiving branch (or Admins) can reject
        if user.role not in ['Admin', 'Super_Admin'] and user.branch_id != transfer.destination_branch_id:
            raise ValidationError("You do not have permission to reject stock for this branch.")

        # 2. Find all 'In_Transit' batches linked to this transfer
        transit_batches = InventoryBatch.objects.filter(
            tenant=user.tenant,
            batch_number=f"TRF-{transfer.id}",
            status='In_Transit'
        )

        # 3. Return the stock to the Source Branch
        for batch in transit_batches:
            # Recreate the batch at the source branch to make it available for sale again
            InventoryBatch.objects.create(
                tenant=user.tenant,
                branch=transfer.source_branch, # ⬅️ Going back to sender
                product=transfer.product,
                quantity_on_hand=batch.quantity_on_hand,
                cost_price_at_receipt=batch.cost_price_at_receipt,
                expiry_date=batch.expiry_date,
                batch_number=f"RTN-{batch.batch_number}", # Tag as Returned
                status='Active' # ⬅️ Available for sale again
            )
            # Delete the transit batch so it doesn't permanently clutter the destination branch
            batch.delete()

        # 4. Mark the transfer as Rejected and log the reason
        transfer.status = StockTransferLog.Status.REJECTED
        transfer.received_by = user
        if reason:
            transfer.notes = f"{transfer.notes}\n[REJECTED REASON]: {reason}".strip()
        transfer.save()

        # Optional: You could trigger an email here to notify the source branch manager!

        return transfer
    
def update_product_price_service(*, user, product_id: str, new_price) -> Product:
    # Fetch the product, ensuring it belongs to this user's tenant
    product = Product.objects.filter(id=product_id, tenant=user.tenant).first()
    
    if not product:
        raise ValidationError("Product not found.")

    
    old_price = product.selling_price 

    if old_price==new_price:
        return product
# Wrap in a transaction so both the update and the log succeed together
    with transaction.atomic():
        # 1. Update the Product
        product.selling_price = new_price
        product.save(update_fields=['selling_price', 'updated_at'])

        # 2. Create the Audit Log
        ProductPriceHistory.objects.create(
            tenant=user.tenant,
            product=product,
            old_price=old_price,
            new_price=new_price,
            changed_by=user
        )

    return product




@transaction.atomic
def remove_stock_service(*, user, product_id, branch_id, quantity, reason, notes=""):
    
    # 1. Fetch active batches for this product, oldest first (FIFO)
    batches = InventoryBatch.objects.select_for_update().filter(
        tenant=user.tenant,
        branch_id=branch_id,
        product_id=product_id,
        quantity_on_hand__gt=0
    ).order_by('created_at')

    total_available = sum(batch.quantity_on_hand for batch in batches)
    
    if quantity > total_available:
        raise ValidationError(f"Cannot remove {quantity}. Only {total_available} available in stock.")

    remaining_to_remove = quantity
    financial_loss_value = Decimal('0.00')

    # 2. Deduct stock across batches
    for batch in batches:
        if remaining_to_remove <= 0:
            break

        if batch.quantity_on_hand >= remaining_to_remove:
            # This batch can fulfill the rest of the removal
            financial_loss_value += remaining_to_remove * batch.cost_price_at_receipt
            batch.quantity_on_hand -= remaining_to_remove
            batch.save()
            remaining_to_remove = Decimal('0.00')
        else:
            # Exhaust this batch completely and move to the next
            financial_loss_value += batch.quantity_on_hand * batch.cost_price_at_receipt
            remaining_to_remove -= batch.quantity_on_hand
            batch.quantity_on_hand = Decimal('0.00')
            batch.save()

    # 3. Create the Audit Log entry
    InventoryLog.objects.create(
        tenant=user.tenant,
        branch_id=branch_id,
        product_id=product_id,
        user=user,
        transaction_type=InventoryLog.TransactionType.REMOVAL,
        quantity=-quantity, # Stored as a negative number for easy ledger math later
        reason=reason,
        total_value=financial_loss_value,
        notes=notes
    )

    return True



def create_supplier_service(*, user, name: str, email: str, phone, address, contact_person, 
                            bank_details, tax_identification_number=None, current_debt=None, debt_limit=None) -> Supplier:
    """
    Creates a new supplier for the user's tenant.
    """
    supplier = Supplier.objects.create(
        tenant=user.tenant,
        name=name,
        email= email,
        phone=phone,
        address= address,
        contact_person= contact_person,
        bank_details= bank_details,
        tax_identification_number= tax_identification_number,
        current_debt = current_debt
    )
    return supplier




def update_supplier_service(*, user, supplier_id: str, data: dict) -> Supplier:
    """
    Updates specific fields on a supplier.
    """
    supplier = Supplier.objects.filter(id=supplier_id, tenant=user.tenant).first()
    
    if not supplier:
        raise Supplier.DoesNotExist("Supplier not found.")

    # Loop through the provided data and dynamically update the fields
    for field, value in data.items():
        setattr(supplier, field, value)
        
    supplier.save()
    
    return supplier


def delete_supplier_service(*, user, supplier_id: str):
    """
    Safely deletes a supplier. Prevents deletion if they have outstanding debt
    or historical purchase orders.
    """
    supplier = Supplier.objects.filter(id=supplier_id, tenant=user.tenant).first()
    
    if not supplier:
        raise Supplier.DoesNotExist("Supplier not found.")

    # Business Logic Check: Do not delete if we still owe them money!
    if supplier.current_debt > 0:
        raise ValidationError("Cannot delete a supplier with an outstanding debt balance. Clear the debt first.")

    try:
        supplier.delete()
    except ProtectedError:
        # Caught because PurchaseOrder.supplier is models.PROTECT
        raise ValidationError(
            "Cannot delete this supplier because they are linked to existing purchase orders. "
            "Consider renaming them to 'DO NOT USE - [Name]' instead."
        )
    


def pay_supplier_credit_service(
    *, 
    user, 
    supplier_id: str, 
    branch_id: str, 
    amount: float, 
    method: str,
    processed_by: str, 
    notes: str = ""
):
    try:
        amount = Decimal(str(amount))
    except (InvalidOperation, TypeError, ValueError):
        raise ValidationError({"amount": "Please provide a valid decimal number."})
    branch = Branch.objects.filter(id=branch_id, tenant=user.tenant).first()
    if not branch:
        raise ValidationError("Invalid branch.")

    with transaction.atomic():
        try:
            supplier = Supplier.objects.select_for_update().get(id=supplier_id, tenant=user.tenant)
        except Supplier.DoesNotExist:
            raise ValidationError("Supplier not found.")

        if amount <= Decimal(0.0):
            raise ValidationError("Payment amount must be greater than zero.")
            
        if amount > supplier.current_debt:
            raise ValidationError(f"Amount exceeds debt. Outstanding: {Supplier.current_debt}")

        # 1. Update Debt
        supplier.current_debt -= amount
        supplier.save()

        # 2. Generate Invoice Number
        payment_reference = generate_receipt_ref("DEBT")

        # 3. Create Ledger Entry
        ledger = SupplierLedger.objects.create(
            tenant=user.tenant,
            branch=branch,
            supplier=supplier,
            transaction_type=SupplierLedger.TransactionType.CREDIT_PAYMENT,
            amount=amount,
            balance_after=supplier.current_debt,
            
            # ✅ STORE THE INVOICE NUMBER HERE
            reference_id=payment_reference,
            processed_by = processed_by,
            
            notes=notes or f"Debt payment via {method}"
        )
        SupplierPayment.objects.create(
            tenant=user.tenant,
            branch=branch,
            supplier=supplier, # Notice no 'invoice' is passed here!
            processed_by=user,
            transaction_type='Debt Payment',
            method=method,
            amount=amount,
            reference_code=payment_reference
        )

        return ledger
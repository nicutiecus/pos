from django.db import transaction
from django.core.exceptions import ValidationError
from common.models import Branch
from .models import Product, InventoryBatch, Category, StockTransferLog, ProductPriceHistory
from decimal import Decimal
import random
import string


def receive_stock_service(
    *, 
    user, 
    branch_id: str, 
    items: list, 
    notes: str = ""
) -> list[InventoryBatch]:
    """
    Receives stock into a branch, creating individual inventory batches.
    """
    
    # 1. Validation: Ensure Branch exists and belongs to User's Tenant
    branch = Branch.objects.filter(id=branch_id, tenant=user.tenant).first()
    if not branch:
        raise ValidationError("Invalid branch or branch belongs to another organization.")

    created_batches = []

    with transaction.atomic():
        for item in items:
            # 2. Validation: Ensure Product belongs to Tenant
            product = Product.objects.filter(id=item['product_id'], tenant=user.tenant).first()
            if not product:
                raise ValidationError(f"Product ID {item['product_id']} not found.")

            # 3. Create the Batch
            # Note: We don't just 'add to number'. In a cold room, 
            # we track specific batches for expiry management.
            batch = InventoryBatch.objects.create(
                tenant=user.tenant,
                branch=branch,
                product=product,
                batch_number=item['batch_number'],
                expiry_date=item.get('expiry_date'),
                quantity_on_hand=item['quantity'],
                cost_price_at_receipt=item['cost_price'],
                status=InventoryBatch.Status.ACTIVE
            )
            created_batches.append(batch)
            
            # Optional: Log this action in a 'StockMovementLog' table here
            

    return created_batches

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

# inventory/services.py
# ... ensure you have your existing imports ...

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
from django.db import transaction
from django.core.exceptions import ValidationError
from common.models import Branch
from .models import Product, InventoryBatch, Category

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
from django.db import transaction
from django.core.exceptions import ValidationError
from common.models import Branch
from .models import Product, InventoryBatch, Category
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



def generate_receipt_ref():
    """Generates a short, unique reference like PAY-8X92B"""
    suffix = ''.join(random.choices(string.ascii_uppercase + string.digits, k=5))
    return f"PAY-{suffix}"

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
        invoice_number = generate_receipt_ref()

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
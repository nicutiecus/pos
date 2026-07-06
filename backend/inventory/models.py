import uuid
from django.db import models
from django.utils.translation import gettext_lazy as _
from common.models import  TenantAwareModel, Branch
from django.conf import settings
from nanoid import generate
from django.utils import timezone


class Category(TenantAwareModel):
    name = models.CharField(max_length=100)
    
    class Meta:
        db_table = 'categories'
        verbose_name_plural = 'categories'

    def __str__(self):
        return self.name

class Product(TenantAwareModel):
    class UnitType(models.TextChoices):
        WEIGHT = 'Weight', _('Weight')
        UNIT = 'Unit', _('Unit')
        CARTON = 'Carton', _('Carton')

    name = models.CharField(max_length=150)
    sku = models.CharField(max_length=50, unique=True, db_index=True)
    # Lazy reference to self-app model
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, blank=True)
    
    cost_price = models.DecimalField(max_digits=10, decimal_places=2, null = True, blank=True)
    selling_price = models.DecimalField(max_digits=10, decimal_places=2)
    unit_type = models.CharField(max_length=10, choices=UnitType.choices)
    description = models.TextField(blank=True, null=True)
    
    # Enterprise features
    has_sub_unit = models.BooleanField(default=False)
    sub_unit_ratio = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    attributes = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = 'products'

    def __str__(self):
        return self.name

class InventoryBatch(TenantAwareModel):
    """
    Tracks specific arrivals of stock (expiry, batch number).
    """
    class Status(models.TextChoices):
        ACTIVE = 'Active', _('Active')
        EXPIRED = 'Expired', _('Expired')
        QUARANTINED = 'Quarantined', _('Quarantined')
        DEPLETED = 'Depeleted', _('Depleted')

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='batches')
    # Cross-app Foreign Key to 'common'
    branch = models.ForeignKey('common.Branch', on_delete=models.CASCADE, related_name='inventory')
    
    batch_number = models.CharField(max_length=50)
    expiry_date = models.DateField(null=True, blank=True)
    quantity_on_hand = models.DecimalField(max_digits=10, decimal_places=2)
    cost_price_at_receipt = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    version = models.IntegerField(default=0) # Optimistic locking

    class Meta:
        db_table = 'inventory_batches'
    
    def __str__(self):
        return self.batch_number

class InventoryLog(TenantAwareModel):
    class TransactionType(models.TextChoices):
        ADDITION = 'Addition', 'Addition'
        REMOVAL = 'Removal', 'Removal'
        SALE = 'Sale', 'Sale'
        TRANSFER= 'Transfer', 'Transfer'

    class RemovalReason(models.TextChoices):
        DAMAGED = 'Damaged', 'Damaged'
        EXPIRED = 'Expired', 'Expired'
        INTERNAL_USE = 'Internal Use', 'Internal Use'
        THEFT = 'Theft', 'Theft'
        OTHER = 'Other', 'Other'

    branch = models.ForeignKey(Branch, on_delete=models.CASCADE)
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    
    transaction_type = models.CharField(max_length=20, choices=TransactionType.choices)
    reason = models.CharField(max_length=50, choices=RemovalReason.choices, null=True, blank=True)
    
    quantity = models.DecimalField(max_digits=10, decimal_places=2) # Will be negative for removals
    total_value = models.DecimalField(max_digits=12, decimal_places=2, default=0) # Financial cost of the removal
    notes = models.TextField(blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)

class StockTransfer(TenantAwareModel):
    """
    Headquarters logic for moving stock between branches.
    """
    class Status(models.TextChoices):
        IN_TRANSIT = 'In-Transit', _('In-Transit')
        RECEIVED = 'Received', _('Received')
        DISPUTED = 'Disputed', _('Disputed')

    source_branch = models.ForeignKey('common.Branch', on_delete=models.PROTECT, related_name='sent_transfers')
    dest_branch = models.ForeignKey('common.Branch', on_delete=models.PROTECT, related_name='received_transfers')
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.IN_TRANSIT)
    received_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'stock_transfers'

class TransferItem(models.Model):
    transfer = models.ForeignKey(StockTransfer, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey(Product, on_delete=models.PROTECT)
    qty_sent = models.DecimalField(max_digits=10, decimal_places=2)
    qty_received = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    discrepancy_note = models.TextField(null=True, blank=True)

    class Meta:
        db_table = 'transfer_items'




class StockTransferLog(TenantAwareModel):
    class Status(models.TextChoices):
        PENDING = 'Pending', 'Pending'       # In Transit
        COMPLETED = 'Completed', 'Completed' # Accepted
        REJECTED = 'Rejected', 'Rejected'    # Sent Back
        
    source_branch = models.ForeignKey(Branch, on_delete=models.PROTECT, related_name='transfers_out')
    destination_branch = models.ForeignKey(Branch, on_delete=models.PROTECT, related_name='transfers_in')
    product = models.ForeignKey('Product', on_delete=models.PROTECT)
    quantity = models.DecimalField(max_digits=10, decimal_places=2)
    transferred_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, 
                                       null=True, related_name='transfers_initiated')
    notes = models.TextField(blank=True, null=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    received_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, 
                                    null=True, blank=True, related_name='transfers_received')
    

class ProductPriceHistory(TenantAwareModel): 
    
    product = models.ForeignKey('inventory.Product', on_delete=models.CASCADE, related_name='price_history')
    old_price = models.DecimalField(max_digits=12, decimal_places=2)
    new_price = models.DecimalField(max_digits=12, decimal_places=2)
    changed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='price_changes')

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.product.name}: {self.old_price} -> {self.new_price}"


# 1. Add the generator function at the top of your file
def generate_purchase_id():
    # Uses a custom alphabet (No 0, O, 1, I, or lowercase letters)
    # Generates an 8-character string like "3K9XN2PA"
    id=generate('23456789ABCDEFGHJKLMNPQRSTUVWXYZ', 8)
    purchase_id=f"PO-{id}"
    return purchase_id

def generate_receipt_id():
    # Uses a custom alphabet (No 0, O, 1, I, or lowercase letters)
    # Generates an 8-character string like "3K9XN2PA"
    return generate('23456789ABCDEFGHJKLMNPQRSTUVWXYZ', 8)

def generate_supplier_id():
    return generate('23456789ABCDEFGHJKLMNPQRSTUVWXYZ', 6)

    

class PaymentMethodChoices(models.TextChoices):
    CASH = 'Cash', _('Cash')
    TRANSFER = 'Transfer', _('Transfer')
    POS = 'POS', _('POS')
    DEBT = 'Debt', _('Debt')

class Supplier(TenantAwareModel):
    id = models.CharField(primary_key=True, default=generate_supplier_id, editable=False)
    name = models.CharField(max_length=150, db_index=True)
    email = models.EmailField(blank=True, null=True)
    phone = models.CharField(max_length=20, null=True, blank=True)
    address = models.CharField(max_length=150, null=True, blank =True)
    contact_person = models.CharField(max_length=150, null=True, blank=True) 
    # Essential for B2B transfers
    bank_details = models.JSONField(default=dict, blank=True)  
    # For compliance
    tax_identification_number = models.CharField(max_length=50, null=True, blank=True)
    debt_limit = models.DecimalField(max_digits=12, decimal_places=2, default=1000000.00)
    current_debt = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)

    class Meta:
        db_table = 'suppliers'
    def __str__(self):
        return self.name

class SupplierLedger(TenantAwareModel):
    """
    Double-entry bookkeeping for supplier debt.
    """
    class TransactionType(models.TextChoices):
        SALE = 'Sale', _('Sale')
        PAYMENT = 'Payment', _('Payment')
        RETURN = 'Return', _('Return')

    supplier = models.ForeignKey(Supplier, on_delete=models.CASCADE, related_name='ledger_entries')
    transaction_type = models.CharField(max_length=20, choices=TransactionType.choices)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    balance_after = models.DecimalField(max_digits=12, decimal_places=2)
    reference_id = models.CharField(max_length=255, null=True, blank=True)
    notes = models.TextField(null=True, blank=True)

    branch = models.ForeignKey(
        'common.Branch', 
        on_delete=models.PROTECT, 
        null=True, 
        blank=True,
        help_text="The branch where this transaction occurred"
    )
    processed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.PROTECT, 
        null=True, 
        blank=True,
        help_text="The cashier who collected this debt payment"
    )

    class Meta:
        db_table = 'supplier_ledger'

class PurchaseOrder(TenantAwareModel):
    class OrderStatus(models.TextChoices):
        DRAFT = 'Draft', _('Draft')
        SENT = 'Sent', _('Sent')
        PARTIAL = 'Partially Received', _('Partially Received')
        RECEIVED = 'Fully Received', _('Fully Received')
        CANCELED = 'Canceled', _('Canceled')

    id = models.CharField(primary_key=True, max_length=8, default=generate_purchase_id, editable=False)
    branch = models.ForeignKey('common.Branch', on_delete=models.PROTECT, related_name='purchase_orders')
    supplier = models.ForeignKey('inventory.Supplier', on_delete=models.PROTECT, related_name='purchase_orders')
    ordered_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='placed_orders')
    
    expected_delivery_date = models.DateField(null=True, blank=True)
    total_estimated_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    status = models.CharField(max_length=25, choices=OrderStatus.choices, default=OrderStatus.DRAFT)
    notes = models.TextField(blank=True, null=True, help_text=_("Instructions for the supplier"))

    class Meta:
        db_table = 'purchase_orders'

    def __str__(self):
        return f"PO-{self.id} ({self.supplier.name})"

class PurchaseOrderItem(models.Model):
    order = models.ForeignKey(PurchaseOrder, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey('inventory.Product', on_delete=models.PROTECT)
    
    expected_quantity = models.DecimalField(max_digits=10, decimal_places=2)
    agreed_unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    subtotal = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        db_table = 'purchase_order_items'

class PurchaseInvoice(TenantAwareModel):
    class PaymentStatus(models.TextChoices):
        PAID = 'Paid', _('Paid')
        PARTIAL = 'Partial', _('Partial')
        PENDING = 'Pending', _('Pending')
    
    class InvoiceStatus(models.TextChoices):
        DRAFT = 'Draft', _('Draft')           # Counting goods, not yet finalized
        CONFIRMED = 'Confirmed', _('Confirmed') # Stock added, debt recorded

    id = models.CharField(primary_key=True, max_length=8, default=generate_receipt_id, editable=False)
    # Optional link back to the PO. (Sometimes emergency stock is bought without a PO)
    purchase_order = models.ForeignKey(PurchaseOrder, on_delete=models.SET_NULL, null=True, blank=True, related_name='invoices')
    
    branch = models.ForeignKey('common.Branch', on_delete=models.PROTECT, related_name='purchase_invoices')
    supplier = models.ForeignKey('inventory.Supplier', on_delete=models.PROTECT)
    received_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    
    invoice_date = models.DateField(default=timezone.now)
    supplier_reference = models.CharField(max_length=100, blank=True, null=True, help_text=_("The invoice number provided by the supplier"))
    
    # Financials
    discount_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    total_amount = models.DecimalField(max_digits=12, decimal_places=2)
    amount_paid = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    
    payment_status = models.CharField(max_length=20, choices=PaymentStatus.choices, default=PaymentStatus.PENDING)
    status = models.CharField(max_length=20, choices=InvoiceStatus.choices, default=InvoiceStatus.DRAFT)
    supplier_snapshot = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = 'purchase_invoices'

class PurchaseInvoiceItem(models.Model):
    invoice = models.ForeignKey(PurchaseInvoice, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey('inventory.Product', on_delete=models.PROTECT)
    
    # THIS is where the batch is linked, because the goods are now physically here
    batch = models.ForeignKey('inventory.InventoryBatch', on_delete=models.PROTECT)
    
    received_quantity = models.DecimalField(max_digits=10, decimal_places=2)
    actual_unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    subtotal = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        db_table = 'purchase_invoice_items'
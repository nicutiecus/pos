import uuid
from django.db import models
from django.utils.translation import gettext_lazy as _
from common.models import  TenantAwareModel, Branch
from django.conf import settings


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
    
    cost_price = models.DecimalField(max_digits=10, decimal_places=2)
    selling_price = models.DecimalField(max_digits=10, decimal_places=2)
    unit_type = models.CharField(max_length=10, choices=UnitType.choices)
    description = models.TextField(blank=True, null=True)
    
    # Enterprise features
    has_sub_unit = models.BooleanField(default=False)
    sub_unit_ratio = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    attributes = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = 'products'

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


# inventory/models.py

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
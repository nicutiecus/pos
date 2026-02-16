import uuid
from django.db import models
from django.conf import settings
from django.utils.translation import gettext_lazy as _
from common.models import TenantAwareModel

class Customer(TenantAwareModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=150, db_index=True)
    phone = models.CharField(max_length=20, null=True, blank=True)
    credit_limit = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    current_debt = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)

    class Meta:
        db_table = 'customers'

class CustomerLedger(TenantAwareModel):
    """
    Double-entry bookkeeping for customer credit.
    """
    class TransactionType(models.TextChoices):
        INVOICE = 'Invoice', _('Invoice')
        PAYMENT = 'Payment', _('Payment')
        RETURN = 'Return', _('Return')

    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name='ledger_entries')
    transaction_type = models.CharField(max_length=20, choices=TransactionType.choices)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    balance_after = models.DecimalField(max_digits=12, decimal_places=2)
    reference_id = models.IntegerField(null=True, blank=True) 

    class Meta:
        db_table = 'customer_ledger'

class SalesOrder(TenantAwareModel):
    class PaymentStatus(models.TextChoices):
        PAID = 'Paid', _('Paid')
        PARTIAL = 'Partial', _('Partial')
        PENDING = 'Pending', _('Pending')

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    branch = models.ForeignKey('common.Branch', on_delete=models.PROTECT)
    customer = models.ForeignKey(Customer, on_delete=models.PROTECT, null=True, blank=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    
    total_amount = models.DecimalField(max_digits=12, decimal_places=2)
    amount_paid = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    payment_status = models.CharField(max_length=20, choices=PaymentStatus.choices, default=PaymentStatus.PENDING)
    customer_snapshot = models.JSONField(default=dict, blank=True, help_text=_("Snapshot of customer details at time of sale"))

    class Meta:
        db_table = 'sales_orders'

class SaleItem(models.Model):
    order = models.ForeignKey(SalesOrder, on_delete=models.CASCADE, related_name='items')
    # Cross-app FK to inventory
    product = models.ForeignKey('inventory.Product', on_delete=models.PROTECT)
    batch = models.ForeignKey('inventory.InventoryBatch', on_delete=models.PROTECT)
    cost_price_at_sale = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    
    quantity = models.DecimalField(max_digits=10, decimal_places=2)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    subtotal = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        db_table = 'sale_items'

class Payment(TenantAwareModel):
    class Method(models.TextChoices):
        CASH = 'Cash', _('Cash')
        TRANSFER = 'Transfer', _('Transfer')
        POS = 'POS', _('POS')

    order = models.ForeignKey(SalesOrder, on_delete=models.CASCADE, related_name='payments')
    branch = models.ForeignKey('common.Branch', on_delete=models.PROTECT, null=True)
    processed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True)
    method = models.CharField(max_length=20, choices=Method.choices)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    reference_code = models.CharField(max_length=100, null=True, blank=True)

    class Meta:
        db_table = 'payments'
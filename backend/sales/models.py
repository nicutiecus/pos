import uuid
from django.db import models
from django.conf import settings
from django.utils.translation import gettext_lazy as _
from common.models import TenantAwareModel, Branch
from django.utils import timezone
from nanoid import generate


# 1. Add the generator function at the top of your file
def generate_receipt_id():
    # Uses a custom alphabet (No 0, O, 1, I, or lowercase letters)
    # Generates an 8-character string like "3K9XN2PA"
    return generate('23456789ABCDEFGHJKLMNPQRSTUVWXYZ', 8)

def generate_customer_id():
    return generate('23456789ABCDEFGHJKLMNPQRSTUVWXYZ', 6)

def generate_shift_code():
    pass
    

class PaymentMethodChoices(models.TextChoices):
    CASH = 'Cash', _('Cash')
    TRANSFER = 'Transfer', _('Transfer')
    POS = 'POS', _('POS')
    CREDIT = 'Credit', _('Credit')

class Customer(TenantAwareModel):
    id = models.CharField(primary_key=True, default=generate_customer_id, editable=False)
    name = models.CharField(max_length=150, db_index=True)
    email = models.EmailField(blank=True, null=True)
    phone = models.CharField(max_length=20, null=True, blank=True)
    address = models.CharField(max_length=150, null=True, blank =True)
    credit_limit = models.DecimalField(max_digits=12, decimal_places=2, default=100000.00)
    current_debt = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)

    class Meta:
        db_table = 'customers'
    def __str__(self):
        return self.name

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
        db_table = 'customer_ledger'

class SalesOrder(TenantAwareModel):
    class PaymentStatus(models.TextChoices):
        PAID = 'Paid', _('Paid')
        PARTIAL = 'Partial', _('Partial')
        PENDING = 'Pending', _('Pending')

    id = models.CharField(primary_key=True, max_length=8, 
        default=generate_receipt_id, editable=False)
    branch = models.ForeignKey('common.Branch', on_delete=models.PROTECT)
    customer = models.ForeignKey(Customer, on_delete=models.PROTECT, null=True, blank=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    discount_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
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
    class Transactiontype(models.TextChoices):
        SALES='Sales', _('Sales')
        DEBT_PAYMENT='Debt Payment', _('Debt Payment')

    order = models.ForeignKey(SalesOrder, on_delete=models.CASCADE, related_name='payments', null=True, blank=True)
    customer = models.ForeignKey(Customer, on_delete=models.SET_NULL, related_name='payments', null=True, blank=True)
    transaction_type= models.CharField(max_length=20, choices=Transactiontype.choices, default=Transactiontype.SALES)
    branch = models.ForeignKey('common.Branch', on_delete=models.PROTECT, null=True)
    processed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True)
    method = models.CharField(max_length=20, choices=PaymentMethodChoices.choices)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    reference_code = models.CharField(max_length=100, null=True, blank=True)

    class Meta:
        db_table = 'payments'




class ShiftReport(TenantAwareModel):
    class Status(models.TextChoices):
        OPEN = 'Open', 'Open'
        CLOSED = 'Closed', 'Closed'

    branch = models.ForeignKey(Branch, on_delete=models.CASCADE, related_name='shifts')
    cashier = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='shifts')
    start_time = models.DateTimeField(auto_now_add=True)
    end_time = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.OPEN)

    # Totals at the time of closing (Calculated by System)
    order_count = models.IntegerField(default=0)
    expected_cash = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    expected_pos = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    expected_transfer = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_revenue = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    # Cashier declared values (Entered manually)
    declared_cash = models.DecimalField(max_digits=12, decimal_places=2, default=0, null=True, blank=True)
    variance = models.DecimalField(max_digits=12, decimal_places=2, default=0, null=True, blank=True)
    notes = models.TextField(blank=True, null=True)
    shift_code = models.CharField(max_length=100, unique=True, blank= True)

    def save(self, *args, **kwargs):
        if not self.shift_code:
            # Format: YYYYMMDD-HHMM (e.g., 20260302-0930)
            timestamp = timezone.now().strftime("%Y%m%d-%H%M")
            
            # Get the cashier's name or email prefix (e.g. 'johndoe')
            identifier = self.cashier.get_full_name().replace(" ", "").lower()
            if not identifier:
                identifier = self.cashier.email.split('@')[0].lower()
                
            # Combine them: johndoe-20260302-0930
            self.shift_code = f"{identifier}-{timestamp}"
            
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Shift {self.id} - {self.cashier.email} ({self.status})"
    

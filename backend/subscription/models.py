# subscription/models.py
from django.db import models
from common.models import TimeStampedModel, TenantAwareModel

class Plan(TimeStampedModel):
    """
    GLOBAL MODEL: Defines the SaaS pricing tiers. 
    Does NOT belong to a tenant.
    """
    name = models.CharField(max_length=50)
    slug = models.SlugField(unique=True)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    billing_cycle = models.CharField(max_length=20, choices=[('monthly', 'Monthly'), ('yearly', 'Yearly')])
    
    # Feature Quotas
    max_users = models.IntegerField(default=1)
    max_branches = models.IntegerField(default=1) 
    max_inventory_items = models.IntegerField(default=1000)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.name


class Subscription(TimeStampedModel):
    """
    TENANT-LINKED MODEL: Tracks current billing state.
    Uses OneToOneField to ensure only one active state per tenant.
    """
    # Explicit OneToOne instead of inheriting the ForeignKey from TenantAwareModel
    tenant = models.OneToOneField('users.Tenant', on_delete=models.CASCADE, related_name='subscription')
    plan = models.ForeignKey(Plan, on_delete=models.PROTECT, related_name='active_subscriptions')
    next_plan = models.ForeignKey(Plan, on_delete=models.SET_NULL, null=True, blank=True, related_name='pending_subscriptions')
    
    status = models.CharField(max_length=20, choices=[
        ('active', 'Active'), 
        ('past_due', 'Past Due'), 
        ('canceled', 'Canceled'),
        ('trialing', 'Trialing')
    ])
    payment_authorization_code = models.CharField(max_length=255, blank=True, null=True)
    current_period_start = models.DateTimeField()
    current_period_end = models.DateTimeField()
    cancel_at_period_end = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.tenant.name} - {self.plan.name} ({self.status})"


class PaymentHistory(TenantAwareModel):
    """
    TENANT AWARE MODEL: A log of all transactions.
    Inherits the 'tenant' ForeignKey from TenantAwareModel.
    """
    subscription = models.ForeignKey(Subscription, on_delete=models.SET_NULL, null=True)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    transaction_reference = models.CharField(max_length=100, unique=True)
    status = models.CharField(max_length=20, choices=[('successful', 'Successful'), ('failed', 'Failed'), ('pending', 'Pending')])
    
    # Optional: If you want to track when it was paid separately from the 'created_at' audit trail
    paid_at = models.DateTimeField(null=True, blank=True) 

    class Meta(TenantAwareModel.Meta):
        verbose_name_plural = "Payment Histories"

    def __str__(self):
        return f"{self.tenant.name} - {self.transaction_reference} - {self.status}"
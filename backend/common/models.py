import uuid
from django.db import models
from django.utils.translation import gettext_lazy as _

class TimeStampedModel(models.Model):
    """
    Abstract base utility for audit trails.
    """
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True

class TenantAwareModel(TimeStampedModel):
    """
    Abstract base class that ensures a model belongs to a specific Tenant.
    This enables strict data isolation (e.g. Product.objects.filter(tenant=t)).
    """
    tenant = models.ForeignKey(
        'users.Tenant', 
        on_delete=models.PROTECT, 
        related_name="%(app_label)s_%(class)s_set", # e.g. tenant.inventory_product_set
        db_index=True
    )

    class Meta:
        abstract = True

class Branch(TenantAwareModel):
    """
    Branches now belong to a Tenant.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100)
    code = models.CharField(max_length=20)
    location = models.CharField(max_length=150, null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = 'branches'
        verbose_name_plural = 'branches'
        # Enforce unique branch codes *within* a tenant (Two tenants can both have a 'MAIN' branch)
        constraints = [
            models.UniqueConstraint(fields=['tenant', 'code'], name='unique_branch_code_per_tenant')
        ]

    def __str__(self):
        return f"{self.name}"
    


class TenantSettings(TenantAwareModel):
    # Store Details (For Receipts)
    business_name = models.CharField(max_length=255, default="My Business")
    address = models.TextField(blank=True, null=True)
    phone = models.CharField(max_length=20, blank=True, null=True)
    email = models.EmailField(blank=True, null=True)
    
    # Financial Settings
    currency_symbol = models.CharField(max_length=5, default="₦")
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0.00, help_text="Percentage (e.g., 7.5)")
    
    # Receipt Customization
    receipt_footer = models.TextField(default="Thank you for your patronage!", blank=True)

    void_approval_roles = models.JSONField(default=list, 
     help_text="List of roles allowed to approve voids, e.g., ['Admin', 'Branch_Manager']")
    
    # Logo (Optional - requires Pillow library)
    # logo = models.ImageField(upload_to='logos/', blank=True, null=True)

    def __str__(self):
        return f"Settings for {self.tenant.name}"
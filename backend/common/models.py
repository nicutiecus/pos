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
        return f"{self.name} ({self.code})"
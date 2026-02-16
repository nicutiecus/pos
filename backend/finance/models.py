from django.db import models
from django.conf import settings
from common.models import TenantAwareModel

class Expense(TenantAwareModel):
    branch = models.ForeignKey('common.Branch', on_delete=models.CASCADE, related_name='expenses')
    category = models.CharField(max_length=50)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    description = models.TextField(null=True, blank=True)
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='approved_expenses'
    )

    class Meta:
        db_table = 'expenses'
from django.db import models

from django.db import models
from django.conf import settings
from decimal import Decimal
from common.models import TenantAwareModel



class ReturnOrder(TenantAwareModel):
    """
    Acts as a contra-account to SalesOrder. Tracks the overall return transaction.
    Inherits tenant, branch_id, created_at, and updated_at automatically.
    """
    original_order = models.ForeignKey('sales.SalesOrder', on_delete=models.PROTECT, related_name='returns')
    cashier = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.SET_NULL, 
        null=True, 
        related_name='processed_returns'
    )
    
    total_refund_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    reason = models.TextField(blank=True, null=True, help_text="Optional reason for the return.")

    def __str__(self):
        return f"Return #{self.id} for Order #{self.original_order_id}"


class ReturnItem(TenantAwareModel):
    """
    Acts as a contra-account to SaleItem. Tracks the specific items brought back.
    """
    class ConditionChoices(models.TextChoices):
        RESTOCKABLE = 'Restockable', 'Restockable (Return to Inventory)'
        DEFECTIVE = 'Defective', 'Defective/Damaged (Write-off as loss)'

    return_order = models.ForeignKey(ReturnOrder, on_delete=models.CASCADE, related_name='items')
    
    # Linked directly to the exact line item sold
    original_item = models.ForeignKey('sales.SaleItem', on_delete=models.PROTECT, related_name='returned_instances')
    
    quantity_returned = models.DecimalField(max_digits=10, decimal_places=3) 
    refund_amount = models.DecimalField(max_digits=12, decimal_places=2)
    
    condition = models.CharField(
        max_length=20, 
        choices=ConditionChoices.choices, 
        default=ConditionChoices.RESTOCKABLE
    )

    def __str__(self):
        return f"{self.quantity_returned}x {self.original_item.product.name} (Return #{self.return_order_id})"
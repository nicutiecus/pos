from django.db import models
from django.conf import settings
from common.models import TenantAwareModel

class Expense(TenantAwareModel):
    class Category(models.TextChoices):
        FUEL_POWER = 'Fuel & Power', 'Fuel & Power'
        INTERNET_COMMUNICATION = 'Internet & Communication', 'Internet & Communication'
        MAINTENANCE = 'Maintenance', 'Maintenance'
        STAFF_WELFARE = 'Staff Welfare', 'Staff Welfare'
        SUPPLIES = 'Office Supplies', 'Office Supplies'
        OTHER = 'Other', 'Other'

    class ExpenseScope(models.TextChoices):
        BRANCH = 'Branch', 'Branch Expense'
        CORPORATE = 'Corporate', 'Corporate/HQ Expense'
    
    scope = models.CharField(max_length=200, choices=ExpenseScope, default=ExpenseScope.BRANCH)

    branch = models.ForeignKey('common.Branch', on_delete=models.CASCADE, related_name='expenses', null=True, blank=True)
    category = models.CharField(max_length=50, choices=Category.choices, default=Category.OTHER)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    description = models.TextField(null=True, blank=True)
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='approved_expenses'
    )
    expense_date = models.DateField(auto_now_add=True)

    def clean(self):
        from django.core.exceptions import ValidationError
        
        # 🛡️ Data Integrity Guards
        if self.scope == self.ExpenseScope.BRANCH and not self.branch:
            raise ValidationError("A branch must be selected for Branch-level expenses.")
            
        if self.scope == self.ExpenseScope.CORPORATE and self.branch:
            raise ValidationError("Corporate expenses cannot be tied to a specific branch.")

    class Meta:
        db_table = 'expenses'
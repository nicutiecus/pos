from django.db import models
from django.conf import settings
from common.models import TenantAwareModel
from accounting.models import Account


class ExpenseCategory(TenantAwareModel):
    """
    Maps a user-friendly category name to a specific GL Account.
    Example: name="Office Fuel", account="6010 - Fuel Expense"
    """
    name = models.CharField(max_length=150)
    account = models.ForeignKey(
        Account, 
        on_delete=models.PROTECT, 
        limit_choices_to={'account_type': 'Expense'},
        help_text="The General Ledger account to debit for this category."
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'finance_expense_categories'
        constraints = [
            models.UniqueConstraint(fields=['tenant', 'name'], name='unique_expense_category_per_tenant')
        ]

    def __str__(self):
        return f"{self.name} -> {self.account.code}"

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
    category = models.ForeignKey(ExpenseCategory, on_delete= models.PROTECT)
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
from django.db import models
from django.core.exceptions import ValidationError
from decimal import Decimal
from common.models import TenantAwareModel, Branch
from django.utils import timezone

class Account(TenantAwareModel):
    """
    Chart of Accounts definition for a specific tenant.
    """
    class AccountType(models.TextChoices):
        ASSET = 'Asset', 'Asset'
        LIABILITY = 'Liability', 'Liability'
        EQUITY = 'Equity', 'Equity'
        REVENUE = 'Revenue', 'Revenue'
        EXPENSE = 'Expense', 'Expense'

    class AccountSubType(models.TextChoices):
        # Asset Subtypes
        CURRENT_ASSET = 'Current Asset', 'Current Asset'
        NON_CURRENT_ASSET = 'Non-Current Asset', 'Non-Current Asset'
        # Liability Subtypes
        CURRENT_LIABILITY = 'Current Liability', 'Current Liability'
        NON_CURRENT_LIABILITY = 'Non-Current Liability', 'Non-Current Liability'
        # Equity
        EQUITY = 'Equity', 'Equity'
        # Revenue Subtypes
        SALES_REVENUE = 'Sales Revenue', 'Sales Revenue'
        OTHER_OPERATING_REVENUE = 'Other Operating Revenue', 'Other Operating Revenue'
        OTHER_INCOME = 'Other Income', 'Other Income'
        # Expense Subtypes
        COGS = 'Cost of Goods Sold', 'Cost of Goods Sold'
        OPERATING_EXPENSE = 'Operating Expense', 'Operating Expense'
        FINANCE_COST = 'Finance Cost', 'Finance Cost'
        TAX_EXPENSE = 'Tax Expense', 'Tax Expense'
        OTHER_EXPENSE = 'Other Expense', 'Other Expense'

    name = models.CharField(max_length=255)
    code = models.CharField(max_length=50, help_text="Configurable account code (e.g., 1000, 400-A)")
    account_type = models.CharField(max_length=20, choices=AccountType.choices)
    account_sub_type = models.CharField(max_length=50, choices=AccountSubType.choices, default= AccountSubType.OTHER_EXPENSE) 
    description = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'accounting_accounts'
        # Ensures codes are unique per tenant, but allows different tenants to use the same codes
        constraints = [
            models.UniqueConstraint(fields=['tenant', 'code'], name='unique_account_code_per_tenant')
        ]

    def __str__(self):
        return f"{self.code} - {self.name}"


class FinancialYear(TenantAwareModel):
    name = models.CharField(max_length=50, help_text="e.g., FY2026")
    start_date = models.DateField()
    end_date = models.DateField()
    is_closed = models.BooleanField(default=False)

    class Meta:
        db_table = 'accounting_financial_years'
        ordering = ['-start_date']
        constraints = [
            models.UniqueConstraint(fields=['tenant', 'name'], name='unique_fy_name_per_tenant')
        ]

    def __str__(self):
        return f"{self.name} ({'Closed' if self.is_closed else 'Open'})"


class AccountingPeriod(TenantAwareModel):
    class Status(models.TextChoices):
        OPEN = 'Open', 'Open'
        CLOSED = 'Closed', 'Closed'

    financial_year = models.ForeignKey(FinancialYear, on_delete=models.CASCADE, related_name='periods')
    name = models.CharField(max_length=50, help_text="e.g., January 2026")
    start_date = models.DateField()
    end_date = models.DateField()
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.OPEN)

    class Meta:
        db_table = 'accounting_periods'
        ordering = ['start_date']
        constraints = [
            models.UniqueConstraint(fields=['tenant', 'name'], name='unique_period_name_per_tenant')
        ]

    def __str__(self):
        return f"{self.name} - {self.status}"

class JournalEntry(TenantAwareModel):
    """
    Represents a single, balanced accounting transaction.
    """
    date = models.DateField(default=timezone.now)
    period=models.ForeignKey(AccountingPeriod, on_delete=models.PROTECT, related_name='journal_entries', null=True)
    reference_id = models.CharField(max_length=100, blank=True, null=True, help_text="e.g., Receipt ID or PO ID")
    description = models.TextField()
    branch = models.ForeignKey(Branch, on_delete=models.PROTECT, null=True, blank=True)
    
    class Meta:
        db_table = 'accounting_journal_entries'

class JournalEntryLine(models.Model):
    """
    The individual Debit and Credit lines for a Journal Entry.
    """
    journal_entry = models.ForeignKey(JournalEntry, on_delete=models.CASCADE, related_name='lines')
    account = models.ForeignKey(Account, on_delete=models.PROTECT)
    debit = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    credit = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))

    class Meta:
        db_table = 'accounting_journal_entry_lines'



class AccountingSettings(TenantAwareModel):
    tenant = models.OneToOneField('users.Tenant', on_delete=models.CASCADE, related_name='accounting_settings')

    #account prefixes
    asset_prefix = models.CharField(max_length=8, default='1000')
    liability_prefix = models.CharField(max_length=8, default='2000')
    equity_prefix = models.CharField(max_length=8, default='3000')
    revenue_prefix = models.CharField(max_length=8, default='4000')
    expense_prefix = models.CharField(max_length=8, default='5000')

    # Asset Accounts
    
    default_inventory_account = models.ForeignKey(Account, on_delete=models.SET_NULL, null=True, related_name='+')
    default_cash_account = models.ForeignKey(Account, on_delete=models.SET_NULL, null=True, related_name='+')
    default_pos_account = models.ForeignKey(Account, on_delete=models.SET_NULL, null=True, related_name='+')
    default_transfer_account = models.ForeignKey(Account, on_delete=models.SET_NULL, null=True, related_name='+')
    default_ar_account = models.ForeignKey(Account, on_delete=models.SET_NULL, null=True, related_name='+')
    
    # Liability Accounts
    
    default_ap_account = models.ForeignKey(Account, on_delete=models.SET_NULL, null=True, related_name='+')
    
    # Revenue & COGS Accounts
   
    default_sales_account = models.ForeignKey(Account, on_delete=models.SET_NULL, null=True, related_name='+')
    default_discount_account = models.ForeignKey(Account, on_delete=models.SET_NULL, null=True, related_name='+')
    default_cogs_account = models.ForeignKey(Account, on_delete=models.SET_NULL, null=True, related_name='+')
    default_inventory_loss_account = models.ForeignKey(Account, on_delete=models.SET_NULL, null=True, related_name='+')
    default_inventory_in_transit_account = models.ForeignKey(Account, on_delete=models.SET_NULL, null=True, related_name='+')
    default_retained_earnings_account = models.ForeignKey(
        'Account', 
        on_delete=models.SET_NULL, 
        null=True, 
        related_name='+'
    )
    # Tax & Compliance Accounts
    default_output_vat_account = models.ForeignKey(Account, on_delete=models.SET_NULL, null=True, related_name='+')
    default_input_vat_account = models.ForeignKey(Account, on_delete=models.SET_NULL, null=True, related_name='+')
    default_wht_payable_account = models.ForeignKey(Account, on_delete=models.SET_NULL, null=True, related_name='+')
    default_tax_expense_account = models.ForeignKey(Account, on_delete=models.SET_NULL, null=True, related_name='+')
    default_tax_payable_account = models.ForeignKey(Account, on_delete=models.SET_NULL, null=True, related_name='+')
    class Meta:
        db_table = 'accounting_settings'


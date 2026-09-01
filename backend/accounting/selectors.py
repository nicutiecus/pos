from django.db.models import Sum, Q
from django.db.models.functions import Coalesce
from decimal import Decimal
from .models import Account, JournalEntryLine, AccountingSettings
from sales.models import Customer, CustomerLedger
from inventory.models import Supplier, SupplierLedger
from common.models import TenantSettings

def get_general_ledger(*, tenant, start_date=None, end_date=None, account_id=None):
    """
    Retrieves journal entry lines filtered by date range and/or specific account.
    """
    filters = Q(journal_entry__tenant=tenant)
    
    if start_date:
        filters &= Q(journal_entry__date__gte=start_date)
    if end_date:
        filters &= Q(journal_entry__date__lte=end_date)
    if account_id:
        filters &= Q(account_id=account_id)

    # select_related optimizes the query by fetching parent journal and account data in a single SQL join
    return JournalEntryLine.objects.filter(filters).select_related(
        'journal_entry', 'account', 'journal_entry__branch'
    ).order_by('journal_entry__date', 'id')


def get_trial_balance(*, tenant, as_of_date=None):
    """
    Calculates the aggregated debits and credits for all active accounts up to a specific date.
    """
    line_filters = Q()
    if as_of_date:
        line_filters &= Q(journalentryline__journal_entry__date__lte=as_of_date)

    # Annotate each account with the sum of its debits and credits
    accounts = Account.objects.filter(tenant=tenant, is_active=True).annotate(
        total_debit=Coalesce(Sum('journalentryline__debit', filter=line_filters), Decimal('0.00')),
        total_credit=Coalesce(Sum('journalentryline__credit', filter=line_filters), Decimal('0.00'))
    ).order_by('code')

    return accounts


def get_receivables(*, tenant):
    """Returns customers with an active debt balance, ordered by highest debt[cite: 1]."""
    return Customer.objects.filter(
        tenant=tenant, 
        current_debt__gt=0
    ).order_by('-current_debt')

def get_customer_ledger(*, tenant, customer_id: str):
    """Returns the chronological ledger entries for a specific customer[cite: 1]."""
    return CustomerLedger.objects.filter(
        tenant=tenant, 
        customer_id=customer_id
    ).order_by('-created_at')

def get_payables(*, tenant):
    """Returns suppliers the business owes money to, ordered by highest debt[cite: 1]."""
    return Supplier.objects.filter(
        tenant=tenant, 
        current_debt__gt=0
    ).order_by('-current_debt')

def get_supplier_ledger(*, tenant, supplier_id: str):
    """Returns the chronological ledger entries for a specific supplier[cite: 1]."""
    return SupplierLedger.objects.filter(
        tenant=tenant, 
        supplier_id=supplier_id
    ).order_by('-created_at')


def get_account_balances_by_type(*, tenant, account_types: list, start_date=None, end_date=None):
    """Base aggregator for accounts by type."""
    line_filters = Q()
    if start_date:
        line_filters &= Q(journalentryline__journal_entry__date__gte=start_date)
    if end_date:
        line_filters &= Q(journalentryline__journal_entry__date__lte=end_date)
        
    return Account.objects.filter(
        tenant=tenant, 
        is_active=True, 
        account_type__in=account_types
    ).annotate(
        total_debit=Coalesce(Sum('journalentryline__debit', filter=line_filters), Decimal('0.00')),
        total_credit=Coalesce(Sum('journalentryline__credit', filter=line_filters), Decimal('0.00'))
    ).order_by('code')

def get_cash_and_bank_balances(*, tenant, as_of_date=None):
    """Returns balances for identified cash and bank accounts."""
    line_filters = Q()
    if as_of_date:
        line_filters &= Q(journalentryline__journal_entry__date__lte=as_of_date)

    # Attempt to use mapped accounts, fallback to name heuristics if mapping is missing
    try:
        settings = tenant.accounting_settings
        account_ids = [
            settings.default_cash_account_id, 
            settings.default_pos_account_id, 
            settings.default_transfer_account_id
        ]
        qs = Account.objects.filter(tenant=tenant, id__in=[x for x in account_ids if x])
    except:
        qs = Account.objects.filter(
            tenant=tenant, account_type='Asset'
        ).filter(Q(name__icontains='cash') | Q(name__icontains='bank') | Q(name__icontains='pos'))

    return qs.annotate(
        total_debit=Coalesce(Sum('journalentryline__debit', filter=line_filters), Decimal('0.00')),
        total_credit=Coalesce(Sum('journalentryline__credit', filter=line_filters), Decimal('0.00'))
    )

def get_profit_and_loss(*, tenant, start_date=None, end_date=None):
    """Calculates Revenue, COGS, and Operating Expenses."""
    revenues = get_account_balances_by_type(
        tenant=tenant, account_types=['Revenue'], start_date=start_date, end_date=end_date
    )
    expenses = get_account_balances_by_type(
        tenant=tenant, account_types=['Expense'], start_date=start_date, end_date=end_date
    )

    total_revenue = sum(acc.total_credit - acc.total_debit for acc in revenues)
    
    # Separate COGS from standard expenses if possible by name/code heuristic
    cogs_accounts = [acc for acc in expenses if 'cost of goods' in acc.name.lower() or 'cogs' in acc.name.lower()]
    op_expenses = [acc for acc in expenses if acc not in cogs_accounts]

    total_cogs = sum(acc.total_debit - acc.total_credit for acc in cogs_accounts)
    total_op_expenses = sum(acc.total_debit - acc.total_credit for acc in op_expenses)
    
    gross_profit = total_revenue - total_cogs
    net_profit = gross_profit - total_op_expenses

    return {
        "revenues": revenues,
        "cogs": cogs_accounts,
        "operating_expenses": op_expenses,
        "totals": {
            "total_revenue": total_revenue,
            "total_cogs": total_cogs,
            "gross_profit": gross_profit,
            "total_operating_expenses": total_op_expenses,
            "net_profit": net_profit
        }
    }

def get_balance_sheet(*, tenant, as_of_date=None):
    """Calculates Assets, Liabilities, and Equity."""
    assets = get_account_balances_by_type(tenant=tenant, account_types=['Asset'], end_date=as_of_date)
    liabilities = get_account_balances_by_type(tenant=tenant, account_types=['Liability'], end_date=as_of_date)
    equity = get_account_balances_by_type(tenant=tenant, account_types=['Equity'], end_date=as_of_date)

    total_assets = sum(acc.total_debit - acc.total_credit for acc in assets)
    total_liabilities = sum(acc.total_credit - acc.total_debit for acc in liabilities)
    total_equity = sum(acc.total_credit - acc.total_debit for acc in equity)

    # Add current period Net Income to Equity to balance the sheet
    pl = get_profit_and_loss(tenant=tenant, end_date=as_of_date)
    retained_earnings = pl['totals']['net_profit']

    return {
        "assets": assets,
        "liabilities": liabilities,
        "equity": equity,
        "totals": {
            "total_assets": total_assets,
            "total_liabilities": total_liabilities,
            "total_equity_base": total_equity,
            "retained_earnings": retained_earnings,
            "total_liabilities_and_equity": total_liabilities + total_equity + retained_earnings
        }
    }

def get_cash_flow(*, tenant, start_date=None, end_date=None):
    """Summarizes total cash inflows and outflows."""
    cash_accounts = get_cash_and_bank_balances(tenant=tenant, as_of_date=end_date)
    
    # Filter for the specific period to get net changes
    period_cash = get_account_balances_by_type(
        tenant=tenant, 
        account_types=['Asset'], 
        start_date=start_date, 
        end_date=end_date
    ).filter(id__in=[acc.id for acc in cash_accounts])

    inflows = sum(acc.total_debit for acc in period_cash)
    outflows = sum(acc.total_credit for acc in period_cash)
    net_cash_change = inflows - outflows

    return {
        "accounts": period_cash,
        "totals": {
            "total_inflows": inflows,
            "total_outflows": outflows,
            "net_cash_change": net_cash_change
        }
    }

def get_tax_report(*, tenant, start_date=None, end_date=None):
    """Calculates tax liability based on revenue and tenant tax rate settings[cite: 1]."""
    settings = TenantSettings.objects.get(tenant=tenant)
    tax_rate = Decimal(settings.tax_rate) / Decimal('100.0')
    
    pl = get_profit_and_loss(tenant=tenant, start_date=start_date, end_date=end_date)
    taxable_revenue = pl['totals']['total_revenue']
    estimated_tax_liability = taxable_revenue * tax_rate

    # If you have an explicit Tax Payable liability account, you would query it here
    tax_accounts = get_account_balances_by_type(
        tenant=tenant, account_types=['Liability'], start_date=start_date, end_date=end_date
    ).filter(name__icontains='tax')

    actual_tax_collected = sum(acc.total_credit - acc.total_debit for acc in tax_accounts)

    return {
        "tax_rate_percentage": settings.tax_rate,
        "taxable_revenue": taxable_revenue,
        "estimated_tax_liability": estimated_tax_liability,
        "actual_tax_collected_in_ledger": actual_tax_collected,
        "tax_liability_accounts": tax_accounts
    }


def get_accounting_settings(*, tenant):
    """
    Retrieves the accounting settings for the tenant. Creates default settings if none exist.
    """
    settings, created = AccountingSettings.objects.get_or_create(tenant=tenant)
    return settings
from django.db.models import Sum, Q
from django.db.models.functions import Coalesce
from django.core.exceptions import ObjectDoesNotExist
from decimal import Decimal
from .models import Account, JournalEntryLine, AccountingSettings, JournalEntry, FinancialYear
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
        # Try matching by ID first. If it's a non-numeric string (e.g. '400-A'), 
        # it falls back to querying the code to avoid ValueError crashes.
        if str(account_id).isdigit():
            filters &= (Q(account_id=account_id) | Q(account__code=account_id))
        else:
            filters &= Q(account__code=account_id)

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


def get_account_balances_by_type(*, tenant, account_types: list, start_date=None, end_date=None, exclude_closing_entries=False):
    """Base aggregator for accounts by type."""
    line_filters = Q()
    if start_date:
        line_filters &= Q(journalentryline__journal_entry__date__gte=start_date)
    if end_date:
        line_filters &= Q(journalentryline__journal_entry__date__lte=end_date)

    if exclude_closing_entries:
        line_filters &= Q(journalentryline__journal_entry__is_closing_entry=False)
        
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

def get_profit_and_loss(*, tenant, start_date=None, end_date=None, include_closing_entries=False):
    """Calculates a multi-step Income Statement based on strict account subtypes."""
    exclude_closing= not include_closing_entries
    revenues = get_account_balances_by_type(
        tenant=tenant, account_types=['Revenue'], start_date=start_date, end_date=end_date, 
        exclude_closing_entries=exclude_closing
    )
    expenses = get_account_balances_by_type(
        tenant=tenant, account_types=['Expense'], start_date=start_date, end_date=end_date,
        exclude_closing_entries=exclude_closing
            
    )

    # 1. Categorize Revenues
    sales_revenue, other_operating_revenue, other_income = [], [], []
    for acc in revenues:
        if acc.account_sub_type == 'Other Operating Revenue':
            other_operating_revenue.append(acc)
        elif acc.account_sub_type == 'Other Income':
            other_income.append(acc)
        else:
            # Default unclassified revenue to Sales Revenue
            sales_revenue.append(acc)

    # 2. Categorize Expenses
    cogs, operating_expenses, finance_costs, tax_expenses, other_expenses = [], [], [], [], []
    for acc in expenses:
        if acc.account_sub_type == 'Cost of Goods Sold':
            cogs.append(acc)
        elif acc.account_sub_type == 'Finance Cost':
            finance_costs.append(acc)
        elif acc.account_sub_type == 'Tax Expense':
            tax_expenses.append(acc)
        elif acc.account_sub_type == 'Other Expense':
            other_expenses.append(acc)
        else:
            # Default unclassified expenses to Operating Expenses
            operating_expenses.append(acc)

    # Helper to calculate net balances
    def sum_net(acc_list, is_revenue=True):
        if is_revenue:
            return sum(acc.total_credit - acc.total_debit for acc in acc_list)
        return sum(acc.total_debit - acc.total_credit for acc in acc_list)

    # 3. Calculate Totals
    t_sales_revenue = sum_net(sales_revenue, True)
    t_other_op_revenue = sum_net(other_operating_revenue, True)
    t_other_income = sum_net(other_income, True)

    t_cogs = sum_net(cogs, False)
    t_op_expenses = sum_net(operating_expenses, False)
    t_finance_costs = sum_net(finance_costs, False)
    t_tax_expenses = sum_net(tax_expenses, False)
    t_other_expenses = sum_net(other_expenses, False)

    # 4. Multi-Step Margins
    gross_profit = t_sales_revenue - t_cogs
    operating_profit = gross_profit + t_other_op_revenue - t_op_expenses
    profit_before_tax = operating_profit + t_other_income - t_other_expenses - t_finance_costs
    net_profit = profit_before_tax - t_tax_expenses

    return {
        "sales_revenue": sales_revenue,
        "other_operating_revenue": other_operating_revenue,
        "other_income": other_income,
        "cogs": cogs,
        "operating_expenses": operating_expenses,
        "finance_costs": finance_costs,
        "tax_expenses": tax_expenses,
        "other_expenses": other_expenses,
        "totals": {
            "total_sales_revenue": t_sales_revenue,
            "total_other_op_revenue": t_other_op_revenue,
            "total_other_income": t_other_income,
            "total_cogs": t_cogs,
            "gross_profit": gross_profit,
            "total_operating_expenses": t_op_expenses,
            "operating_profit": operating_profit,
            "total_finance_costs": t_finance_costs,
            "total_tax_expenses": t_tax_expenses,
            "total_other_expenses": t_other_expenses,
            "profit_before_tax": profit_before_tax,
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
    pl = get_profit_and_loss(tenant=tenant, end_date=as_of_date,include_closing_entries=True)
    current_year_earnings = pl['totals']['net_profit']

    return {
        "assets": assets,
        "liabilities": liabilities,
        "equity": equity,
        "totals": {
            "total_assets": total_assets,
            "total_liabilities": total_liabilities,
            "total_equity_base": total_equity,
            "current_year_earnings": current_year_earnings,
            "total_liabilities_and_equity": total_liabilities + total_equity + current_year_earnings
        }
    }
def get_cash_flow(*, tenant, start_date=None, end_date=None):
    """Summarizes cash inflows and outflows categorized by Operating, Investing, and Financing activities."""
    cash_accounts = get_cash_and_bank_balances(tenant=tenant)
    cash_account_ids = [acc.id for acc in cash_accounts]

    je_filters = Q(tenant=tenant)
    if start_date:
        je_filters &= Q(date__gte=start_date)
    if end_date:
        je_filters &= Q(date__lte=end_date)

    # 1. Find all Journal Entries that involve Cash
    target_jes = JournalEntry.objects.filter(
        je_filters, 
        lines__account_id__in=cash_account_ids
    ).distinct()
    
    # 2. Extract the NON-CASH lines from those entries (The "Why" the cash moved)
    non_cash_lines = JournalEntryLine.objects.filter(
        journal_entry__in=target_jes
    ).exclude(account_id__in=cash_account_ids).select_related('account')

    categories = {
        'Operating': {},
        'Investing': {},
        'Financing': {}
    }

    # 3. Categorize the offsets
    for nc_line in non_cash_lines:
        acc = nc_line.account
        
        # Categorization Logic based on standard accounting rules
        if acc.account_sub_type == 'Non-Current Asset':
            cat = 'Investing'
        elif acc.account_type == 'Equity' or acc.account_sub_type == 'Non-Current Liability':
            cat = 'Financing'
        else:
            # Revenues, Expenses, Current Assets, Current Liabilities
            cat = 'Operating'

        if acc.id not in categories[cat]:
            categories[cat][acc.id] = {
                'account_name': acc.name,
                'account_code': acc.code,
                'inflow': Decimal('0.00'),
                'outflow': Decimal('0.00'),
            }
        
        # IMPORTANT: If the non-cash account is CREDITED, it means Cash was DEBITED (Inflow)
        # If the non-cash account is DEBITED, it means Cash was CREDITED (Outflow)
        categories[cat][acc.id]['inflow'] += nc_line.credit
        categories[cat][acc.id]['outflow'] += nc_line.debit

    # 4. Format the final output
    result = {}
    total_net_change = Decimal('0.00')

    for cat_name, acc_dict in categories.items():
        accounts_list = []
        cat_net = Decimal('0.00')
        
        for acc_id, data in acc_dict.items():
            net_movement = data['inflow'] - data['outflow']
            if net_movement != Decimal('0.00'):
                data['net'] = net_movement
                accounts_list.append(data)
                cat_net += net_movement
        
        # Sort alphabetically by account code
        result[cat_name] = {
            'accounts': sorted(accounts_list, key=lambda x: x['account_code']),
            'net_cash': cat_net
        }
        total_net_change += cat_net

    return {
        "operating_activities": result['Operating'],
        "investing_activities": result['Investing'],
        "financing_activities": result['Financing'],
        "totals": {
            "net_cash_change": total_net_change
        }
    }


def get_tax_report(*, tenant, start_date=None, end_date=None):
    """Calculates Taxable Profit via reconciliation and retrieves VAT/WHT positions."""
    settings = TenantSettings.objects.get(tenant=tenant)
    tax_rate = Decimal(str(settings.tax_rate)) / Decimal('100.0')
    
    # 1. Base Accounting Profit
    pl = get_profit_and_loss(tenant=tenant, start_date=start_date, end_date=end_date)
    accounting_profit = pl['totals']['net_profit']

    #dynamically sum expenses tagged as 'Non-Deductible'
    nd_lines_filter = Q(
        journalentryline__journal_entry__tenant=tenant,
        account_type='Expense',
        is_non_deductible=True
    )
    if start_date:
        nd_lines_filter &= Q(journalentryline__journal_entry__date__gte=start_date)
    if end_date:
        nd_lines_filter &= Q(journalentryline__journal_entry__date__lte=end_date)
    nd_totals = Account.objects.filter(nd_lines_filter).aggregate(
        tot_debit=Coalesce(Sum('journalentryline__debit'), Decimal('0.00')),
        tot_credit=Coalesce(Sum('journalentryline__credit'), Decimal('0.00'))
    )
    # 2. Tax Reconciliation
    # Future-proofed: Here you would 
    non_deductible_expenses = nd_totals['tot_debit']-nd_totals['tot_credit']
    taxable_profit = accounting_profit + non_deductible_expenses
    
    # 3. Estimated Corporate Tax
    estimated_tax_expense = (taxable_profit * tax_rate) if taxable_profit > 0 else Decimal('0.00')
    
    # 4. Fetch Mapped Tax Account Balances
    try:
        acc_settings = tenant.accounting_settings
        tax_ids = {
            "output_vat": acc_settings.default_output_vat_account_id,
            "input_vat": acc_settings.default_input_vat_account_id,
            "wht_payable": acc_settings.default_wht_payable_account_id,
            "tax_expense": acc_settings.default_tax_expense_account_id,
            "tax_payable": acc_settings.default_tax_payable_account_id,
        }
    except ObjectDoesNotExist:
        tax_ids = {k: None for k in ["output_vat", "input_vat", "wht_payable", "tax_expense", "tax_payable"]}
        
    def get_account_net(account_id):
        if not account_id: return Decimal('0.00')
        lines_filter = Q(journalentryline__journal_entry__tenant=tenant, id=account_id)
        if start_date: lines_filter &= Q(journalentryline__journal_entry__date__gte=start_date)
        if end_date: lines_filter &= Q(journalentryline__journal_entry__date__lte=end_date)
        
        acc = Account.objects.filter(lines_filter).annotate(
            total_debit=Coalesce(Sum('journalentryline__debit'), Decimal('0.00')),
            total_credit=Coalesce(Sum('journalentryline__credit'), Decimal('0.00'))
        ).first()
        
        if not acc: return Decimal('0.00')
        # Assets/Expenses increase with Debit; Liabilities/Equity increase with Credit
        if acc.account_type in ['Asset', 'Expense']:
            return acc.total_debit - acc.total_credit
        return acc.total_credit - acc.total_debit

    output_vat = get_account_net(tax_ids["output_vat"])
    input_vat = get_account_net(tax_ids["input_vat"])

    return {
        "tax_rate_percentage": settings.tax_rate,
        "reconciliation": {
            "accounting_profit_before_tax": accounting_profit,
            "non_deductible_expenses": non_deductible_expenses,
            "taxable_profit": taxable_profit,
            "estimated_tax_expense": estimated_tax_expense,
        },
        "balances": {
            "output_vat": output_vat,
            "input_vat": input_vat,
            "net_vat_payable": output_vat - input_vat,
            "wht_payable": get_account_net(tax_ids["wht_payable"]),
            "tax_expense_ledger": get_account_net(tax_ids["tax_expense"]),
            "tax_payable_ledger": get_account_net(tax_ids["tax_payable"]),
        }
    }


def get_accounting_settings(*, tenant):
    """
    Retrieves the accounting settings for the tenant. Creates default settings if none exist.
    """
    settings, created = AccountingSettings.objects.get_or_create(tenant=tenant)
    return settings

def get_opening_balance(*, tenant, account_id, as_of_date):
    """Calculates the historical opening balance of an account prior to the given date."""
    if not as_of_date or not account_id or account_id == 'All':
        return Decimal('0.00')

    try:
        if str(account_id).isdigit():
            account = Account.objects.get(Q(id=account_id) | Q(code=account_id), tenant=tenant)
        else:
            account = Account.objects.get(code=account_id, tenant=tenant)
    except Account.DoesNotExist:
        return Decimal('0.00')

    lines_filter = Q(
        journal_entry__tenant=tenant,
        account=account,
        journal_entry__date__lt=as_of_date
    )

    totals = JournalEntryLine.objects.filter(lines_filter).aggregate(
        tot_debit=Coalesce(Sum('debit'), Decimal('0.00')),
        tot_credit=Coalesce(Sum('credit'), Decimal('0.00'))
    )

    # Calculate according to the account's normal balance
    if account.account_type in ['Asset', 'Expense']:
        return totals['tot_debit'] - totals['tot_credit']
    else:
        return totals['tot_credit'] - totals['tot_debit']


def get_financial_years(*, tenant):
    """Retrieves all financial years and their nested periods, ordered by newest first."""
    return FinancialYear.objects.filter(
        tenant=tenant
    ).prefetch_related('periods').order_by('-start_date')
from django.db import transaction
from django.core.exceptions import ValidationError, ObjectDoesNotExist
from django.db import IntegrityError
from django.utils import timezone
from django.db.models import Sum, Q
from django.db.models.functions import Coalesce
from decimal import Decimal
from .models import Account, JournalEntry, JournalEntryLine, AccountingPeriod, FinancialYear
from common.models import Branch
import logging




logger = logging.getLogger(__name__)

def create_account_service(
    *,
    user,
    name: str,
    code: str,
    account_type: str,
    account_sub_type: str,
    description: str = "",
    is_active: bool = True
) -> Account:
    """
    Creates a new General Ledger account for the tenant's Chart of Accounts.
    """
    # 1. Authorization
    admin_roles = ['Admin', 'Super_Admin', 'Tenant_Admin']
    if user.role not in admin_roles:
        raise ValidationError("You do not have permission to create GL accounts.")

    # 2. Type Validation
    # Assuming your Account model uses standard Django TextChoices for account_type
    valid_types = [choice[0] for choice in Account.AccountType.choices]
    if account_type not in valid_types:
        raise ValidationError(f"Invalid account type. Must be one of: {', '.join(valid_types)}")

    # 3. Tenant-Level Uniqueness Checks
    if Account.objects.filter(tenant=user.tenant, code=code).exists():
        raise ValidationError(f"An account with code '{code}' already exists in your Chart of Accounts.")

    if Account.objects.filter(tenant=user.tenant, name__iexact=name).exists():
        raise ValidationError(f"An account named '{name}' already exists in your Chart of Accounts.")

    # 4. Model Instantiation & Validation
    account = Account(
        tenant=user.tenant,
        name=name.strip(),
        code=code.strip(),
        account_type=account_type,
        account_sub_type= account_sub_type,
        description=description.strip(),
        is_active=is_active
    )
    
    try:
        account.full_clean()
        account.save()
    except IntegrityError:
        # Fallback for race conditions bypassing the .exists() check
        raise ValidationError("Database integrity error. Ensure the account code and name are unique.")
        
    return account


def update_account_service(
    *,
    user,
    account_id: int,
    **data
) -> Account:
    """
    Updates an existing General Ledger account while enforcing tenant boundaries and uniqueness.
    """
    admin_roles = ['Admin', 'Super_Admin', 'Tenant_Admin']
    if user.role not in admin_roles:
        raise ValidationError("You do not have permission to update GL accounts.")

    try:
        # Strict tenant boundary check
        account = Account.objects.get(id=account_id, tenant=user.tenant)
    except Account.DoesNotExist:
        raise ValidationError("Account not found or you do not have permission to access it.")

    # Validate uniqueness if code is being updated
    if 'code' in data and data['code'] != account.code:
        if Account.objects.filter(tenant=user.tenant, code=data['code']).exists():
            raise ValidationError(f"An account with code '{data['code']}' already exists.")

    # Validate uniqueness if name is being updated
    if 'name' in data and data['name'].strip().lower() != account.name.lower():
        if Account.objects.filter(tenant=user.tenant, name__iexact=data['name'].strip()).exists():
            raise ValidationError(f"An account named '{data['name']}' already exists.")

    # Apply updates dynamically
    for field, value in data.items():
        if isinstance(value, str):
            value = value.strip()
        setattr(account, field, value)
    
    try:
        account.full_clean()
        account.save()
    except IntegrityError:
        raise ValidationError("Database integrity error during update.")
        
    return account


@transaction.atomic
def record_journal_entry(*, tenant, branch=None, reference_id=None, description: str, lines_data: list, posting_date =None):
    """
    Records a balanced journal entry.
    lines_data expected format:
    [
        {'account': Account_Instance, 'debit': 5000, 'credit': 0},
        {'account': Account_Instance, 'debit': 0, 'credit': 5000},
    ]
    """
    if not posting_date:
        posting_date = timezone.now().date()

    # 2. Strict Period Locking Validation
    period = AccountingPeriod.objects.filter(
        tenant=tenant,
        start_date__lte=posting_date,
        end_date__gte=posting_date
    ).first()

    if not period:
        raise ValidationError(f"No financial period is configured for the date {posting_date}. Please set up your Financial Year.")
    
    if period.status == AccountingPeriod.Status.CLOSED:
        raise ValidationError(f"The accounting period '{period.name}' is closed. You cannot post transactions to a closed period.")
    total_debit = Decimal('0.00')
    total_credit = Decimal('0.00')

    for line in lines_data:
        total_debit += Decimal(str(line.get('debit', '0.00')))
        total_credit += Decimal(str(line.get('credit', '0.00')))

    # Strict Double-Entry Validation
    if total_debit != total_credit:
        raise ValidationError(f"Journal entry must balance. Debits: {total_debit}, Credits: {total_credit}")

    if total_debit == 0:
        raise ValidationError("Journal entry must have a non-zero value.")

    # Create the Header
    journal_entry = JournalEntry.objects.create(
        tenant=tenant,
        branch=branch,
        reference_id=reference_id,
        description=description,
        posting_date=posting_date,
        period=period,
    )

    # Create the Lines
    for line in lines_data:
        debit_val = Decimal(str(line.get('debit', '0.00')))
        credit_val = Decimal(str(line.get('credit', '0.00')))
        
        # Optimization: Don't write zero-value lines to the DB
        if debit_val > 0 or credit_val > 0:
            JournalEntryLine.objects.create(
                journal_entry=journal_entry,
                account=line['account'],
                debit=debit_val,
                credit=credit_val
            )

    return journal_entry


def record_sale_accounting(*, tenant, branch, order, payments: list, debt_amount: Decimal, total_cost_of_sales: Decimal, posting_date=None):
    """
    Translates a SalesOrder into balanced journal entries.
    Handles Gross Revenue, Discounts (Contra-Revenue), Receivables, Payments, and COGS.
    """

    try:
        settings = tenant.accounting_settings
    except ObjectDoesNotExist:
        return {"success": False, "warning" :"Accounting settings are not initialized for this tenant"}

    if not posting_date:
            posting_date=timezone.now().date()
        
    journal_lines = []
    missing_accounts = []
    
    # Calculate Gross Revenue (Net Total + Discount)
    gross_revenue = order.total_amount + order.discount_amount

    if not settings.default_sales_account:
        missing_accounts.append("Sales Revenue")
    else:
        journal_lines.append({'account': settings.default_sales_account, 'debit': Decimal('0.00'), 'credit': gross_revenue})
    
   

    # 2. Debit Sales Discounts (Contra-Revenue)
    if order.discount_amount > 0:
        if not settings.default_discount_account:
            missing_accounts.append("Sales Discount")
        else:
            journal_lines.append({'account': settings.default_discount_account, 'debit': order.discount_amount, 'credit': Decimal('0.00')})

    # 3. Debit Payments (Cash, POS, Transfer)
    for payment_data in payments:
        amount = Decimal(str(payment_data['amount']))
        method = payment_data['method']
        
        if amount > 0:
            payment_account = None
            if method == 'Cash':
                payment_account = settings.default_cash_account
            elif method == 'POS':
                payment_account = settings.default_pos_account
            elif method == 'Transfer':
                payment_account = settings.default_transfer_account
            if not payment_account:
                missing_accounts.append(f"{method} Payment")
            else:
                journal_lines.append({'account': payment_account, 'debit': amount, 'credit': Decimal('0.00') })
                

    # 4. Debit Accounts Receivable (Credit Sales)
    if debt_amount > 0:
        if not settings.default_ar_account:
            missing_accounts.append("Accounts Receivable")
        else:
            journal_lines.append({'account': settings.default_ar_account, 'debit': debt_amount, 'credit': Decimal('0.00')})

    # 5. Cost of Goods Sold (Debit COGS, Credit Inventory)
    if total_cost_of_sales > 0:
        if not settings.default_cogs_account:
            missing_accounts.append("Cost of Goods Sold")
        if not settings.default_inventory_account:
            missing_accounts.append("Inventory Asset")
    
        if settings.default_cogs_account and settings.default_inventory_account:
            journal_lines.append({'account': settings.default_cogs_account, 'debit': total_cost_of_sales, 'credit': Decimal('0.00')})
            journal_lines.append({'account': settings.default_inventory_account, 'debit': Decimal('0.00'), 'credit': total_cost_of_sales})

    if missing_accounts:
        warning_msg = f"Sale recorded, but journal entry skipped. Missing account mappings: {', '.join(set(missing_accounts))}."
        logger.warning(f"Tenant {tenant.id} missing accounting configs: {missing_accounts}")
        return {"success": False, "warning": warning_msg}

    # Execute the balanced transaction
    journal_entry= record_journal_entry(
        tenant=tenant,
        branch=branch,
        reference_id=order.id,
        description=f"Sales Order #{order.id}",
        lines_data=journal_lines
    )

    return {"success": True, "journal_entry": journal_entry}



def record_stock_receipt_accounting(*, tenant, branch, invoice_id: str, total_value: Decimal, debt_amount: Decimal, amount_paid: Decimal, payment_method: str, posting_date=None):
    """
    Translates a Purchase Invoice into balanced journal entries.
    Handles Inventory Assets, Accounts Payable, and Payment credits.
    """
    try:
        settings = tenant.accounting_settings
    except ObjectDoesNotExist:
        return {"success": False, "warning" :"Accounting settings are not initialized for this tenant"}

    if not posting_date:
        posting_date=timezone.now().date()
        
    journal_lines = []
    missing_accounts= []
    
    # 1. Debit Inventory (Asset increases)
    inventory_account = settings.default_inventory_account
    if not inventory_account:
        missing_accounts.append("Inventory Account")
    else:  
        journal_lines.append({'account': inventory_account, 'debit': total_value, 'credit': Decimal('0.00')})
    
    # 2. Credit Accounts Payable (Liability increases for unpaid portions)
    if debt_amount > 0:
        ap_account = settings.default_ap_account
        if not ap_account:
            missing_accounts.append("Accounts Payable")
        else:            
            journal_lines.append({'account': ap_account, 'debit': Decimal('0.00'), 'credit': debt_amount})

      
    # 3. Credit Payment Account (Asset decreases for paid portions)

    method = payment_method
    if amount_paid > 0:
        payment_account = None
        if method == 'Cash':
            payment_account = settings.default_cash_account
        elif method == 'POS':
            payment_account = settings.default_pos_account
        elif method == 'Transfer':
            payment_account = settings.default_transfer_account
        else:
            raise ValidationError(f"Unknown payment method: {payment_method}")

        if not payment_account:
            missing_accounts.append(f"{method} Account")
        else:         
            journal_lines.append({'account': payment_account, 'debit': Decimal('0.00'), 'credit': amount_paid})

    
    if missing_accounts:
        warning_msg = f"Sale recorded, but journal entry skipped. Missing account mappings: {', '.join(set(missing_accounts))}."
        logger.warning(f"Tenant {tenant.id} missing accounting configs: {missing_accounts}")
        return {"success": False, "warning": warning_msg}

    
    record_journal_entry(
        tenant=tenant,
        branch=branch,
        reference_id=invoice_id,
        description=f"Stock Received - Invoice #{invoice_id}",
        lines_data=journal_lines,
        posting_date=posting_date
    )

def record_stock_removal_accounting(*, tenant, branch, reference_id: str, loss_value: Decimal, reason: str):
    """
    Records the financial loss of inventory being removed or damaged.
    """
    if loss_value <= 0:
        return

    try:
        settings = tenant.accounting_settings
    except ObjectDoesNotExist:
        return {"success": False, "warning" :"Accounting settings are not initialized for this tenant"}

    missing_accounts= []

    inventory_account = settings.default_inventory_account
    if not settings.default_inventory_account:
        missing_accounts.append("Inventory Account")

    loss_account = settings.default_inventory_loss_account
    if not settings.default_inventory_loss_account:
        missing_accounts.append("Inventory Loss Account")
    
    
    if missing_accounts:
        warning_msg = f"Sale recorded, but journal entry skipped. Missing account mappings: {', '.join(set(missing_accounts))}."
        logger.warning(f"Tenant {tenant.id} missing accounting configs: {missing_accounts}")
        return {"success": False, "warning": warning_msg}
        
    record_journal_entry(
        tenant=tenant,
        branch=branch,
        reference_id=reference_id,
        description=f"Stock Removal: {reason}",
        lines_data=[
            {'account': loss_account, 'debit': loss_value, 'credit': Decimal('0.00')},
            {'account': inventory_account, 'debit': Decimal('0.00'), 'credit': loss_value},
        ]
    )


def record_supplier_payment_accounting(*, tenant, branch, payment_reference: str, amount: Decimal, payment_method: str,
                                       posting_date=None):
    """
    Translates a supplier debt payment into a balanced journal entry.
    Debits Accounts Payable and Credits the respective Payment Account (Cash/Bank).
    """
    try:
        settings = tenant.accounting_settings
    except ObjectDoesNotExist:
        return {"success": False, "warning" :"Accounting settings are not initialized for this tenant"}

    if not posting_date:
        posting_date=timezone.now().date()
        
    journal_lines = []
    missing_accounts =[]
    
    # 1. Debit Accounts Payable (Liability decreases)
    ap_account = settings.default_ap_account
    if not ap_account:
        missing_accounts.append("Accounts Payable")
    else:
        journal_lines.append({'account': ap_account, 'debit': amount, 'credit': Decimal('0.00')})
    
    # 2. Credit Payment Account (Asset decreases)
    method =payment_method
    payment_account = None
    if method == 'Cash':
        payment_account = settings.default_cash_account
    elif method == 'POS':
        payment_account = settings.default_pos_account
    elif method == 'Transfer':
        payment_account = settings.default_transfer_account
    else:
        raise ValidationError(f"Unknown payment method: {payment_method}")

    if not payment_account:
        missing_accounts.append(f"{method} Account")
    else:    
        journal_lines.append({'account': payment_account, 'debit': Decimal('0.00'), 'credit': amount})

    if missing_accounts:
        warning_msg = f"Sale recorded, but journal entry skipped. Missing account mappings: {', '.join(set(missing_accounts))}."
        logger.warning(f"Tenant {tenant.id} missing accounting configs: {missing_accounts}")
        return {"success": False, "warning": warning_msg}
    
    record_journal_entry(
        tenant=tenant,
        branch=branch,
        reference_id=payment_reference,
        description=f"Supplier Debt Payment - Ref #{payment_reference}",
        lines_data=journal_lines,
        posting_date=posting_date
    )


def record_transfer_initiation_accounting(*, tenant, source_branch, transfer_id: str, total_value: Decimal, posting_date=None):
    """
    Records the financial movement of stock from the source branch into transit.
    """
    try:
            settings = tenant.accounting_settings
    except ObjectDoesNotExist:
            return {"success": False, "warning" :"Accounting settings are not initialized for this tenant"}

    if total_value <= 0:
        return

    if not posting_date:
        posting_date=timezone.now().date()
        
    missing_accounts = []
    transit_account = settings.default_inventory_in_transit_account
    if not transit_account:
        missing_accounts.append("Inventory In Transit")
    
    inventory_account = settings.default_inventory_account
    if not settings.default_inventory_account:
        missing_accounts.append("Inventory Account")
    

    if missing_accounts:
        warning_msg = f"Sale recorded, but journal entry skipped. Missing account mappings: {', '.join(set(missing_accounts))}."
        logger.warning(f"Tenant {tenant.id} missing accounting configs: {missing_accounts}")
        return {"success": False, "warning": warning_msg}
    
    record_journal_entry(
        tenant=tenant,
        branch=source_branch,
        reference_id=f"TRF-INIT-{transfer_id}",
        description=f"Stock Transfer Initiated - Ref #{transfer_id}",
        lines_data=[
            {'account': transit_account, 'debit': total_value, 'credit': Decimal('0.00')},
            {'account': inventory_account, 'debit': Decimal('0.00'), 'credit': total_value},
        ],
        posting_date=posting_date
    )

def record_transfer_acceptance_accounting(*, tenant, dest_branch, transfer_id: str, total_value: Decimal, posting_date=None):
    """
    Records the financial arrival of stock at the destination branch.
    """
    if total_value <= 0:
        return
    try:
        settings = tenant.accounting_settings
    except ObjectDoesNotExist:
        return {"success": False, "warning" :"Accounting settings are not initialized for this tenant"}

    if not posting_date:
        posting_date=timezone.now().date()
        
    missing_accounts=[]

    inventory_account = settings.default_inventory_account 
    if not settings.default_inventory_account:
        missing_accounts.append("Inventory Account")
    
    transit_account = settings.default_inventory_in_transit_account
    if not settings.default_inventory_in_transit_account:
        missing_accounts.append("Inventory In Transit Account")


    
    if missing_accounts:
        warning_msg = f"Sale recorded, but journal entry skipped. Missing account mappings: {', '.join(set(missing_accounts))}."
        logger.warning(f"Tenant {tenant.id} missing accounting configs: {missing_accounts}")
        return {"success": False, "warning": warning_msg}
    
    
    record_journal_entry(
        tenant=tenant,
        branch=dest_branch,
        reference_id=f"TRF-ACC-{transfer_id}",
        description=f"Stock Transfer Accepted - Ref #{transfer_id}",
        lines_data=[
            {'account': inventory_account, 'debit': total_value, 'credit': Decimal('0.00')},
            {'account': transit_account, 'debit': Decimal('0.00'), 'credit': total_value},
        ],
        posting_date=posting_date
    )

def record_transfer_rejection_accounting(*, tenant, source_branch, transfer_id: str, total_value: Decimal, posting_date=None):
    """
    Records the financial return of rejected stock back to the source branch.
    """
    if total_value <= 0:
        return

    try:
        settings = tenant.accounting_settings
    except ObjectDoesNotExist:
        return {"success": False, "warning" :"Accounting settings are not initialized for this tenant"}

    if not posting_date:
            posting_date=timezone.now().date()
        
    missing_accounts=[]

    if not settings.default_inventory_account:
        missing_accounts.append("Inventory Account")
    else:
        inventory_account = settings.default_inventory_account

    if not settings.default_inventory_in_transit_account:
        missing_accounts.append("Inventory In Transit")
    else:
        transit_account = settings.default_inventory_in_transit_account

    
    if missing_accounts:
        warning_msg = f"Sale recorded, but journal entry skipped. Missing account mappings: {', '.join(set(missing_accounts))}."
        logger.warning(f"Tenant {tenant.id} missing accounting configs: {missing_accounts}")
        return {"success": False, "warning": warning_msg}
    
    
    record_journal_entry(
        tenant=tenant,
        branch=source_branch,
        reference_id=f"TRF-REJ-{transfer_id}",
        description=f"Stock Transfer Rejected & Returned - Ref #{transfer_id}",
        lines_data=[
            {'account': inventory_account, 'debit': total_value, 'credit': Decimal('0.00')},
            {'account': transit_account, 'debit': Decimal('0.00'), 'credit': total_value},
        ],
        posting_date=posting_date
    )


def record_customer_debt_payment_accounting(*, tenant, branch, payment_reference: str, 
                                            amount: Decimal, payment_method: str, posting_date=None):
    """
    Translates a customer debt payment into a balanced journal entry.
    Debits the Payment Account (Cash/Bank) and Credits Accounts Receivable.
    """
    try:
        settings = tenant.accounting_settings
    except ObjectDoesNotExist:
        return {"success": False, "warning" :"Accounting settings are not initialized for this tenant"}
    if not posting_date:
        posting_date=timezone.now().date()
    
    journal_lines = []
    missing_accounts = []

    # 1. Debit Payment Account (Asset increases)
    method = payment_method

    payment_account = None
    if method == 'Cash':
        payment_account = settings.default_cash_account
    elif method == 'POS':
        payment_account = settings.default_pos_account
    elif method == 'Transfer':
        payment_account = settings.default_transfer_account
    else:
        raise ValidationError(f"Unknown payment method: {payment_method}")

    if not payment_account:
        missing_accounts.append(f"{method} Account")
    else:
        journal_lines.append({'account': payment_account, 'debit': amount, 'credit': Decimal('0.00')})

    # 2. Credit Accounts Receivable (Asset decreases)
    if not settings.default_ar_account:
        missing_accounts.append("Accounts Receivable")
    else:
        ar_account = settings.default_ar_account
        journal_lines.append({'account': ar_account, 'debit': Decimal('0.00'), 'credit': amount})

    
    if missing_accounts:
        warning_msg = f"Sale recorded, but journal entry skipped. Missing account mappings: {', '.join(set(missing_accounts))}."
        logger.warning(f"Tenant {tenant.id} missing accounting configs: {missing_accounts}")
        return {"success": False, "warning": warning_msg}

    record_journal_entry(
        tenant=tenant,
        branch=branch,
        reference_id=payment_reference,
        description=f"Customer Debt Payment - Ref #{payment_reference}",
        lines_data=journal_lines,
        posting_date=posting_date
    )


def record_void_sale_accounting(*, tenant, branch, order, payments: list, debt_amount: Decimal, 
                                total_cost_of_sales: Decimal, posting_date=None):
    """
    Reverses the financial impact of a sales order.
    Debits Revenue, Credits Payments/Receivables, and reverses COGS.
    """
    try:
        settings = tenant.accounting_settings
    except ObjectDoesNotExist:
        return {"success": False, "warning" :"Accounting settings are not initialized for this tenant"}

    if not posting_date:
        posting_date=timezone.now().date()
    
    journal_lines = []
    missing_accounts = []
    
    # Calculate Original Gross Revenue
    gross_revenue = order.total_amount + order.discount_amount
    
    # 1. Debit Sales Revenue (Reverse Gross)
    if not settings.default_sales_account:
        missing_accounts.append("")
    else:
        revenue_account = settings.default_sales_account
        journal_lines.append({'account': revenue_account, 'debit': gross_revenue, 'credit': Decimal('0.00')})

    # 2. Credit Sales Discounts (Reverse Contra-Revenue)
    if order.discount_amount > 0:
        if not settings.default_discount_account:
            missing_accounts.append("Discount Account")
        else:
            discount_account = settings.default_discount_account
            journal_lines.append({'account': discount_account, 'debit': Decimal('0.00'), 'credit': order.discount_amount})

    # 3. Credit Payments (Reverse Cash, POS, Transfer)
    for payment in payments:
        amount = Decimal(str(payment.amount))
        method = payment.method

        payment_account = None

        if amount > 0:
            if method == 'Cash':
                payment_account = settings.default_cash_account
            elif method == 'POS':
                payment_account = settings.default_pos_account
            elif method == 'Transfer':
                payment_account = settings.default_transfer_account
            else:
                raise ValidationError(f"Unknown payment method: {method}")

            if not payment_account:
                missing_accounts.append(f"{method} Account")
            else:   
                journal_lines.append({'account': payment_account, 'debit': Decimal('0.00'), 'credit': amount})

    # 4. Credit Accounts Receivable (Reverse Credit Sales)
    if debt_amount > 0:
        ar_account = settings.default_ar_account
        if not ar_account:
            missing_accounts.append("Accounts receivable")
        else:
            journal_lines.append({'account': ar_account, 'debit': Decimal('0.00'), 'credit': debt_amount})

    # 5. Reverse Cost of Goods Sold (Debit Inventory, Credit COGS)
    if total_cost_of_sales > 0:
        cogs_account= settings.default_cogs_account
        inventory_account = settings.default_inventory_account
        if not cogs_account:
            missing_accounts.append("Cost of Goods Sold")

        
        if not settings.default_inventory_account:
            missing_accounts.append("Inventory account")
        

        if cogs_account and inventory_account:
            journal_lines.append({'account': inventory_account, 'debit': total_cost_of_sales, 'credit': Decimal('0.00')})
            journal_lines.append({'account': cogs_account, 'debit': Decimal('0.00'), 'credit': total_cost_of_sales})
    
    if missing_accounts:
        warning_msg = f"Sale recorded, but journal entry skipped. Missing account mappings: {', '.join(set(missing_accounts))}."
        logger.warning(f"Tenant {tenant.id} missing accounting configs: {missing_accounts}")
        return {"success": False, "warning": warning_msg}
    # Execute the balanced transaction reversal
    record_journal_entry(
        tenant=tenant,
        branch=branch,
        reference_id=f"VOID-{order.id}",
        description=f"Voided Sales Order #{order.id}",
        lines_data=journal_lines,
        posting_date=posting_date
    )


def record_expense_accounting(
    *, 
    tenant, 
    branch, 
    expense_id: str, 
    amount: Decimal, 
    expense_account: Account,
    payment_method: str, 
    description: str,
    posting_date=None
):
    """
    Translates a mapped expense into a balanced journal entry.
    """
    try:
        settings = tenant.accounting_settings
    except ObjectDoesNotExist:
        return {"success": False, "warning": "Accounting settings are not initialized for this tenant"}
    if not posting_date:
        posting_date=timezone.now().date()
    journal_lines = []
    missing_accounts = []
    
    # 1. Debit the Specific Mapped Expense Account
    journal_lines.append({'account': expense_account, 'debit': amount, 'credit': Decimal('0.00')})

    method = payment_method
    # 2. Credit the Payment Account (Asset decreases)
    payment_account = None

    if method == 'Cash':
        payment_account = settings.default_cash_account
    elif method == 'POS':
        payment_account = settings.default_pos_account
    elif method == 'Transfer':
        payment_account = settings.default_transfer_account
    else:
        raise ValidationError(f"Unknown payment method: {payment_method}")

    if not payment_account:
        missing_accounts.append(f"{method} Account")
    else:
        journal_lines.append({'account': payment_account, 'debit': Decimal('0.00'), 'credit': amount})

    if missing_accounts:
        warning_msg = f"Sale recorded, but journal entry skipped. Missing account mappings: {', '.join(set(missing_accounts))}."
        logger.warning(f"Tenant {tenant.id} missing accounting configs: {missing_accounts}")
        return {"success": False, "warning": warning_msg}

    record_journal_entry(
        tenant=tenant,
        branch=branch,
        reference_id=f"EXP-{expense_id}",
        description=f"Expense: {description}",
        lines_data=journal_lines,
        posting_date=posting_date
    )


@transaction.atomic
def create_manual_journal_entry(*, user, reference_id: str = None, description: str, branch_id=None, lines: list, posting_date=None):
    """
    Validates and constructs a manual journal entry from API data.
    """
    branch = None
    if branch_id:
        try:
            branch = Branch.objects.get(id=branch_id, tenant=user.tenant)
        except Branch.DoesNotExist:
            raise ValidationError("Branch not found or you lack permission to access it.")

    if not posting_date:
        posting_date=timezone.now().date()

    lines_data = []
    for line in lines:
        try:
            account = Account.objects.get(id=line['account_id'], tenant=user.tenant)
        except Account.DoesNotExist:
            raise ValidationError(f"Account ID {line['account_id']} not found in your Chart of Accounts.")
        
        lines_data.append({
            'account': account,
            'debit': line.get('debit', 0),
            'credit': line.get('credit', 0)
        })

    # Leverages the existing validation and insertion logic
    return record_journal_entry(
        tenant=user.tenant,
        branch=branch,
        reference_id=reference_id,
        description=description,
        lines_data=lines_data,
        posting_date=posting_date
    )

@transaction.atomic
def reverse_journal_entry_service(*, user, journal_entry_id: int):
    """
    Creates a new journal entry that exactly reverses a previous one by swapping debits/credits.
    """
    try:
        original_entry = JournalEntry.objects.prefetch_related('lines').get(
            id=journal_entry_id, 
            tenant=user.tenant
        )
    except JournalEntry.DoesNotExist:
        raise ValidationError("Original journal entry not found.")

    new_description = f"Reversal of Entry #{original_entry.id}: {original_entry.description}"

    lines_data = []
    for line in original_entry.lines.all():
        lines_data.append({
            'account': line.account,
            'debit': line.credit,  # Swap
            'credit': line.debit   # Swap
        })

    return record_journal_entry(
        tenant=user.tenant,
        branch=original_entry.branch,
        reference_id=original_entry.reference_id,
        description=new_description,
        lines_data=lines_data
    )


@transaction.atomic
def reverse_debt_payment_journal_service(*, tenant, payment, user, reason: str = ""):
    """
    Handles the strict double-entry General Ledger reversal for a voided debt payment.
    Finds the original journal entry and processes the Debits/Credits reversal.
    """
    try:
        # Assuming your system saves the payment ID as the reference_id on the JournalEntry
        original_journal = JournalEntry.objects.get(
            tenant=tenant,
            reference_id=str(payment.id)
        )
        
        # Utilize your existing core GL reversal service
        reverse_journal_entry_service(
            user=user,
            journal_entry_id=original_journal.id
        )
        
    except JournalEntry.DoesNotExist:
        # If no GL entry was created for the original payment (e.g., legacy data), 
        # fail silently or log the anomaly depending on system strictness.
        pass


@transaction.atomic
def perform_year_end_close_service(*, user, financial_year_id: int):
    """
    Zeroes out all Revenue and Expense accounts for the given financial year,
    posts the net income to Retained Earnings, and locks the periods.
    """
    # 1. Fetch and Lock the Financial Year
    fy = FinancialYear.objects.select_for_update().get(id=financial_year_id, tenant=user.tenant)
    
    if fy.is_closed:
        raise ValidationError(f"Financial year '{fy.name}' is already closed.")
        
    settings = getattr(user.tenant, 'accounting_settings', None)
    if not settings or not settings.default_retained_earnings_account:
        raise ValidationError("A Default Retained Earnings account must be configured in Accounting Settings before performing a year-end close.")
        
    retained_earnings_account = settings.default_retained_earnings_account

    # 2. Fetch P&L Accounts (Revenues and Expenses)
    pl_accounts = Account.objects.filter(
        tenant=user.tenant, 
        account_type__in=['Revenue', 'Expense']
    )
    
    # 3. Calculate the net balance of each P&L account strictly within this Financial Year
    lines_filter = Q(
        journalentryline__journal_entry__date__gte=fy.start_date,
        journalentryline__journal_entry__date__lte=fy.end_date,
        journalentryline__journal_entry__tenant=user.tenant
    )
    
    account_balances = pl_accounts.annotate(
        total_debit=Coalesce(Sum('journalentryline__debit', filter=lines_filter), Decimal('0.00')),
        total_credit=Coalesce(Sum('journalentryline__credit', filter=lines_filter), Decimal('0.00'))
    )
    
    closing_lines = []
    net_income = Decimal('0.00')
    
    # 4. Generate Reversing Lines
    for acc in account_balances:
        # Standardize balance (Credit - Debit). 
        # Positive = Net Credit (typical for Revenue). Negative = Net Debit (typical for Expense).
        balance = acc.total_credit - acc.total_debit 
        
        if balance == Decimal('0.00'):
            continue
            
        net_income += balance
        
        if balance > 0:
            # To zero out a Credit balance, we Debit it
            closing_lines.append({
                'account': acc,
                'debit': balance,
                'credit': Decimal('0.00')
            })
        elif balance < 0:
            # To zero out a Debit balance, we Credit it
            closing_lines.append({
                'account': acc,
                'debit': Decimal('0.00'),
                'credit': abs(balance)
            })
            
    if not closing_lines:
        raise ValidationError("No revenue or expense transactions were found for this financial year.")
        
    # 5. Post the Net Offset to Retained Earnings
    if net_income > 0:
        # Profit: Credit Retained Earnings
        closing_lines.append({
            'account': retained_earnings_account,
            'debit': Decimal('0.00'),
            'credit': net_income
        })
    elif net_income < 0:
        # Loss: Debit Retained Earnings
        closing_lines.append({
            'account': retained_earnings_account,
            'debit': abs(net_income),
            'credit': Decimal('0.00')
        })
        
    # 6. Record the Closing Journal Entry
    # This must run while the final period is still open
    closing_entry = record_journal_entry(
        tenant=user.tenant,
        description=f"Year-End Close for {fy.name}",
        lines_data=closing_lines,
        posting_date=fy.end_date
    )
    
    # 7. Lock the Financial Year and all related periods
    fy.is_closed = True
    fy.save(update_fields=['is_closed'])
    
    fy.periods.update(status=AccountingPeriod.Status.CLOSED)
    
    return closing_entry
from django.db import transaction
from django.core.exceptions import ValidationError
from django.db import IntegrityError
from decimal import Decimal
from .models import Account, JournalEntry, JournalEntryLine



def create_account_service(
    *,
    user,
    name: str,
    code: str,
    account_type: str,
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



@transaction.atomic
def record_journal_entry(*, tenant, branch=None, reference_id=None, description: str, lines_data: list):
    """
    Records a balanced journal entry.
    lines_data expected format:
    [
        {'account': Account_Instance, 'debit': 5000, 'credit': 0},
        {'account': Account_Instance, 'debit': 0, 'credit': 5000},
    ]
    """
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
        description=description
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


def record_sale_accounting(*, tenant, branch, order, payments: list, debt_amount: Decimal, total_cost_of_sales: Decimal):
    """
    Translates a SalesOrder into balanced journal entries.
    Handles Gross Revenue, Discounts (Contra-Revenue), Receivables, Payments, and COGS.
    """
    journal_lines = []
    
    # Calculate Gross Revenue (Net Total + Discount)
    gross_revenue = order.total_amount + order.discount_amount
    
    # 1. Credit Sales Revenue (Gross)
    revenue_account = Account.objects.get(tenant=tenant, code=tenant.settings.default_sales_account_code)
    journal_lines.append({'account': revenue_account, 'debit': Decimal('0.00'), 'credit': gross_revenue})

    # 2. Debit Sales Discounts (Contra-Revenue)
    if order.discount_amount > 0:
        discount_account = Account.objects.get(tenant=tenant, code=tenant.settings.default_discount_account_code)
        journal_lines.append({'account': discount_account, 'debit': order.discount_amount, 'credit': Decimal('0.00')})

    # 3. Debit Payments (Cash, POS, Transfer)
    for payment_data in payments:
        amount = Decimal(str(payment_data['amount']))
        method = payment_data['method']
        
        if amount > 0:
            if method == 'Cash':
                acc_code = tenant.settings.default_cash_account_code
            elif method == 'POS':
                acc_code = tenant.settings.default_pos_account_code
            elif method == 'Transfer':
                acc_code = tenant.settings.default_transfer_account_code
            else:
                raise ValidationError(f"Unknown payment method: {method}")
                
            payment_account = Account.objects.get(tenant=tenant, code=acc_code)
            journal_lines.append({'account': payment_account, 'debit': amount, 'credit': Decimal('0.00')})

    # 4. Debit Accounts Receivable (Credit Sales)
    if debt_amount > 0:
        ar_account = Account.objects.get(tenant=tenant, code=tenant.settings.default_ar_account_code)
        journal_lines.append({'account': ar_account, 'debit': debt_amount, 'credit': Decimal('0.00')})

    # 5. Cost of Goods Sold (Debit COGS, Credit Inventory)
    if total_cost_of_sales > 0:
        cogs_account = Account.objects.get(tenant=tenant, code=tenant.settings.default_cogs_account_code)
        inventory_account = Account.objects.get(tenant=tenant, code=tenant.settings.default_inventory_account_code)
        
        journal_lines.append({'account': cogs_account, 'debit': total_cost_of_sales, 'credit': Decimal('0.00')})
        journal_lines.append({'account': inventory_account, 'debit': Decimal('0.00'), 'credit': total_cost_of_sales})

    # Execute the balanced transaction
    record_journal_entry(
        tenant=tenant,
        branch=branch,
        reference_id=order.id,
        description=f"Sales Order #{order.id}",
        lines_data=journal_lines
    )



def record_stock_receipt_accounting(*, tenant, branch, invoice_id: str, total_value: Decimal, debt_amount: Decimal, amount_paid: Decimal, payment_method: str):
    """
    Translates a Purchase Invoice into balanced journal entries.
    Handles Inventory Assets, Accounts Payable, and Payment credits.
    """
    journal_lines = []
    
    # 1. Debit Inventory (Asset increases)
    inventory_account = Account.objects.get(tenant=tenant, code=tenant.settings.default_inventory_account_code)
    journal_lines.append({'account': inventory_account, 'debit': total_value, 'credit': Decimal('0.00')})
    
    # 2. Credit Accounts Payable (Liability increases for unpaid portions)
    if debt_amount > 0:
        ap_account = Account.objects.get(tenant=tenant, code=tenant.settings.default_ap_account_code)
        journal_lines.append({'account': ap_account, 'debit': Decimal('0.00'), 'credit': debt_amount})
        
    # 3. Credit Payment Account (Asset decreases for paid portions)
    if amount_paid > 0:
        if payment_method == 'Cash':
            acc_code = tenant.settings.default_cash_account_code
        elif payment_method == 'POS':
            acc_code = tenant.settings.default_pos_account_code
        elif payment_method == 'Transfer':
            acc_code = tenant.settings.default_transfer_account_code
        else:
            raise ValidationError(f"Unknown payment method: {payment_method}")
            
        payment_account = Account.objects.get(tenant=tenant, code=acc_code)
        journal_lines.append({'account': payment_account, 'debit': Decimal('0.00'), 'credit': amount_paid})
        
    record_journal_entry(
        tenant=tenant,
        branch=branch,
        reference_id=invoice_id,
        description=f"Stock Received - Invoice #{invoice_id}",
        lines_data=journal_lines
    )

def record_stock_removal_accounting(*, tenant, branch, reference_id: str, loss_value: Decimal, reason: str):
    """
    Records the financial loss of inventory being removed or damaged.
    """
    if loss_value <= 0:
        return

    inventory_account = Account.objects.get(tenant=tenant, code=tenant.settings.default_inventory_account_code)
    loss_account = Account.objects.get(tenant=tenant, code=tenant.settings.default_inventory_loss_account_code)
    
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


def record_supplier_payment_accounting(*, tenant, branch, payment_reference: str, amount: Decimal, payment_method: str):
    """
    Translates a supplier debt payment into a balanced journal entry.
    Debits Accounts Payable and Credits the respective Payment Account (Cash/Bank).
    """
    journal_lines = []
    
    # 1. Debit Accounts Payable (Liability decreases)
    ap_account = Account.objects.get(tenant=tenant, code=tenant.settings.default_ap_account_code)
    journal_lines.append({'account': ap_account, 'debit': amount, 'credit': Decimal('0.00')})
    
    # 2. Credit Payment Account (Asset decreases)
    if payment_method == 'Cash':
        acc_code = tenant.settings.default_cash_account_code
    elif payment_method == 'POS':
        acc_code = tenant.settings.default_pos_account_code
    elif payment_method == 'Transfer':
        acc_code = tenant.settings.default_transfer_account_code
    else:
        raise ValidationError(f"Unknown payment method: {payment_method}")
        
    payment_account = Account.objects.get(tenant=tenant, code=acc_code)
    journal_lines.append({'account': payment_account, 'debit': Decimal('0.00'), 'credit': amount})
    
    record_journal_entry(
        tenant=tenant,
        branch=branch,
        reference_id=payment_reference,
        description=f"Supplier Debt Payment - Ref #{payment_reference}",
        lines_data=journal_lines
    )


def record_transfer_initiation_accounting(*, tenant, source_branch, transfer_id: str, total_value: Decimal):
    """
    Records the financial movement of stock from the source branch into transit.
    """
    if total_value <= 0:
        return

    transit_account = Account.objects.get(tenant=tenant, code=tenant.settings.default_inventory_in_transit_account_code)
    inventory_account = Account.objects.get(tenant=tenant, code=tenant.settings.default_inventory_account_code)
    
    record_journal_entry(
        tenant=tenant,
        branch=source_branch,
        reference_id=f"TRF-INIT-{transfer_id}",
        description=f"Stock Transfer Initiated - Ref #{transfer_id}",
        lines_data=[
            {'account': transit_account, 'debit': total_value, 'credit': Decimal('0.00')},
            {'account': inventory_account, 'debit': Decimal('0.00'), 'credit': total_value},
        ]
    )

def record_transfer_acceptance_accounting(*, tenant, dest_branch, transfer_id: str, total_value: Decimal):
    """
    Records the financial arrival of stock at the destination branch.
    """
    if total_value <= 0:
        return

    inventory_account = Account.objects.get(tenant=tenant, code=tenant.settings.default_inventory_account_code)
    transit_account = Account.objects.get(tenant=tenant, code=tenant.settings.default_inventory_in_transit_account_code)
    
    record_journal_entry(
        tenant=tenant,
        branch=dest_branch,
        reference_id=f"TRF-ACC-{transfer_id}",
        description=f"Stock Transfer Accepted - Ref #{transfer_id}",
        lines_data=[
            {'account': inventory_account, 'debit': total_value, 'credit': Decimal('0.00')},
            {'account': transit_account, 'debit': Decimal('0.00'), 'credit': total_value},
        ]
    )

def record_transfer_rejection_accounting(*, tenant, source_branch, transfer_id: str, total_value: Decimal):
    """
    Records the financial return of rejected stock back to the source branch.
    """
    if total_value <= 0:
        return

    inventory_account = Account.objects.get(tenant=tenant, code=tenant.settings.default_inventory_account_code)
    transit_account = Account.objects.get(tenant=tenant, code=tenant.settings.default_inventory_in_transit_account_code)
    
    record_journal_entry(
        tenant=tenant,
        branch=source_branch,
        reference_id=f"TRF-REJ-{transfer_id}",
        description=f"Stock Transfer Rejected & Returned - Ref #{transfer_id}",
        lines_data=[
            {'account': inventory_account, 'debit': total_value, 'credit': Decimal('0.00')},
            {'account': transit_account, 'debit': Decimal('0.00'), 'credit': total_value},
        ]
    )


def record_customer_debt_payment_accounting(*, tenant, branch, payment_reference: str, amount: Decimal, payment_method: str):
    """
    Translates a customer debt payment into a balanced journal entry.
    Debits the Payment Account (Cash/Bank) and Credits Accounts Receivable.
    """
    journal_lines = []

    # 1. Debit Payment Account (Asset increases)
    if payment_method == 'Cash':
        acc_code = tenant.settings.default_cash_account_code
    elif payment_method == 'POS':
        acc_code = tenant.settings.default_pos_account_code
    elif payment_method == 'Transfer':
        acc_code = tenant.settings.default_transfer_account_code
    else:
        raise ValidationError(f"Unknown payment method: {payment_method}")

    payment_account = Account.objects.get(tenant=tenant, code=acc_code)
    journal_lines.append({'account': payment_account, 'debit': amount, 'credit': Decimal('0.00')})

    # 2. Credit Accounts Receivable (Asset decreases)
    ar_account = Account.objects.get(tenant=tenant, code=tenant.settings.default_ar_account_code)
    journal_lines.append({'account': ar_account, 'debit': Decimal('0.00'), 'credit': amount})

    record_journal_entry(
        tenant=tenant,
        branch=branch,
        reference_id=payment_reference,
        description=f"Customer Debt Payment - Ref #{payment_reference}",
        lines_data=journal_lines
    )


def record_void_sale_accounting(*, tenant, branch, order, payments: list, debt_amount: Decimal, total_cost_of_sales: Decimal):
    """
    Reverses the financial impact of a sales order.
    Debits Revenue, Credits Payments/Receivables, and reverses COGS.
    """
    journal_lines = []
    
    # Calculate Original Gross Revenue
    gross_revenue = order.total_amount + order.discount_amount
    
    # 1. Debit Sales Revenue (Reverse Gross)
    revenue_account = Account.objects.get(tenant=tenant, code=tenant.settings.default_sales_account_code)
    journal_lines.append({'account': revenue_account, 'debit': gross_revenue, 'credit': Decimal('0.00')})

    # 2. Credit Sales Discounts (Reverse Contra-Revenue)
    if order.discount_amount > 0:
        discount_account = Account.objects.get(tenant=tenant, code=tenant.settings.default_discount_account_code)
        journal_lines.append({'account': discount_account, 'debit': Decimal('0.00'), 'credit': order.discount_amount})

    # 3. Credit Payments (Reverse Cash, POS, Transfer)
    for payment in payments:
        amount = Decimal(str(payment.amount))
        method = payment.method
        
        if amount > 0:
            if method == 'Cash':
                acc_code = tenant.settings.default_cash_account_code
            elif method == 'POS':
                acc_code = tenant.settings.default_pos_account_code
            elif method == 'Transfer':
                acc_code = tenant.settings.default_transfer_account_code
            else:
                raise ValidationError(f"Unknown payment method: {method}")
                
            payment_account = Account.objects.get(tenant=tenant, code=acc_code)
            journal_lines.append({'account': payment_account, 'debit': Decimal('0.00'), 'credit': amount})

    # 4. Credit Accounts Receivable (Reverse Credit Sales)
    if debt_amount > 0:
        ar_account = Account.objects.get(tenant=tenant, code=tenant.settings.default_ar_account_code)
        journal_lines.append({'account': ar_account, 'debit': Decimal('0.00'), 'credit': debt_amount})

    # 5. Reverse Cost of Goods Sold (Debit Inventory, Credit COGS)
    if total_cost_of_sales > 0:
        cogs_account = Account.objects.get(tenant=tenant, code=tenant.settings.default_cogs_account_code)
        inventory_account = Account.objects.get(tenant=tenant, code=tenant.settings.default_inventory_account_code)
        
        journal_lines.append({'account': inventory_account, 'debit': total_cost_of_sales, 'credit': Decimal('0.00')})
        journal_lines.append({'account': cogs_account, 'debit': Decimal('0.00'), 'credit': total_cost_of_sales})

    # Execute the balanced transaction reversal
    record_journal_entry(
        tenant=tenant,
        branch=branch,
        reference_id=f"VOID-{order.id}",
        description=f"Voided Sales Order #{order.id}",
        lines_data=journal_lines
    )


def record_expense_accounting(
    *, 
    tenant, 
    branch, 
    expense_id: str, 
    amount: Decimal, 
    expense_account: Account,
    payment_method: str, 
    description: str
):
    """
    Translates a mapped expense into a balanced journal entry.
    """
    journal_lines = []
    
    # 1. Debit the Specific Mapped Expense Account
    journal_lines.append({'account': expense_account, 'debit': amount, 'credit': Decimal('0.00')})

    # 2. Credit the Payment Account (Asset decreases)
    if payment_method == 'Cash':
        acc_code = tenant.settings.default_cash_account_code
    elif payment_method == 'POS':
        acc_code = tenant.settings.default_pos_account_code
    elif payment_method == 'Transfer':
        acc_code = tenant.settings.default_transfer_account_code
    else:
        raise ValidationError(f"Unknown payment method: {payment_method}")
        
    payment_account = Account.objects.get(tenant=tenant, code=acc_code)
    journal_lines.append({'account': payment_account, 'debit': Decimal('0.00'), 'credit': amount})

    record_journal_entry(
        tenant=tenant,
        branch=branch,
        reference_id=f"EXP-{expense_id}",
        description=f"Expense: {description}",
        lines_data=journal_lines
    )


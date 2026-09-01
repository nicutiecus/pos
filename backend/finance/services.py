# finance/services.py
from django.core.exceptions import ValidationError
from common.models import Branch
from .models import Expense
# finance/services.py
from django.core.exceptions import ValidationError
from django.db import transaction
from decimal import Decimal
from common.models import Branch
from .models import Expense, ExpenseCategory

from accounting.services import record_expense_accounting

@transaction.atomic
def record_expense_service(
    *, 
    user, 
    category_id: str, # Changed from category: str to enforce GL mapping
    amount: float, 
    payment_method: str, 
    description: str, 
    scope: str = Expense.ExpenseScope.BRANCH, 
    branch_id: str = None
):
    branch = None
    admin_roles = ['Admin', 'Super_Admin', 'Tenant_Admin']
    amount_decimal = Decimal(str(amount))

    # Validate Category Mapping
    expense_category = ExpenseCategory.objects.filter(id=category_id, tenant=user.tenant, is_active=True).first()
    if not expense_category:
        raise ValidationError("Invalid or inactive expense category selected.")

    # 1. Handle Branch Expenses
    if scope == Expense.ExpenseScope.BRANCH:
        if not branch_id:
            raise ValidationError("Branch ID is required for branch-level expenses.")
        
        branch = Branch.objects.filter(id=branch_id, tenant=user.tenant).first()
        if not branch:
            raise ValidationError("Invalid branch selected.")

        if user.role not in admin_roles and str(user.branch_id) != str(branch.id):
            raise ValidationError("You can only record expenses for your own branch.")

    # 2. Handle Corporate Expenses
    elif scope == Expense.ExpenseScope.CORPORATE:
        if user.role not in admin_roles:
            raise ValidationError("You do not have permission to record corporate expenses.")

    # 3. Save Operational Record
    expense = Expense(
        tenant=user.tenant,
        scope=scope,
        branch=branch,
        category=expense_category, # Link to the mapping model
        amount=amount_decimal,
        description=description,
    )
    expense.clean()
    expense.save()
    
    # 4. Dispatch Exact Mapped Account to Accounting Module
    record_expense_accounting(
        tenant=user.tenant,
        branch=branch,
        expense_id=str(expense.id),
        amount=amount_decimal,
        expense_account=expense_category.account, # Passes the specific GL Account object
        payment_method=payment_method,
        description=description
    )
    
    return expense
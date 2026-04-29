# finance/services.py
from django.core.exceptions import ValidationError
from common.models import Branch
from .models import Expense

def record_expense_service(*, user, category: str, amount: float, description: str, scope: str = Expense.ExpenseScope.BRANCH, branch_id: str = None):
    branch = None
    admin_roles = ['Admin', 'Super_Admin', 'Tenant_Admin']

    # 1. Handle Branch Expenses
    if scope == Expense.ExpenseScope.BRANCH:
        if not branch_id:
            raise ValidationError("Branch ID is required for branch-level expenses.")
        
        branch = Branch.objects.filter(id=branch_id, tenant=user.tenant).first()
        if not branch:
            raise ValidationError("Invalid branch selected.")

        # Security: Can they log for this branch?
        if user.role not in admin_roles and str(user.branch_id) != str(branch.id):
            raise ValidationError("You can only record expenses for your own branch.")

    # 2. Handle Corporate Expenses
    elif scope == Expense.ExpenseScope.CORPORATE:
        # Security: Only admins can log global expenses
        if user.role not in admin_roles:
            raise ValidationError("You do not have permission to record corporate expenses.")
        # branch remains None

    # 3. Create and explicitly trigger the model's clean() method to be extra safe
    expense = Expense(
        tenant=user.tenant,
        scope=scope,
        branch=branch,
        category=category,
        amount=amount,
        description=description,
        approved_by=user
    )
    expense.clean() 
    expense.save()
    
    return expense


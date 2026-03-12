# finance/selectors.py
from .models import Expense

def get_expenses(*, user, branch_id=None, scope=None, start_date=None, end_date=None):
    # Note: adjust 'created_at' to 'expense_date' if your model doesn't inherit a created_at field
    qs = Expense.objects.filter(tenant=user.tenant).select_related('branch', 'approved_by').order_by('-expense_date')

    admin_roles = ['Admin', 'Super_Admin', 'Tenant_Admin']
    is_admin = getattr(user, 'role', '') in admin_roles

    if not is_admin:
        # 🔒 Hard Security: Staff only see their own branch's expenses.
        qs = qs.filter(scope=Expense.ExpenseScope.BRANCH, branch_id=user.branch_id)
    else:
        # 📊 Admin Filters: Admins can dynamically filter
        if scope:
            qs = qs.filter(scope=scope)
        if branch_id:
            qs = qs.filter(branch_id=branch_id)

    # Date filters
    if start_date:
        qs = qs.filter(expense_date__gte=start_date)
    if end_date:
        qs = qs.filter(expense_date__lte=end_date)

    return qs
from .models import Expense

def get_expenses(*, user, branch_id=None, start_date=None, end_date=None):
    qs = Expense.objects.filter(tenant=user.tenant).select_related('branch', 'approved_by').order_by('-created_at')

    if user.role not in ['Admin', 'Super_Admin']:
        branch_id = user.branch_id

    if branch_id:
        qs = qs.filter(branch_id=branch_id)

    if start_date:
        qs = qs.filter(expense_date__gte=start_date)
    if end_date:
        qs = qs.filter(expense_date__lte=end_date)

    return qs
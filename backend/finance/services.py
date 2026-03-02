from django.core.exceptions import ValidationError
from common.models import Branch
from .models import Expense

def record_expense_service(*, user, branch_id: str, category: str, amount: float, description: str):
    branch = Branch.objects.filter(id=branch_id, tenant=user.tenant).first()
    if not branch:
        raise ValidationError("Invalid branch selected.")

    if user.role not in ['Admin', 'Super_Admin'] and user.branch_id != branch.id:
        raise ValidationError("You can only record expenses for your own branch.")

    return Expense.objects.create(
        tenant=user.tenant,
        branch=branch,
        category=category,
        amount=amount,
        description=description,
        approved_by=user
    )
from .models import SalesOrder, CustomerLedger
from django.shortcuts import get_object_or_404

def get_sales_list(*, user, branch_id=None):
    """
    Fetches sales history for the tenant.
    Optionally filters by branch.
    """
    query = SalesOrder.objects.filter(tenant=user.tenant).select_related(
        'customer', 'user', 'branch'
    ).order_by('-created_at')


    admin_roles = ['Admin', 'Tenant_Admin', 'Super_Admin']

    if user.role not in admin_roles:
        # Non-admins: FORCE the query to only return their assigned branch
        # Even if they try to pass a different branch_id in the URL, we ignore it.
        query = query.filter(branch_id=user.branch_id)
    
    elif branch_id:
        # Admins: Can see everything, but allow them to filter by a specific branch if requested
        query = query.filter(branch_id=branch_id)

    return query.order_by('-created_at')# sales/selectors.py


def get_sale_detail(*, user, sale_id):
    """
    Fetches a single sale with security checks.
    """
    # 🔒 Security: Start with tenant isolation
    qs = SalesOrder.objects.filter(tenant=user.tenant).select_related(
        'branch', 'customer', 'user'
    ).prefetch_related(
        'items', 'items__product', 'payments' # Fetch items and payments efficiently
    )

    # 🔒 Security: If not Admin, ensure they can only see their own branch's sales
    admin_roles = ['Admin', 'Tenant_Admin', 'Super_Admin']
    if user.role not in admin_roles:
        qs = qs.filter(branch_id=user.branch_id)

    return get_object_or_404(qs, id=sale_id)



def get_customer_ledger(*, user, customer_id: str):
    return CustomerLedger.objects.filter(
        tenant=user.tenant, 
        customer_id=customer_id
    ).order_by('-created_at')

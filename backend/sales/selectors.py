from .models import SalesOrder

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

    return query.order_by('-created_at')
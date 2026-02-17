from .models import Branch

def get_branches_for_tenant(*, user):
    """
    Returns all active branches for the user's tenant.
    """
    return Branch.objects.filter(tenant=user.tenant, is_active=True).order_by('name')
from .models import Branch
from .models import TenantSettings

def get_branches_for_tenant(*, user):
    """
    Returns all active branches for the user's tenant.
    """
    return Branch.objects.filter(tenant=user.tenant, is_active=True).order_by('name')




def get_tenant_settings(*, user):
    """
    Return the settings for the user's tenant. 
    If not found, create a default one.
    """
    settings, created = TenantSettings.objects.get_or_create(
        tenant=user.tenant,
        defaults={
            "business_name": user.tenant.name,
            "address": "Update your address in settings",
            "phone": ""
        }
    )
    return settings



def get_transfer_destination_branches(*, user):
    """
    Returns all branches for the tenant, excluding the user's current branch.
    """
    qs = Branch.objects.filter(tenant=user.tenant)
    
    if user.branch_id:
        qs = qs.exclude(id=user.branch_id) # Remove their own branch
        
    return qs
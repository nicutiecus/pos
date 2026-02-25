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
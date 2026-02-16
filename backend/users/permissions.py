# users/permissions.py
from rest_framework.permissions import BasePermission

class IsTenantAdmin(BasePermission):
    """
    Allows access only to Tenant Admins.
    """
    def has_permission(self, request, view):
        return bool(
            request.user and 
            request.user.is_authenticated and 
            request.user.is_tenant_admin
        )
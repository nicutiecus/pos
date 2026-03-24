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
    


class IsSuperAdmin(BasePermission):
    """
    Allows access only to authenticated Super Admins.
    """
    def has_permission(self, request, view):
        return bool(
            request.user and 
            request.user.is_authenticated and 
            request.user.role == 'Super_Admin'
        )
    


class HasRequiredPermission(BasePermission):
    """
    Checks if the user has the specific permission required by the View.
    Bypassed automatically by Tenant Admins and Super Admins.
    """
    def has_permission(self, request, view):
        user = request.user
        
        # 1. Admins automatically get a free pass
        if user.role in ['Super_Admin', 'Tenant_Admin']:
            return True
            
        # 2. Find out what permission this specific API view requires
        required_perm = getattr(view, 'required_permission', None)
        
        # If the view didn't specify a permission, deny access to be safe
        if not required_perm:
            return False
            
        # 3. Check if the user's JSON list contains the magic string
        return required_perm in user.custom_permissions
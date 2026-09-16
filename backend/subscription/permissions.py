from rest_framework import permissions
from rest_framework.exceptions import PermissionDenied
from inventory.models import Product

class HasActiveSubscription(permissions.BasePermission):
    message = "Your subscription has expired. Please renew to access this feature."

    def has_permission(self, request, view):
        tenant = request.user.tenant
        return tenant.subscription.status in ['active', 'trialing']
    



class CanAddProduct(permissions.BasePermission):
    """
    Blocks POST requests if the tenant has reached their plan's inventory limit.
    Allows GET, PUT, PATCH, DELETE.
    """
    def has_permission(self, request, view):
        # Only enforce limits on creation
        if request.method != 'POST':
            return True
            
        tenant = request.user.tenant
        subscription = getattr(tenant, 'subscription', None)
        
        if not subscription or subscription.status not in ['active', 'trialing']:
            raise PermissionDenied("An active subscription is required to add items.")
            
        # Get the limit from the plan
        max_items = subscription.plan.max_inventory_items
        
        # Calculate current usage
        current_item_count = Product.objects.filter(tenant=tenant).count()
        
        if current_item_count >= max_items:
            raise PermissionDenied(f"Plan limit reached. Your current plan allows a maximum of {max_items} items.")
            
        return True


class IsSuperAdminUser(permissions.BasePermission):
    """
    Allows access only to superusers or designated internal staff.
    """
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_superuser)
from django.db.models import Sum, F, Q
from django.utils import timezone
from .models import InventoryBatch, Product, Category
from django.utils import timezone
from django.core.exceptions import PermissionDenied
from .models import InventoryBatch, Product

def get_stock_levels(*,user, branch_id: str, tenant_id: str) -> list[dict]:
    """
    Returns aggregated stock quantity per product for a branch.
    Aggregates all active batches.
    """
    admin_roles = ['Admin', 'Tenant_Admin', 'Super_Admin']
    
    if user.role not in admin_roles and str(user.branch_id) != str(branch_id):
        raise PermissionDenied("You are not authorized to view inventory for this branch.")



    return Product.objects.filter(
        tenant_id=tenant_id,
        batches__branch_id=branch_id,
        batches__status=InventoryBatch.Status.ACTIVE
    ).annotate(
        total_quantity=Sum('batches__quantity_on_hand')
    ).values(
        'id', 'name', 'sku', 'unit_type', 'total_quantity'
    )

def get_expiring_batches(*, user, branch_id: str, tenant_id: str, days_threshold: int = 7) -> list[dict]:
    """
    Finds batches expiring within the next X days.
    """
    admin_roles = ['Admin', 'Tenant_Admin', 'Super_Admin']
    
    if user.role not in admin_roles and str(user.branch_id) != str(branch_id):
        raise PermissionDenied("You are not authorized to view expiring stock for this branch.")
    target_date = timezone.now().date() + timezone.timedelta(days=days_threshold)
    today = timezone.now().date()

    return InventoryBatch.objects.filter(
        tenant_id=tenant_id,
        branch_id=branch_id,
        status=InventoryBatch.Status.ACTIVE,
        expiry_date__lte=target_date,
        quantity_on_hand__gt=0 # Ignore empty batches
    ).select_related('product').order_by('expiry_date')




def get_products_for_tenant(*, user):
    """
    Fetch all products for the logged-in user's tenant.
    """
    return Product.objects.filter(tenant=user.tenant).values(
        'id', 
        'name', 
        'sku', 
        'selling_price', 
        'cost_price', 
        'category__name', # Fetch the category name instead of just ID
        'unit_type'
    )


def get_categories(*, user) -> list[Category]:
    """
    Returns all categories belonging to the user's tenant.
    """
    return Category.objects.filter(tenant=user.tenant).order_by('name')


def get_inventory_logs(*, user, branch_id=None):
    """
    Returns a history of all stock received (Inventory Batches).
    """
    query = InventoryBatch.objects.filter(tenant=user.tenant).select_related(
        'product', 'branch'
    ).order_by('-created_at')

    # 🔒 Security: If not Admin, restrict to their branch
    if user.role not in ['Admin', 'Tenant_Admin', 'Super_Admin']:
        query = query.filter(branch_id=user.branch_id)
    elif branch_id:
        query = query.filter(branch_id=branch_id)

    return query
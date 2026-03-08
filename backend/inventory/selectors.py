from django.db.models import Sum, F, Q
from django.utils import timezone
from .models import InventoryBatch, Product, Category, StockTransferLog, ProductPriceHistory, InventoryLog
from django.core.exceptions import PermissionDenied
from django.core.cache import cache
from .serializers import ProductCatalogSerializer # We use the serializer here now





def get_stock_levels(*, user, branch_id: str):
    """
    Fetches stock levels for a specific branch.
    Validates that the user is allowed to see this branch.
    """
    # 1. Security Check: Is the user allowed to view this branch?
    # (Admins can view any branch; Cashiers can only view their assigned branch)
    admin_roles = ['Admin', 'Tenant_Admin', 'Super_Admin']
    
    # Ensure IDs are compared as strings to avoid UUID type mismatch
    if user.role not in admin_roles and str(user.branch_id) != str(branch_id):
        raise PermissionDenied("You are not authorized to view inventory for this branch.")

    # 2. Fetch Stock
    return Product.objects.filter(
        tenant=user.tenant,  # <--- We get the tenant from the user object now
        batches__branch_id=branch_id,
        batches__status=InventoryBatch.Status.ACTIVE
    ).annotate(
        total_quantity=Sum('batches__quantity_on_hand')
    ).values('id', 'name', 'sku', 'unit_type', 'total_quantity')


def get_organization_stock_levels(*, user):
    """
    Fetches stock levels for all products across all branches.
    Groups the total stock per product, and provides a branch-by-branch breakdown.
    """
    # 1. Single optimized database query
    # Groups by Product AND Branch, summing up the quantities of any active batches
    batches = InventoryBatch.objects.filter(
        tenant=user.tenant, 
        quantity_on_hand__gt=0
    ).values(
        'product__id', 
        'product__name', 
        'branch__id', 
        'branch__name'
    ).annotate(
        total_quantity=Sum('quantity_on_hand')
    ).order_by('product__name', 'branch__name')

    # 2. Format the data into a clean JSON structure for the frontend
    formatted_data = {}
    
    for batch in batches:
        pid = batch['product__id']
        
        # If we haven't seen this product yet, initialize it
        if pid not in formatted_data:
            formatted_data[pid] = {
                "product_id": pid,
                "product_name": batch['product__name'],
                "total_organization_stock": 0,
                "branch_breakdown": []
            }
        
        # Add the branch's stock to the organization total
        qty = batch['total_quantity']
        formatted_data[pid]['total_organization_stock'] += qty
        
        # Add the specific branch details to the breakdown array
        formatted_data[pid]['branch_breakdown'].append({
            "branch_id": batch['branch__id'],
            "branch_name": batch['branch__name'],
            "stock": qty
        })
        
    # Return as a flat list of product dictionaries
    return list(formatted_data.values())

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
    Returns a history of all stock movement
    """
    query = InventoryLog.objects.filter(tenant=user.tenant).select_related(
        'product', 'branch'
    ).order_by('-created_at')

    # 🔒 Security: If not Admin, restrict to their branch
    if user.role not in ['Admin', 'Tenant_Admin', 'Super_Admin']:
        query = query.filter(branch_id=user.branch_id)
    elif branch_id:
        query = query.filter(branch_id=branch_id)

    return query



def get_product_catalog(*, user):
    """
    Returns cached product list for the tenant.
    """
    tenant_id = user.tenant.id
    cache_key = f"product_catalog:{tenant_id}"

    # 1. Try to get data from Redis
    cached_data = cache.get(cache_key)
    if cached_data is not None:
        return cached_data

    # 2. If missing, fetch from DB
    products = Product.objects.filter(tenant=user.tenant).order_by('name')
    
    # 3. Serialize the data (Convert DB Objects -> JSON-ready List)
    serializer = ProductCatalogSerializer(products, many=True)
    data = serializer.data

    # 4. Save to Redis (Timeout: 24 hours)
    cache.set(cache_key, data, timeout=60 * 60 * 24)

    return data




def get_stock_transfer_logs(*, user, status=None, direction=None, branch_id=None):
    qs = StockTransferLog.objects.filter(tenant=user.tenant).select_related(
        'source_branch', 'destination_branch', 'product', 'transferred_by'
    ).order_by('-created_at')

    # 🔒 Security: If not an Admin, force the branch_id to their own branch
    if user.role not in ['Admin', 'Tenant_Admin', 'Super_Admin']:
        branch_id = user.branch_id

    # Filter by branch (either it came from here, or it went to here)
    if branch_id:
        if direction == 'incoming':
            qs =qs.filter(destination_branch_id=branch_id)
        elif direction=='outgoing':
            qs =qs.filter(source_branch_id=branch_id)
        else:
            # default to show both
            qs = qs.filter(
                Q(source_branch_id=branch_id) | Q(destination_branch_id=branch_id)
            )
    if status:
        qs = qs.filter(status=status)

    return qs.order_by('-created_at')



def get_product_price_history(*, user, product_id: str):
    """Fetches the price history for a specific product securely."""
    return ProductPriceHistory.objects.filter(
        tenant=user.tenant,
        product_id=product_id
    ).select_related('changed_by').order_by('-created_at')

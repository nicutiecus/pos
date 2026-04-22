from django.db.models import Prefetch
from django.core.exceptions import ObjectDoesNotExist
from .models import ReturnOrder, ReturnItem

def get_branch_returns(*, tenant, branch_id: str, start_date=None, end_date=None):
    """
    Retrieves a list of all return orders for a specific branch.
    Optimized for list views (tables/datagrids).

    """
    
    qs = ReturnOrder.objects.filter(
        tenant_id=tenant if isinstance(tenant, str) else getattr(tenant, 'id', tenant), 
        branch_id=branch_id
    ).select_related('cashier', 'original_order')

    if start_date:
        qs = qs.filter(created_at__date__gte=start_date)
    if end_date:
        qs = qs.filter(created_at__date__lte=end_date)

    return qs.order_by('-created_at')

def get_return_order_details(*, tenant, branch_id: str, return_order_id: int):
    """
    Retrieves a single return order with all its nested items and product details.
    Optimized for a "Return Receipt" detail view.
    """
    try:
        return ReturnOrder.objects.select_related(
            'cashier', 
            'original_order'
        ).prefetch_related(
            Prefetch(
                'items', 
                queryset=ReturnItem.objects.select_related('original_item__product')
            )
        ).get(
            id=return_order_id, 
            tenant=tenant, 
            branch_id=branch_id
        )
    except ReturnOrder.DoesNotExist:
        return None
from datetime import timedelta
from django.db.models import Sum, F, Count
from django.db.models.functions import TruncDate
from django.utils import timezone
from sales.models import SalesOrder, SaleItem
from inventory.models import InventoryBatch, Product

def get_dashboard_stats(*, user, branch_id=None):
    """
    Returns high-level numbers for the dashboard cards.
    """
    today = timezone.now().date()
    start_of_month = today.replace(day=1)

    # Base Query: Filter by tenant
    orders = SalesOrder.objects.filter(tenant=user.tenant)
    
    # 🔒 Security: Filter by branch if not Admin
    if user.role not in ['Admin', 'Tenant_Admin', 'Super_Admin']:
        branch_id = user.branch_id
    
    if branch_id:
        orders = orders.filter(branch_id=branch_id)

    # 1. Today's Sales
    sales_today = orders.filter(created_at__date=today).aggregate(
        total=Sum('total_amount')
    )['total'] or 0

    # 2. Monthly Sales
    sales_month = orders.filter(created_at__date__gte=start_of_month).aggregate(
        total=Sum('total_amount')
    )['total'] or 0

    # 3. Total Orders Today
    orders_count_today = orders.filter(created_at__date=today).count()

    # 4. Low Stock Alerts (Inventory Check)
    # We check products where total active batch quantity <= reorder_level
    # This is a bit complex, simplified for dashboard speed:
    low_stock_count = Product.objects.filter(
        tenant=user.tenant,
        reorder_level__gt=0 # Only check products that track this
    ).annotate(
        current_stock=Sum('batches__quantity_on_hand')
    ).filter(current_stock__lte=F('reorder_level')).count()

    return {
        "sales_today": sales_today,
        "sales_month": sales_month,
        "orders_today": orders_count_today,
        "low_stock_count": low_stock_count
    }

def get_sales_chart_data(*, user, branch_id=None, days=7):
    """
    Returns sales grouped by day for the line chart.
    """
    start_date = timezone.now().date() - timedelta(days=days)
    
    query = SalesOrder.objects.filter(
        tenant=user.tenant, 
        created_at__date__gte=start_date
    )

    if branch_id:
        query = query.filter(branch_id=branch_id)

    # Group by Date and Sum Total Amount
    # Result: [{'date': 2023-10-25, 'total': 5000}, ...]
    data = query.annotate(
        date=TruncDate('created_at')
    ).values('date').annotate(
        total=Sum('total_amount')
    ).order_by('date')

    return list(data)

def get_top_selling_products(*, user, branch_id=None, limit=5):
    """
    Returns the top N best-selling products by revenue.
    """
    query = SaleItem.objects.filter(order__tenant=user.tenant)

    if branch_id:
        query = query.filter(order__branch_id=branch_id)

    return query.values(
        'product__name'
    ).annotate(
        total_revenue=Sum('subtotal'),
        total_quantity=Sum('quantity')
    ).order_by('-total_revenue')[:limit]
from datetime import timedelta
from django.db.models import Sum, F, Count
from django.db.models.functions import TruncDate
from django.utils import timezone
from sales.models import SalesOrder, SaleItem, Customer
from inventory.models import InventoryBatch, Product
from finance.models import Expense

# Import the model from your sales app
from sales.models import SalesOrder 

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




def get_dashboard_metrics(*, user, branch_id=None, start_date=None, end_date=None):
    # 1. Base Query Filters
    sales_qs = SalesOrder.objects.filter(tenant=user.tenant)
    expense_qs = Expense.objects.filter(tenant=user.tenant)
    customer_qs = Customer.objects.filter(tenant=user.tenant)

    # 2. Role-Based Branch Filtering
    if user.role not in ['Admin', 'Super_Admin']:
        branch_id = user.branch_id

    if branch_id:
        sales_qs = sales_qs.filter(branch_id=branch_id)
        expense_qs = expense_qs.filter(branch_id=branch_id)
        # Assuming customers are tied to a tenant, but maybe not a specific branch. 
        # If they are, filter them here too.

    # 3. Date Range Filtering (For Sales and Expenses)
    if start_date:
        sales_qs = sales_qs.filter(created_at__date__gte=start_date)
        expense_qs = expense_qs.filter(expense_date__gte=start_date)
    if end_date:
        sales_qs = sales_qs.filter(created_at__date__lte=end_date)
        expense_qs = expense_qs.filter(expense_date__lte=end_date)

    # 4. Perform the Aggregations (Let the database do the math!)
    
    # Total Revenue (Sum of all sales)
    total_revenue = sales_qs.aggregate(total=Sum('final_total'))['total'] or 0.00
    
    # Total Expenses (Sum of all expenses)
    total_expenses = expense_qs.aggregate(total=Sum('amount'))['total'] or 0.00
    
    # Outstanding Debt (Sum of all customer current_debt)
    total_debt = customer_qs.aggregate(total=Sum('current_debt'))['total'] or 0.00

    # Calculate Net Profit (Revenue - Expenses)
    # Note: To be 100% accurate, you'd subtract Cost of Goods Sold (COGS) too, 
    # but Revenue - Expenses gives you your Net Cash Flow!
    net_profit = float(total_revenue) - float(total_expenses)

    return {
        "total_revenue": total_revenue,
        "total_expenses": total_expenses,
        "net_profit": net_profit,
        "total_outstanding_debt": total_debt,
        "total_sales_count": sales_qs.count() # How many transactions happened?
    }



def get_7_day_revenue_trend(*, user, branch_id=None):
    today = timezone.now().date()
    start_date = today - timedelta(days=6)

    # 1. Base Query
    qs = SalesOrder.objects.filter(
        tenant=user.tenant,
        created_at__date__gte=start_date,
        created_at__date__lte=today
    )

    # 2. Security: Role-based branch filtering
    if user.role not in ['Admin', 'Super_Admin']:
        branch_id = user.branch_id

    if branch_id:
        qs = qs.filter(branch_id=branch_id)

    # 3. Database Aggregation
    daily_sales = qs.annotate(
        date=TruncDate('created_at')
    ).values('date').annotate(
        revenue=Sum('total_amount')
    ).order_by('date')

    # Convert to fast lookup dictionary
    sales_dict = {item['date']: item['revenue'] for item in daily_sales}

    # 4. Build the perfect 7-day array
    trend = []
    for i in range(7):
        current_date = start_date + timedelta(days=i)
        day_name = current_date.strftime("%a") 
        
        # Get revenue, default to 0.00 if no sales
        revenue = sales_dict.get(current_date, 0.00)

        trend.append({
            "date": day_name,
            "revenue": float(revenue) 
        })

    return trend
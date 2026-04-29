from datetime import timedelta
from django.db.models import Sum, F, Count, DecimalField
from django.db.models.functions import TruncDate, Coalesce
from django.utils import timezone
from sales.models import SalesOrder, SaleItem, Customer, Payment, CustomerLedger
from inventory.models import InventoryBatch, Product, ProductPriceHistory
from finance.models import Expense
from django.utils.dateparse import parse_date

from decimal import Decimal


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



def get_branch_eod_report(*, user, branch_id: str, target_date: str = None):
    # Default to today if no date is provided
    if target_date:
        report_date = parse_date(target_date)
    else:
        report_date = timezone.now().date()

    # 1. Base Querysets
    sales_qs = SalesOrder.objects.filter(
        tenant=user.tenant,
        branch_id=branch_id,
        created_at__date=report_date
    )
    
    sale_items_qs = SaleItem.objects.filter(
        order__tenant=user.tenant,
        order__branch_id=branch_id,
        order__created_at__date=report_date
    )

    #  Revenue, Profit, and Cashiers
    sales_aggregates = sales_qs.aggregate(
        total_revenue=Coalesce(Sum('total_amount'), Decimal('0.00'), output_field=DecimalField()),
        cashier_count=Count('user', distinct=True)
    )
    actual_revenue = sales_aggregates['total_revenue']

    # 3. Total Cost of Goods Sold (Item Level)
    cogs_aggregates = sale_items_qs.aggregate(
        total_cost=Coalesce(Sum(F('quantity') * F('cost_price_at_sale')), Decimal('0.00'), output_field=DecimalField())
    )
    total_cogs = cogs_aggregates['total_cost']

    total_profit = actual_revenue - total_cogs


    #  Breakdown of Items Sold
    items_breakdown = list(sale_items_qs.values(
        product_name=F('product__name')
    ).annotate(
        total_quantity=Sum('quantity'),
        total_revenue=Sum('subtotal'),
        total_cost=Sum(F('quantity')* F('cost_price_at_sale')),
        item_profit = Sum('subtotal')-Sum(F('quantity')* F('cost_price_at_sale'))
    ).order_by('-total_quantity'))

    


    # 4. Expected Cash by Payment Method
    payments_qs = Payment.objects.filter(
        tenant=user.tenant,
        branch_id=branch_id,
        created_at__date=report_date
    )
    payment_breakdown = list(payments_qs.values('method','transaction_type').annotate(
        total_amount=Sum('amount')
    ))

    # 5. Total Debt Repayment Made
    debt_repayments = CustomerLedger.objects.filter(
        tenant=user.tenant,
        branch_id = branch_id,
        transaction_type=CustomerLedger.TransactionType.PAYMENT, 
        created_at__date=report_date
    ).aggregate(
        total_repaid=Coalesce(Sum('amount'), Decimal('0.00'), output_field=DecimalField())
    )

    # 6. Price Changes During the Day 
    price_changes_qs = ProductPriceHistory.objects.filter(
        tenant=user.tenant,
        created_at__date=report_date
    ).select_related('product')

    price_changes_list = [
        {
            "product": change.product.name,
            "old_price": change.old_price,
            "new_price": change.new_price,
            "changed_at": change.created_at.strftime("%I:%M %p"),
            "changed_by": change.changed_by.get_full_name() if change.changed_by else "System"
        }
        for change in price_changes_qs
    ]

    #credit sales
    # Part A: Full Credit Sales (Pending) -> The entire order amount is debt
    pending_debt = SalesOrder.objects.filter(
        tenant=user.tenant,
        branch_id=branch_id,
        created_at__date=report_date,
        payment_status='Pending'  # Exact match to your model choice
    ).aggregate(
        total=Coalesce(Sum('total_amount'), Decimal('0.00'), output_field=DecimalField())
    )['total']

    # Part B: Partial Sales -> Only the unpaid portion is debt
    # (Total amount minus whatever cash/transfer they actually paid upfront)
    partial_debt = SalesOrder.objects.filter(
        tenant=user.tenant,
        branch_id=branch_id,
        created_at__date=report_date,
        payment_status='Partial'  # Exact match to your model choice
    ).aggregate(
        total=Coalesce(Sum(F('total_amount') - F('amount_paid')), Decimal('0.00'), output_field=DecimalField())
    )['total']

    # Combine them for the final EOD figure
    total_credit_sales = pending_debt + partial_debt


    # 7. Construct Final Payload
    return {
        "report_date": report_date.strftime("%Y-%m-%d"),
        "branch_id": branch_id,
        "summary": {
            "total_sales_revenue": actual_revenue,
            "total_cost_of_goods": total_cogs,
            "total_sales_profit": total_profit,
            "total_debt_repayment_collected": debt_repayments['total_repaid'],
            "total_credit_sales": total_credit_sales,
            "number_of_active_cashiers": sales_aggregates['cashier_count'],
        },
        "payment_methods_breakdown": payment_breakdown,
        "items_sold_breakdown": items_breakdown,
        "intra_day_price_changes": price_changes_list
    }
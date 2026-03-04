from rest_framework import views, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .selectors import get_dashboard_stats, get_sales_chart_data, get_top_selling_products, get_7_day_revenue_trend
from rest_framework.views import APIView
from django.db.models import Sum, F, DecimalField, ExpressionWrapper, Value
from django.db.models.functions import Coalesce, Cast
from django.utils.dateparse import parse_date
from decimal import Decimal
from sales.models import SalesOrder, SaleItem
from rest_framework.exceptions import PermissionDenied

class DashboardStatsApi(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        branch_id = request.GET.get('branch_id')
        stats = get_dashboard_stats(user=request.user, branch_id=branch_id)
        return Response(stats, status=status.HTTP_200_OK)

class SalesChartApi(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        branch_id = request.GET.get('branch_id')
        days = int(request.GET.get('days', 7))
        
        data = get_sales_chart_data(user=request.user, branch_id=branch_id, days=days)
        return Response(data, status=status.HTTP_200_OK)

class TopProductsApi(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        branch_id = request.GET.get('branch_id')
        data = get_top_selling_products(user=request.user, branch_id=branch_id)
        return Response(data, status=status.HTTP_200_OK)
    
# common/apis.py
from rest_framework import views, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from .selectors import get_dashboard_metrics
from .serializers import DashboardMetricsSerializer

class DashboardApi(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        branch_id = request.GET.get('branch_id')
        start_date = request.GET.get('start_date')
        end_date = request.GET.get('end_date')

        # 1. Fetch the aggregated metrics
        metrics = get_dashboard_metrics(
            user=request.user,
            branch_id=branch_id,
            start_date=start_date,
            end_date=end_date
        )

        # 2. Serialize and return
        serializer = DashboardMetricsSerializer(metrics)
        return Response(serializer.data, status=status.HTTP_200_OK)
    


class RevenueTrendApi(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        branch_id = request.GET.get('branch_id')
        
        trend_data = get_7_day_revenue_trend(
            user=request.user, 
            branch_id=branch_id
        )
        
        return Response(trend_data, status=status.HTTP_200_OK)
    
class ProfitReportAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        if not user.is_tenant_admin:
            raise PermissionDenied("Access restricted. Only Tenant Admins can view organization-wide profit reports.")
        
        # 🚨 Lock in the decimal sizing so PostgreSQL is happy
        DEC_TYPE = DecimalField(max_digits=14, decimal_places=2)
        
        # 1. Base Query
        orders = SalesOrder.objects.filter(tenant=user.tenant)

        # 2. Date Filtering
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        
        if start_date and end_date:
            parsed_start = parse_date(start_date)
            parsed_end = parse_date(end_date)
            if parsed_start and parsed_end:
                orders = orders.filter(created_at__date__range=[parsed_start, parsed_end])

        # 3. Calculate Total Discounts Safely
        order_totals = orders.aggregate(
            total_discount=Coalesce(
                Sum('discount_amount', output_field=DEC_TYPE), 
                Value(Decimal('0.00'), output_field=DEC_TYPE), 
                output_field=DEC_TYPE
            )
        )
        total_discount = order_totals['total_discount']

        # 4. Grab Items
        items = SaleItem.objects.filter(order__in=orders)

        # 5. ALL YOUR FIELDS ARE ALREADY DECIMALS! No Cast() needed.
        revenue_math = ExpressionWrapper(F('unit_price') * F('quantity'), output_field=DEC_TYPE)
        cost_math = ExpressionWrapper(F('cost_price_at_sale') * F('quantity'), output_field=DEC_TYPE)
        profit_math = ExpressionWrapper((F('unit_price') - F('cost_price_at_sale')) * F('quantity'), output_field=DEC_TYPE)

        # 📈 6. Report A: Overall Business Profit
        item_totals = items.aggregate(
            # 👇 THE CULPRIT IS FIXED: The fallback is now a Decimal, not an integer!
            total_items_sold=Coalesce(Sum('quantity', output_field=DEC_TYPE), Value(Decimal('0.00'), output_field=DEC_TYPE), output_field=DEC_TYPE), 
            
            gross_revenue=Coalesce(Sum(revenue_math), Value(Decimal('0.00'), output_field=DEC_TYPE), output_field=DEC_TYPE),
            gross_cost=Coalesce(Sum(cost_math), Value(Decimal('0.00'), output_field=DEC_TYPE), output_field=DEC_TYPE),
            gross_profit=Coalesce(Sum(profit_math), Value(Decimal('0.00'), output_field=DEC_TYPE), output_field=DEC_TYPE)
        )

        # Calculate Net metrics
        net_revenue = item_totals['gross_revenue'] - total_discount
        net_profit = item_totals['gross_profit'] - total_discount

        # 📊 7. Report B: Profit Per Product Breakdown
        product_breakdown = items.values('product__name').annotate(
            # 👇 Fallback is safe here too
            quantity_sold=Coalesce(Sum('quantity', output_field=DEC_TYPE), Value(Decimal('0.00'), output_field=DEC_TYPE), output_field=DEC_TYPE),
            gross_revenue=Coalesce(Sum(revenue_math), Value(Decimal('0.00'), output_field=DEC_TYPE), output_field=DEC_TYPE),
            gross_profit=Coalesce(Sum(profit_math), Value(Decimal('0.00'), output_field=DEC_TYPE), output_field=DEC_TYPE)
        ).order_by('-gross_profit')
        
        return Response({
            "timeframe": {
                "start": start_date or "All Time",
                "end": end_date or "All Time"
            },
            "overall_metrics": {
                "total_items_sold": item_totals['total_items_sold'],
                "gross_revenue": item_totals['gross_revenue'],
                "total_discount_given": total_discount,
                "net_revenue": net_revenue,
                "gross_cost": item_totals['gross_cost'],
                "net_profit": net_profit  
            },
            "product_breakdown": product_breakdown
        })


from rest_framework import views, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .selectors import get_dashboard_stats, get_sales_chart_data, get_top_selling_products, get_7_day_revenue_trend

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
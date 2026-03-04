from django.urls import path
from .apis import (DashboardStatsApi, SalesChartApi, TopProductsApi, DashboardApi, 
                   RevenueTrendApi, ProfitReportAPIView)

urlpatterns = [
    path('dashboard-stats/', DashboardStatsApi.as_view(), name='dashboard-stats'),
    path('sales-chart/', SalesChartApi.as_view(), name='sales-chart'),
    path('top-products/', TopProductsApi.as_view(), name='top-products'),
    #Dashboard metrics
    path('dashboard/metrics/', DashboardApi.as_view(), name='dashboard-metrics'),
    path('revenue-trend/', RevenueTrendApi.as_view(), name='revenue-trend'),
    path('profits/', ProfitReportAPIView.as_view(), name='profit-reports'),
]

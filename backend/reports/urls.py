from django.urls import path
from .apis import DashboardStatsApi, SalesChartApi, TopProductsApi

urlpatterns = [
    path('dashboard-stats/', DashboardStatsApi.as_view(), name='dashboard-stats'),
    path('sales-chart/', SalesChartApi.as_view(), name='sales-chart'),
    path('top-products/', TopProductsApi.as_view(), name='top-products'),
]
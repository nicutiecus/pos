# common/serializers.py
from rest_framework import serializers

class DashboardMetricsSerializer(serializers.Serializer):
    total_revenue = serializers.DecimalField(max_digits=15, decimal_places=2)
    total_expenses = serializers.DecimalField(max_digits=15, decimal_places=2)
    net_profit = serializers.DecimalField(max_digits=15, decimal_places=2)
    total_outstanding_debt = serializers.DecimalField(max_digits=15, decimal_places=2)
    total_sales_count = serializers.IntegerField()
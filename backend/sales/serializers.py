from rest_framework import serializers
from .models import Payment, SalesOrder

class SaleItemSerializer(serializers.Serializer):
    product_id = serializers.UUIDField()
    quantity = serializers.DecimalField(max_digits=10, decimal_places=2)

class PaymentSerializer(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=12, decimal_places=2)
    method = serializers.ChoiceField(choices=Payment.Method.choices)
    reference_code = serializers.CharField(required=False, allow_blank=True)

class CreateSaleSerializer(serializers.Serializer):
    branch_id = serializers.UUIDField()
    customer_id = serializers.UUIDField(required=False, allow_null=True)
    items = SaleItemSerializer(many=True)
    payment = PaymentSerializer(required=False) # Optional (e.g. Credit Sale)

class SalesOrderListSerializer(serializers.ModelSerializer):
    cashier_name = serializers.CharField(source='user.email', read_only=True)
    customer_name = serializers.CharField(source='customer.name', read_only=True)
    branch_name = serializers.CharField(source='branch.name', read_only=True)
    formatted_date = serializers.DateTimeField(source='created_at', format="%Y-%m-%d %H:%M")

    class Meta:
        model = SalesOrder
        fields = [
            'id', 'branch_name', 'cashier_name', 
            'customer_name', 'total_amount', 'amount_paid', 
            'payment_status', 'formatted_date'
        ]
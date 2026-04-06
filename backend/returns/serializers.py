from rest_framework import serializers
from .models import ReturnOrder, ReturnItem

class ReturnItemOutputSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='original_item.product.name', read_only=True)
    cost_price = serializers.DecimalField(source='original_item.cost_price_at_sale', max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = ReturnItem
        fields = ['id', 'product_name', 'quantity_returned', 'refund_amount', 'condition', 'cost_price']

class ReturnOrderListOutputSerializer(serializers.ModelSerializer):
    cashier_name = serializers.CharField(source='cashier.get_full_name', read_only=True)
    original_receipt_number = serializers.CharField(source='original_order.receipt_number', read_only=True) # Adjust to your actual SalesOrder field

    class Meta:
        model = ReturnOrder
        fields = ['id', 'original_receipt_number', 'cashier_name', 'total_refund_amount', 'created_at', 'reason']

class ReturnOrderDetailOutputSerializer(ReturnOrderListOutputSerializer):
    items = ReturnItemOutputSerializer(many=True, read_only=True)

    class Meta(ReturnOrderListOutputSerializer.Meta):
        fields = ReturnOrderListOutputSerializer.Meta.fields + ['items']
from rest_framework import serializers
from .models import ( Payment, SalesOrder, SaleItem, 
                    Customer, CustomerLedger)

class SaleItemDetailSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    
    class Meta:
        model = SaleItem
        fields = ['product_name', 'quantity', 'unit_price', 'subtotal']

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
    payments = serializers.ListField(child=PaymentSerializer(), required=False) # Optional (e.g. Credit Sale)

class PaymentDetailSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = ['method', 'amount', 'reference_code', 'created_at']

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

class SalesOrderDetailSerializer(serializers.ModelSerializer):
    items = SaleItemDetailSerializer(many=True, read_only=True)
    payments = PaymentDetailSerializer(many=True, read_only=True)
    
    cashier_name = serializers.CharField(source='user.email', read_only=True)
    customer_name = serializers.CharField(source='customer.name', read_only=True)
    branch_name = serializers.CharField(source='branch.name', read_only=True)
    formatted_date = serializers.DateTimeField(source='created_at', format="%Y-%m-%d %H:%M")

    class Meta:
        model = SalesOrder
        fields = [
            'id', 'branch_name', 'cashier_name', 'customer_name', 
            'total_amount', 'amount_paid', 'payment_status', 
            'formatted_date', 'items', 'payments', 'customer_snapshot'
        ]



#Customer CRUD Serializer
class CustomerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Customer
        fields = ['id', 'name', 'phone', 'email', 'credit_limit', 'current_debt']
        read_only_fields = ['current_debt'] # Debt is calculated, never set manually

# Pay Debt Input Serializer
class PayDebtSerializer(serializers.Serializer):
    branch_id = serializers.UUIDField()
    amount = serializers.DecimalField(max_digits=12, decimal_places=2)
    method = serializers.CharField(max_length=50) # Cash, Transfer, etc.
    notes = serializers.CharField(required=False, allow_blank=True)

# 3. Ledger History Serializer
class CustomerLedgerSerializer(serializers.ModelSerializer):
    formatted_date = serializers.DateTimeField(source='created_at', format="%Y-%m-%d %H:%M")
    
    class Meta:
        model = CustomerLedger
        fields = [
            'id', 'transaction_type', 'amount', 
            'balance_after', 'reference_id', 'notes', 'formatted_date', 'created_at'
        ]
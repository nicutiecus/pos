from rest_framework import serializers
from .models import Product, Category, InventoryBatch

class StockReceiveItemSerializer(serializers.Serializer):
    product_id = serializers.UUIDField()
    quantity = serializers.DecimalField(max_digits=10, decimal_places=2)
    cost_price = serializers.DecimalField(max_digits=10, decimal_places=2)
    batch_number = serializers.CharField(max_length=50) # Supplier's batch No. or Auto-generated
    expiry_date = serializers.DateField(required=False, allow_null=True)

class StockReceiveSerializer(serializers.Serializer):
    """
    Accepts a list of items to receive into a specific branch.
    """
    branch_id = serializers.UUIDField()
    items = StockReceiveItemSerializer(many=True)
    notes = serializers.CharField(required=False, allow_blank=True)



class ProductCreateSerializer(serializers.ModelSerializer):
    category_id = serializers.UUIDField(required=False, allow_null=True)

    class Meta:
        model = Product
        fields = [
            'id', 'name', 'sku', 'category_id', 
            'cost_price', 'selling_price', 'unit_type',
            'has_sub_unit', 'sub_unit_ratio', 'attributes'
        ]

    def validate_sku(self, value):
        user = self.context['request'].user
        if Product.objects.filter(sku=value, tenant=user.tenant).exists():
            raise serializers.ValidationError("A product with this SKU already exists.")
        return value

    def validate_category_id(self, value):
        if value:
            user = self.context['request'].user
            if not Category.objects.filter(id=value, tenant=user.tenant).exists():
                raise serializers.ValidationError("Invalid category.")
        return value

class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ['id', 'name']
        read_only_fields = ['id']

    def validate_name(self, value):
        # Security: Check uniqueness within the specific tenant
        user = self.context['request'].user
        if Category.objects.filter(name__iexact=value, tenant=user.tenant).exists():
            raise serializers.ValidationError("A category with this name already exists.")
        return value



class InventoryLogSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    branch_name = serializers.CharField(source='branch.name', read_only=True)
    received_date = serializers.DateTimeField(source='created_at', format="%Y-%m-%d %H:%M")

    class Meta:
        model = InventoryBatch
        fields = [
            'id', 'branch_name', 'product_name', 'batch_number',
            'quantity_on_hand', 'cost_price_at_receipt', 
            'expiry_date', 'status', 'received_date'
        ]


class ProductCatalogSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)

    class Meta:
        model = Product
        fields = [
            'id', 
            'name', 
            'sku', 
            'description', 
            'category_name', 
            'unit_type', 
            'selling_price', 
        ]
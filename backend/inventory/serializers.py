from rest_framework import serializers
from .models import (Product, Category, InventoryBatch, StockTransferLog, ProductPriceHistory, 
                     InventoryLog, Supplier, PurchaseOrder)
from .models import PurchaseOrder, PurchaseOrderItem  # Import your item model!


class StockReceiveItemSerializer(serializers.Serializer):
    product_id = serializers.UUIDField()
    quantity = serializers.DecimalField(max_digits=10, decimal_places=2)
    cost_price = serializers.DecimalField(max_digits=10, decimal_places=2)
    batch_number = serializers.CharField(max_length=50) # Supplier's batch No. or Auto-generated
    expiry_date = serializers.DateField(required=False, allow_null=True)

    #fields= ['product_id', 'quantity', 'cost_price','batch_number', 'expiry_date', 'created_at']

class StockReceiveSerializer(serializers.Serializer):
    """
    Accepts a list of items to receive into a specific branch.
    """
    purchase_order_id = serializers.CharField()
    branch_id = serializers.UUIDField()
    items = StockReceiveItemSerializer(many=True)
    notes = serializers.CharField(required=False, allow_blank=True)
    amount_paid_upfront = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, default=0.00)



class ProductCreateSerializer(serializers.ModelSerializer):
    category_id = serializers.IntegerField(required=False, allow_null=True)

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
    date = serializers.DateTimeField(source='created_at', format="%Y-%m-%d %H:%M")
    user_name = serializers.SerializerMethodField()
    

    class Meta:
        model = InventoryLog
        fields = [
            'id', 
            'date',
            'product_name', 
            'branch_name', 
            'user_name', 
            'transaction_type', 
            'reason', 
            'quantity', 
            'total_value', 
            'notes'
        ]

    def get_user_name(self, obj):
        if obj.user:
            return obj.user.get_full_name() or obj.user.email
        return "System"



class RemoveStockSerializer(serializers.Serializer):
    
    product_id = serializers.IntegerField() 
    branch_id = serializers.UUIDField()
    quantity = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=0.01)
    reason = serializers.CharField(max_length=50)
    notes = serializers.CharField(required=False, allow_blank=True)

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



class StockTransferSerializer(serializers.Serializer):
    source_branch_id = serializers.UUIDField()
    destination_branch_id = serializers.UUIDField()
    product_id = serializers.UUIDField()
    quantity = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=0.01)
    notes = serializers.CharField(required=False, allow_blank=True)


class StockTransferLogSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    source_branch_name = serializers.CharField(source='source_branch.name', read_only=True)
    destination_branch_name = serializers.CharField(source='destination_branch.name', read_only=True)
    transferred_by_email = serializers.CharField(source='transferred_by.email', read_only=True, default="System")
    formatted_date = serializers.DateTimeField(source='created_at', format="%Y-%m-%d %H:%M")

    class Meta:
        model = StockTransferLog
        fields = [
            'id', 'product_name', 'source_branch_name', 'destination_branch_name',
            'quantity', 'transferred_by_email', 'notes', 'formatted_date', 'status'
        ]



class UpdateProductPriceSerializer(serializers.Serializer):
    new_price = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=0.01)



class ProductPriceHistorySerializer(serializers.ModelSerializer):
    changed_by_name = serializers.CharField(source='changed_by.get_full_name', read_only=True, default="System")

    class Meta:
        model = ProductPriceHistory
        fields = ['id', 'old_price', 'new_price', 'changed_by_name', 'created_at']




class InventoryBatchSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_sku = serializers.CharField(source='product.sku', read_only=True)
    branch_name = serializers.CharField(source='branch.name', read_only=True)
    
    class Meta:
        model = InventoryBatch
        fields = [
            'id', 
            'product_name', 
            'product_sku',
            'branch_name', 
            'batch_number', 
            'quantity_on_hand', 
            'cost_price_at_receipt', 
            'expiry_date', 
            'status', 
            'created_at'
        ]



class PurchaseOrderItemCreateSerializer(serializers.Serializer):
    product_id = serializers.IntegerField(
        help_text="The ID of the product being ordered."
    )
    expected_quantity = serializers.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        min_value=0.01, # Prevents ordering 0 or negative quantities
        error_messages={"min_value": "Quantity must be greater than zero."}
    )
    agreed_unit_price = serializers.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        min_value=0.00
    )

class PurchaseOrderCreateSerializer(serializers.Serializer):
    branch_id = serializers.UUIDField()
    supplier_id = serializers.CharField(max_length=50)
    
    # allow_null lets the frontend explicitly send `null` if the date is unknown
    expected_delivery_date = serializers.DateField(required=False, allow_null=True)
    
    # allow_blank lets the frontend send an empty string ""
    notes = serializers.CharField(required=False, allow_blank=True)
    
    # Here we nest the item serializer. 
    # allow_empty=False ensures they can't send a PO with 0 items!
    purchase_items = PurchaseOrderItemCreateSerializer(many=True, allow_empty=False)



class PurchaseOrderListSerializer(serializers.ModelSerializer):
    # Extract names from the related foreign keys to match frontend expectations
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    branch_name = serializers.CharField(source='branch.name', read_only=True)

    class Meta:
        model = PurchaseOrder
        fields = [
            'id', 
            'supplier_name', 
            'branch_name', 
            'expected_delivery_date', 
            'total_estimated_amount', 
            'status', 
            'created_at'
        ]


    
class SupplierSerializer(serializers.ModelSerializer):
    class Meta:
        model = Supplier
        fields = ['id', 'name','email', 'phone', 'address', 'contact_person', 'bank_details',
                 'tax_identification_number', 'current_debt']
        read_only_fields = ['id']

    def validate_name(self, value):
        # Security: Check uniqueness within the specific tenant
        user = self.context['request'].user
        if Supplier.objects.filter(name__iexact=value, tenant=user.tenant).exists():
            raise serializers.ValidationError("A supplier with this name already exists.")
        return value




class PurchaseOrderItemDetailSerializer(serializers.ModelSerializer):
    # Get the actual string name of the product
    product_name = serializers.CharField(source='product.name', read_only=True)

    class Meta:
        model = PurchaseOrderItem
        # Ensure these match your frontend expectations
        fields = ['product_id', 'product_name', 'expected_quantity', 'agreed_unit_price','subtotal']


class PurchaseOrderDetailSerializer(serializers.ModelSerializer):
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    branch_name = serializers.CharField(source='branch.name', read_only=True)
    
    # NESTED SERIALIZER: Grab the items! 
    # Note: Change 'items' to whatever your related_name is on the PurchaseOrder model. 
    # (If you didn't set a related_name, it defaults to 'purchaseorderitem_set')
    purchase_items = PurchaseOrderItemDetailSerializer(source='items', many=True, read_only=True) 

    class Meta:
        model = PurchaseOrder
        fields = [
            'id', 
            'supplier_name', 
            'branch_name', 
            'branch_id', 
            'expected_delivery_date', 
            'status', 
            'purchase_items',
            'total_estimated_amount'
        ]

class PaySupplierCreditSerializer(serializers.Serializer):
    branch_id = serializers.UUIDField()
    amount = serializers.DecimalField(max_digits=12, decimal_places=2)
    method = serializers.CharField(max_length=50) # Cash, Transfer, etc.
    notes = serializers.CharField(required=False, allow_blank=True)
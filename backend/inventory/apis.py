from rest_framework import views, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .serializers import (StockReceiveSerializer, ProductCreateSerializer,
                           CategorySerializer, InventoryLogSerializer)
from .services import receive_stock_service, create_product_service, create_category_service
from .selectors import (get_stock_levels, get_expiring_batches, get_categories, 
                        get_inventory_logs, get_products_for_tenant) 
from django.core.exceptions import PermissionDenied



class StockReceiveApi(views.APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = StockReceiveSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            receive_stock_service(
                user=request.user,
                branch_id=serializer.validated_data['branch_id'],
                items=serializer.validated_data['items'],
                notes=serializer.validated_data.get('notes', '')
            )
            return Response({"message": "Stock received successfully."}, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

class StockLevelApi(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, branch_id):
        try:
            # Notice we now pass 'user=request.user' instead of 'tenant_id'
            data = get_stock_levels(user=request.user, branch_id=branch_id)
            return Response(data, status=status.HTTP_200_OK)
            
        except PermissionDenied as e:
            # ✅ Returns a 403 Forbidden if they try to view another branch
            return Response({"error": str(e)}, status=status.HTTP_403_FORBIDDEN)

class ExpiringStockApi(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, branch_id):
        # Security Check
        if not request.user.get_accessible_branches().filter(id=branch_id).exists():
            return Response({"error": "Unauthorized branch access"}, status=status.HTTP_403_FORBIDDEN)
            
        threshold = int(request.GET.get('days', 7)) # Default to 7 days
        
        batches = get_expiring_batches(
            branch_id=branch_id, 
            tenant_id=request.user.tenant.id, 
            days_threshold=threshold
        )
        
        # Simple manual serialization for the selector output
        data = [{
            "batch_number": b.batch_number,
            "product_name": b.product.name,
            "expiry_date": b.expiry_date,
            "quantity": b.quantity_on_hand
        } for b in batches]
        
        return Response(data)


class ProductCreateApi(views.APIView):
    permission_classes = [IsAuthenticated] # Optional: Add IsTenantAdmin

    def get(self,request):
        
        products = get_products_for_tenant(user=request.user)
        return Response(list(products), status=status.HTTP_200_OK)


    def post(self, request):
        serializer = ProductCreateSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)

        create_product_service(
            user=request.user, 
            data=serializer.validated_data
        )

        return Response(serializer.data, status=status.HTTP_201_CREATED)
    

    



class CategoryListCreateApi(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        categories = get_categories(user=request.user)
        # We can reuse the serializer for output formatting
        data = CategorySerializer(categories, many=True).data
        return Response(data)

    def post(self, request):
        serializer = CategorySerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)

        category = create_category_service(
            user=request.user,
            name=serializer.validated_data['name']
        )
        
        # Return the created category so the frontend can immediately add it to the dropdown
        return Response(CategorySerializer(category).data, status=status.HTTP_201_CREATED)
    


class InventoryLogListApi(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        branch_id = request.GET.get('branch_id')
        
        logs = get_inventory_logs(user=request.user, branch_id=branch_id)
        
        # Optional: Add Pagination here if lists get too long
        serializer = InventoryLogSerializer(logs, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
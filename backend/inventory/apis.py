from rest_framework import views, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .serializers import (StockReceiveSerializer, ProductCreateSerializer,
                           CategorySerializer, InventoryLogSerializer, UpdateProductPriceSerializer,
                           StockTransferSerializer, StockTransferLogSerializer, ProductPriceHistorySerializer,
                           RemoveStockSerializer)
from .services import (receive_stock_service, create_product_service, 
                       create_category_service, accept_transfer_service, initiate_transfer_service,
                       reject_transfer_service, update_product_price_service, remove_stock_service)
from .selectors import (get_stock_levels, get_expiring_batches, get_categories, 
                        get_inventory_logs, get_products_for_tenant, get_product_catalog, get_stock_transfer_logs,
                        get_product_price_history, get_organization_stock_levels
                        )
from django.core.exceptions import PermissionDenied, ValidationError
from .models import StockTransferLog

from rest_framework.views import APIView





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
    


class ProductCatalogApi(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # The selector now handles Caching AND Serialization
        data = get_product_catalog(user=request.user)
        return Response(data, status=status.HTTP_200_OK)



class StockTransferApi(views.APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = StockTransferSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            transfer_log = initiate_transfer_service(
                user=request.user,
                source_branch_id=serializer.validated_data['source_branch_id'],
                destination_branch_id=serializer.validated_data['destination_branch_id'],
                product_id=serializer.validated_data['product_id'],
                quantity=serializer.validated_data['quantity'],
                notes=serializer.validated_data.get('notes', '')
            )
            response_data = StockTransferLogSerializer(transfer_log).data
            
            return Response({
                "message": "Stock transferred successfully.",
                "details": response_data
            }, status=status.HTTP_200_OK)

        except ValidationError as e:
            return Response({"error": e.message}, status=status.HTTP_400_BAD_REQUEST)
        



class StockTransferLogListApi(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        branch_id = request.GET.get('branch_id')
        # Read new filters from the URL
        status_filter = request.GET.get('status')
        direction = request.GET.get('direction')
        
        logs = get_stock_transfer_logs(user=request.user, branch_id=branch_id,
                                       status=status_filter, direction=direction)
        serializer = StockTransferLogSerializer(logs, many=True)
        
        return Response(serializer.data, status=status.HTTP_200_OK)
    


class AcceptTransferApi(views.APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, transfer_id):
        try:
            transfer = accept_transfer_service(
                user=request.user, 
                transfer_id=transfer_id
            )
            return Response({
                "message": "Stock received and added to inventory.",
                "status": transfer.status
            }, status=status.HTTP_200_OK)
            
        except StockTransferLog.DoesNotExist:
            return Response({"error": "Transfer record not found."}, status=status.HTTP_404_NOT_FOUND)
        except ValidationError as e:
            return Response({"error": e.message}, status=status.HTTP_400_BAD_REQUEST)
        



class RejectTransferApi(views.APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, transfer_id):
        # We can just read the reason directly from request.data
        reason = request.data.get('reason', '')

        try:
            transfer = reject_transfer_service(
                user=request.user, 
                transfer_id=transfer_id,
                reason=reason
            )
            return Response({
                "message": "Stock transfer rejected. Inventory returned to source branch.",
                "status": transfer.status,
                "notes": transfer.notes
            }, status=status.HTTP_200_OK)
            
        except StockTransferLog.DoesNotExist:
            return Response({"error": "Transfer record not found."}, status=status.HTTP_404_NOT_FOUND)
        except ValidationError as e:
            return Response({"error": e.message}, status=status.HTTP_400_BAD_REQUEST)
        


class RemoveStockAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = RemoveStockSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            # Extract validated data
            data = serializer.validated_data
            
            remove_stock_service(
                user=request.user,
                product_id=data['product_id'],
                branch_id=data['branch_id'],
                quantity=data['quantity'],
                reason=data['reason'],
                notes=data.get('notes', '')
            )
            
            return Response(
                {"message": "Stock successfully removed and logged."}, 
                status=status.HTTP_200_OK
            )
            
        except ValidationError as e:
            error_msg = e.message if hasattr(e, 'message') else str(e)
            return Response({"error": error_msg}, status=status.HTTP_400_BAD_REQUEST)

class UpdateProductPriceApi(views.APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, product_id):
        # 🔒 Strict Security: Only Admins or Managers can change prices
        if request.user.role not in ['Admin','Tenant_Admin', 'Super_Admin', 'Manager']:
            return Response(
                {"error": "You do not have permission to change product prices."},
                status=status.HTTP_403_FORBIDDEN
            )

        serializer = UpdateProductPriceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            product = update_product_price_service(
                user=request.user,
                product_id=product_id,
                new_price=serializer.validated_data['new_price']
            )

            return Response({
                "message": "Price updated successfully.",
                "product_id": product.id,
                "new_price": product.selling_price
            }, status=status.HTTP_200_OK)

        except ValidationError as e:
            return Response({"error": e.message}, status=status.HTTP_400_BAD_REQUEST)




class ProductPriceHistoryApi(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, product_id):
        history_qs = get_product_price_history(user=request.user, product_id=product_id)
        serializer = ProductPriceHistorySerializer(history_qs, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
    


class OrganizationStockLevelsAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        
        # 🔒 Security Check: Block standard cashiers
        admin_roles = ['Admin', 'Tenant_Admin', 'Super_Admin']
        if getattr(user, 'role', '') not in admin_roles and not user.is_superuser:
            raise PermissionDenied("Access restricted. Only Tenant Admins can view organization-wide stock.")
        
        # Fetch data via selector
        data = get_organization_stock_levels(user=user)
        
        return Response(data)
    

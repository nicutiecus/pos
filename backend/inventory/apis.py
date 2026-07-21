from rest_framework import views, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from users.permissions import HasRequiredPermission
from .serializers import (StockReceiveSerializer, ProductCreateSerializer,
                           CategorySerializer, InventoryLogSerializer, UpdateProductPriceSerializer,
                           StockTransferSerializer, StockTransferLogSerializer, ProductPriceHistorySerializer,
                           RemoveStockSerializer, PurchaseOrderCreateSerializer, InventoryBatchSerializer,
                           SupplierSerializer, PurchaseOrderListSerializer, PurchaseOrderDetailSerializer,
                           PaySupplierCreditSerializer)
from .services import (receive_stock_service, create_product_service, 
                       create_category_service, accept_transfer_service, initiate_transfer_service,
                       reject_transfer_service, update_product_price_service, remove_stock_service,
                       remove_category_service, create_purchase_order_service, create_supplier_service,
                       update_supplier_service, delete_supplier_service, pay_supplier_credit_service)
from .selectors import (get_stock_levels, get_expiring_batches, get_categories, 
                        get_inventory_logs, get_products_for_tenant, get_product_catalog, get_stock_transfer_logs,
                        get_product_price_history, get_organization_stock_levels, get_inventory_batches,
                        get_suppliers, get_purchase_orders
                        )
from django.core.exceptions import PermissionDenied, ValidationError
from .models import StockTransferLog, Supplier, PurchaseOrder

from rest_framework.views import APIView

from django.db.models import ProtectedError






class StockReceiveApi(views.APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = StockReceiveSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            po = PurchaseOrder.objects.get(
                id=data['purchase_order_id'], 
                tenant=request.user.tenant
            )
            print(f"DEBUG: PO Supplier ID is: {po.supplier_id}")
            receive_stock_service(
                user=request.user,
                purchase_order_id=data['purchase_order_id'],
                branch_id=data['branch_id'],
                supplier_id= po.supplier_id,
                items=data['items'],
                amount_paid_upfront=data.get('amount_paid_upfront'),
                notes=data.get('notes', '')
            )
            return Response({"message": "Stock received successfully."}, status=status.HTTP_201_CREATED)
        except ValidationError as e:
            error_msg = e.message if hasattr(e, 'message') else str(e)
            return Response({"error": error_msg}, status=status.HTTP_400_BAD_REQUEST)

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
    permission_classes = [IsAuthenticated, HasRequiredPermission]

    required_permission= 'create_products'

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
    

class CategoryDeleteApi(views.APIView):
    permission_classes = [IsAuthenticated]
    def delete(self, request, pk):
            try:
                # Pass the request user and the category ID (pk) from the URL to your service
                remove_category_service(user=request.user, category_id=pk)
                return Response(status=status.HTTP_204_NO_CONTENT)
                
            except ValidationError as e:
                # If the category has products, the service raises a ValidationError.
                # Catch it and send the friendly message back to the React frontend.
                # If products are still attached, this catches the error and sends it to React
                error_message = str(e.message) if hasattr(e, 'message') else str(e[0])
                return Response(
                    {"message": error_message},
                    status=status.HTTP_400_BAD_REQUEST
                )


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
    


class InventoryBatchListAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Extract optional query parameters
        branch_id = request.query_params.get('branch_id')
        
        # Default to only showing batches that actually have stock
        active_only_param = request.query_params.get('active_only', 'true').lower()
        active_only = active_only_param == 'true'

        # Fetch and serialize
        batches = get_inventory_batches(
            user=request.user, 
            branch_id=branch_id, 
            active_only=active_only
        )
        
        serializer = InventoryBatchSerializer(batches, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
    

class PurchaseOrderCreateApi(views.APIView):
    permission_classes = [IsAuthenticated, HasRequiredPermission]

    required_permission= 'create_purchase_order'

    def post(self,request):

        serializer= PurchaseOrderCreateSerializer(data=request.data)

        serializer.is_valid(raise_exception=True)

        # 3. Extract the clean, validated data
        data = serializer.validated_data

        try:
            purchase_order= create_purchase_order_service(
                user= request.user, 
                branch_id=data["branch_id"], 
                supplier_id= data["supplier_id"], 
                items=data["purchase_items"], 
                expected_delivery_date=data.get("expected_delivery_date"),
                notes=data.get("notes")
            )
            
            
            
            return Response({"message": "Purchase Order created", "product_id": purchase_order.id }, status=status.HTTP_201_CREATED)
        except ValidationError as e:
            error_msg = e.message if hasattr(e, 'message') else str(e)
            return Response({"error": error_msg}, status=status.HTTP_400_BAD_REQUEST)



class PurchaseOrderListApi(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Extract query parameters from the URL
        branch_id = request.query_params.get('branch_id')
        search_query = request.query_params.get('search')
        status_filter = request.query_params.get('status') # <-

        # Fetch the secure list of orders via the selector
        orders = get_purchase_orders(
            user=request.user,
            branch_id=branch_id,
            search_query=search_query,
            status= status_filter
        )

        # Serialize the data and return it
        serializer = PurchaseOrderListSerializer(orders, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)  

class SupplierListCreateApi(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        suppliers = get_suppliers(user=request.user)
        # We can reuse the serializer for output formatting
        data = SupplierSerializer(suppliers, many=True).data
        return Response(data)

    def post(self, request):
        serializer = SupplierSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)

        data=serializer.validated_data

        supplier = create_supplier_service(
            user=request.user,
            name=data['name'],
            email= data.get('email'),
            phone= data.get('phone'),
            address= data.get('address'),
            contact_person= data.get('contact_person'),
            bank_details= data.get('bank_details',{}),
            current_debt= data.get('current_debt',0.00)
        )
        
        # Return the created supplier so the frontend can immediately add it to the dropdown
        return Response(SupplierSerializer(supplier).data, status=status.HTTP_201_CREATED)
    

class SupplierDetailApi(views.APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, supplier_id):
        # partial=True allows us to only validate the fields sent in the request (e.g., just debt_limit)
        serializer = SupplierSerializer(data=request.data, partial=True, context={'request': request})
        serializer.is_valid(raise_exception=True)
        
        try:
            supplier = update_supplier_service(
                user=request.user,
                supplier_id=supplier_id,
                data=serializer.validated_data
            )
            return Response(SupplierSerializer(supplier).data, status=status.HTTP_200_OK)
            
        except Supplier.DoesNotExist:
            return Response({"error": "Supplier not found."}, status=status.HTTP_404_NOT_FOUND)
        except ValidationError as e:
            error_msg = e.message if hasattr(e, 'message') else str(e)
            return Response({"error": error_msg}, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, supplier_id):
        try:
            delete_supplier_service(
                user=request.user, 
                supplier_id=supplier_id
            )
            return Response(status=status.HTTP_204_NO_CONTENT)
            
        except Supplier.DoesNotExist:
            return Response({"error": "Supplier not found."}, status=status.HTTP_404_NOT_FOUND)
        except ValidationError as e:
            error_msg = e.message if hasattr(e, 'message') else str(e)
            return Response({"error": error_msg}, status=status.HTTP_400_BAD_REQUEST)



class PurchaseOrderDetailApi(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, po_id):
        try:
            # We use select_related and prefetch_related to optimize the database query 
            # and prevent the "N+1 query problem" when fetching nested items.
            po = PurchaseOrder.objects.select_related('supplier', 'branch').prefetch_related('items__product').get(
                id=po_id, 
                tenant=request.user.tenant
            )

            # 🔒 Security: If the user is a manager, ensure this PO belongs to their branch
            if request.user.role not in ['Admin', 'Tenant_Admin', 'Super_Admin']:
                if po.branch_id != request.user.branch_id:
                    return Response(
                        {"error": "Unauthorized access to this branch's Purchase Order."}, 
                        status=status.HTTP_403_FORBIDDEN
                    )

            # Serialize and return
            serializer = PurchaseOrderDetailSerializer(po)
            return Response(serializer.data, status=status.HTTP_200_OK)

        except PurchaseOrder.DoesNotExist:
            return Response({"error": "Purchase order not found."}, status=status.HTTP_404_NOT_FOUND)
        

class PaySupplierCreditApi(views.APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, supplier_id):
        serializer = PaySupplierCreditSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
    

        try:
            ledger = pay_supplier_credit_service(
                user=request.user,
                supplier_id=supplier_id,
                branch_id=serializer.validated_data['branch_id'],
                amount=serializer.validated_data['amount'],
                method=serializer.validated_data['method'],
                processed_by = request.user,
                notes=serializer.validated_data.get('notes', ''),
            )
            
            return Response({
                "message": "Payment successful",
                "new_balance": ledger.balance_after,
                "amount": ledger.amount,
                "transaction_id": ledger.id,
                "receipt_no": ledger.reference_id
            }, status=status.HTTP_200_OK)

        except ValidationError as e:
            error_message = e.messages[0] if hasattr(e, 'messages') else str(e)
            return Response({"error": error_message}, status=status.HTTP_400_BAD_REQUEST)
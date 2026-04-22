from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .selectors import get_branch_returns, get_return_order_details
from .serializers import ReturnOrderListOutputSerializer, ReturnOrderDetailOutputSerializer
from .services import process_customer_return
from sales.models import SalesOrder
from common.pagination import StandardResultsSetPagination

class ReturnOrderListCreateAPIView(APIView):
    pagination_class = StandardResultsSetPagination

    def get(self, request):
        """List all returns for the branch, optionally filtered by date."""
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')

        query_branch_id = request.query_params.get('branch_id') or request.user.branch_id
        query_tenant = request.query_params.get('tenant') or request.user.tenant

        returns_qs = get_branch_returns(
            tenant=query_tenant,
            branch_id=query_branch_id,
            start_date=start_date,
            end_date=end_date
        )

        paginator = self.pagination_class()
        paginated_qs = paginator.paginate_queryset(returns_qs, request, view=self)
        
       
        serializer = ReturnOrderListOutputSerializer(paginated_qs, many=True)
        
        return paginator.get_paginated_response(serializer.data)

    def post(self, request):
        """Process a new return transaction."""
        original_order_id = request.data.get('original_order_id')
        return_data = request.data.get('items', [])
        reason = request.data.get('reason', '')
        branch_id = request.data.get('branch_id')

        """# --- Debugging Log ---
        print(f"DEBUG: Looking for Order ID: {original_order_id}")
        print(f"DEBUG: Request User Tenant: {request.user.tenant}")
        print(f"DEBUG: Request User Branch: {branch_id}")
        """
    # -------------

        try:
            # 1. Fetch the parent order securely
            original_order = SalesOrder.objects.get(
                id=original_order_id, 
                tenant=request.user.tenant, 
                branch_id=branch_id
            )
            
            # 2. Hand off to the service layer (from our previous step)
            return_order = process_customer_return(
                tenant=request.user.tenant,
                branch_id=branch_id,
                original_order=original_order,
                cashier=request.user,
                return_data=return_data,
                reason=reason
            )
            
            return Response(
                {"message": "Return processed successfully.", "return_order_id": return_order.id}, 
                status=status.HTTP_201_CREATED
            )

        except SalesOrder.DoesNotExist:
            return Response({"error": "Original order not found."}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class ReturnOrderDetailAPIView(APIView):
    def get(self, request, return_order_id):
        """Get the full receipt details of a specific return."""
        return_order = get_return_order_details(
            tenant=request.user.tenant,
            branch_id=request.user.branch_id,
            return_order_id=return_order_id
        )

        if not return_order:
            return Response({"error": "Return order not found."}, status=status.HTTP_404_NOT_FOUND)

        serializer = ReturnOrderDetailOutputSerializer(return_order)
        return Response(serializer.data, status=status.HTTP_200_OK)
from rest_framework import views, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.core.exceptions import ValidationError
from .selectors import get_sales_list, get_sale_detail, get_customer_ledger
from .serializers import (SalesOrderListSerializer, SalesOrderDetailSerializer, 
                          CreateSaleSerializer, PayDebtSerializer, CustomerLedgerSerializer)

from .services import create_sale_service, pay_customer_debt_service
from .serializers import PayDebtSerializer





class CreateSaleApi(views.APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = CreateSaleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            order = create_sale_service(
                user=request.user,
                branch_id=serializer.validated_data['branch_id'],
                customer_id=serializer.validated_data.get('customer_id'),
                items=serializer.validated_data['items'],
                payments=serializer.validated_data.get('payments',[])
            )
            
            return Response({
                "id": order.id,
                "total_amount": order.total_amount,
                "status": order.payment_status,
                "message": "Sale completed successfully."
            }, status=status.HTTP_201_CREATED)

        except ValidationError as e:
            return Response({"error": e.message}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            # In production, log this error internally
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        


class SalesListApi(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        branch_id = request.GET.get('branch_id') # Optional filter
        
        # Security: If user is not admin, force them to only see their branch
        # (You can implement this logic later if needed)

        sales = get_sales_list(user=request.user, branch_id=branch_id)
        
        # Pagination could be added here later
        serializer = SalesOrderListSerializer(sales, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)




class SalesDetailApi(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, sale_id):
        sale = get_sale_detail(user=request.user, sale_id=sale_id)
        serializer = SalesOrderDetailSerializer(sale)
        return Response(serializer.data, status=status.HTTP_200_OK)



class CustomerLedgerApi(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, customer_id):
        ledger_records = get_customer_ledger(user=request.user, customer_id=customer_id)
        serializer = CustomerLedgerSerializer(ledger_records, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
    


class PayDebtApi(views.APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, customer_id):
        serializer = PayDebtSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            ledger = pay_customer_debt_service(
                user=request.user,
                customer_id=customer_id,
                branch_id=serializer.validated_data['branch_id'],
                amount=serializer.validated_data['amount'],
                method=serializer.validated_data['method'],
                notes=serializer.validated_data.get('notes', '')
            )
            
            return Response({
                "message": "Payment successful",
                "new_balance": ledger.balance_after,
                "transaction_id": ledger.id
            }, status=status.HTTP_200_OK)

        except ValidationError as e:
            return Response({"error": e.message}, status=status.HTTP_400_BAD_REQUEST)
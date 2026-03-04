from rest_framework import views, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.core.exceptions import ValidationError
from .selectors import get_sales_list, get_sale_detail, get_customer_ledger, get_current_shift_data
from .serializers import (SalesOrderListSerializer, SalesOrderDetailSerializer, 
                          CreateSaleSerializer, PayDebtSerializer, CustomerLedgerSerializer,
                          CloseShiftSerializer)

from .services import create_sale_service, pay_customer_debt_service, close_shift_service
from rest_framework.views import APIView
from .models import SalesOrder, ShiftReport
from django.shortcuts import get_object_or_404
from django.utils import timezone





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





class CurrentShiftApi(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        shift_data = get_current_shift_data(user=request.user)
        return Response(shift_data, status=status.HTTP_200_OK)

class CloseShiftApi(views.APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = CloseShiftSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            close_shift_service(
                user=request.user,
                **serializer.validated_data
            )
            return Response({"message": "Shift closed successfully."}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)



class ReceiptAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, order_id):
        # 🔒 1. Fetch the order with strict tenant isolation
        order = get_object_or_404(SalesOrder, id=order_id, tenant=request.user.tenant)
        
        # 🏢 2. Format Branch/Store Information
        branch_info = {
            "name": order.branch.name,
            # Assuming your Branch model has phone and address fields
            "address": getattr(order.branch, 'address', ''), 
            "phone": getattr(order.branch, 'phone', '')
        }

        # 👤 3. Format Customer Information (If attached)
        customer_info = None
        if order.customer:
            customer_info = {
                "name": order.customer.name,
                "phone": order.customer.phone,
                "current_debt": order.customer.current_debt
            }

        # 🛍️ 4. Format the Items Array
        items_list = []
        for item in order.items.select_related('product').all():
            items_list.append({
                "product_name": item.product.name, # Adjust if your product name field is different
                "quantity": item.quantity,
                "unit_price": item.unit_price,
                "subtotal": item.subtotal
            })

        # 💳 5. Format the Payments Array (Handles split payments!)
        payments_list = []
        for payment in order.payments.all():
            payments_list.append({
                "method": payment.method,
                "amount": payment.amount
            })

        # 🧾 6. Construct the Final Print Payload
        receipt_data = {
            "receipt_no": str(order.id).split('-')[0].upper(), # Generates a short, readable receipt string from the UUID
            "date": order.created_at.strftime("%Y-%m-%d %I:%M %p"), # e.g., 2026-03-04 02:30 PM
            "cashier": order.user.get_full_name() or order.user.email,
            
            "store": branch_info,
            "customer": customer_info,
            "items": items_list,
            
            "totals": {
                # Calculate subtotal before discounts
                "subtotal": order.total_amount + order.discount_amount, 
                "discount": order.discount_amount,
                "grand_total": order.total_amount,
                "amount_paid": order.amount_paid,
                # If they overpaid in cash, this is their change. If they underpaid, it's their remaining balance.
                "change_or_balance": order.amount_paid - order.total_amount 
            },
            
            "payment_methods": payments_list,
            "payment_status": order.payment_status
        }

        return Response(receipt_data)



from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status as drf_status
from .models import ShiftReport

class ActiveShiftAPIView(APIView):
    """
    Checks if the logged-in user currently has an Open shift.
    Called immediately when the React frontend loads the POS page.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        
        # Look for this specific user's 'Open' shift
        active_shift = ShiftReport.objects.filter(
            cashier=user, 
            tenant=user.tenant,
            status=ShiftReport.Status.OPEN
        ).first()

        if active_shift:
            # They already have an open shift, send them right back to selling!
            return Response({
                "status": "active",
                "shift_code": active_shift.shift_code,
                "start_time": active_shift.start_time,
                "expected_cash": active_shift.expected_cash
            })
        
        # No active shift found. Frontend should route them to the "Start Shift" screen.
        return Response({
            "status": "none"
        })


class StartShiftAPIView(APIView):
    """
    Creates a brand new Open shift for the cashier.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        
        # Safety Check: Prevent the creation of duplicate open shifts
        active_shift = ShiftReport.objects.filter(
            cashier=user, 
            tenant=user.tenant,
            status=ShiftReport.Status.OPEN
        ).first()

        if active_shift:
            return Response(
                {"error": "You already have an open shift.", "shift_code": active_shift.shift_code}, 
                status=drf_status.HTTP_400_BAD_REQUEST
            )

        # Create the new shift
        # Note: Assuming your user model has a 'branch' foreign key attached to it!
        new_shift = ShiftReport.objects.create(
            tenant=user.tenant,
            branch=user.branch, 
            cashier=user,
            status=ShiftReport.Status.OPEN
            # Note: expected_cash defaults to 0 based on your model, 
            # but if you accept an 'opening_float' from the frontend, you would set it here!
        )

        return Response({
            "message": "Shift started successfully.",
            "shift_code": new_shift.shift_code,
            "start_time": new_shift.start_time
        }, status=drf_status.HTTP_201_CREATED)
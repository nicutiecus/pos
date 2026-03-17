from rest_framework import views, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.core.exceptions import ValidationError
from .selectors import (get_sales_list, get_sale_detail, get_customer_ledger, 
                        get_current_shift_data, get_shift_reports, get_shift_report_detail)
from .serializers import (SalesOrderListSerializer, SalesOrderDetailSerializer, 
                          CreateSaleSerializer, PayDebtSerializer, CustomerLedgerSerializer,
                          CloseShiftSerializer, ShiftReportSerializer)

from .services import create_sale_service, pay_customer_debt_service, close_shift_service
from .pagination import StandardResultsSetPagination
from rest_framework.views import APIView
from .models import SalesOrder, ShiftReport, Payment, CustomerLedger
from django.shortcuts import get_object_or_404
from django.utils import timezone
from common.models import Branch
from rest_framework import status as drf_status
from django.db.models import Sum, Q
from django.db.models.functions import Coalesce
from decimal import Decimal




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
                payments=serializer.validated_data.get('payments',[]),
                discount_amount= serializer.validated_data.get('discount_amount')
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
         # 2. Initialize the paginator
        paginator = StandardResultsSetPagination()
        
        # 3. Slice the data based on the ?page= parameter in the URL
        paginated_sales = paginator.paginate_queryset(sales, request)
        
        # 4. Serialize ONLY the 10 items for this specific page
        serializer = SalesOrderListSerializer(paginated_sales, many=True)
        
        # 5. Return the special paginated response format
       
        serializer = SalesOrderListSerializer(sales, many=True)
    
        return paginator.get_paginated_response(serializer.data)




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
                "transaction_id": ledger.id,
                #"receipt_no": ledger.reference_id
            }, status=status.HTTP_200_OK)

        except ValidationError as e:
            return Response({"error": e.message}, status=status.HTTP_400_BAD_REQUEST)




class CurrentShiftApi(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # 1. Fetch the perfectly formatted flat dictionary from the selector
        shift_data = get_current_shift_data(user=request.user)
        
        # 2. Return it directly to the frontend! No serializer needed.
        return Response(shift_data, status=200)

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
            # 1. Calculate Real-Time Cash from New Sales
            sales_cash = Payment.objects.filter(
                tenant=user.tenant, 
                processed_by=user, 
                method='Cash', 
                created_at__gte=active_shift.start_time
            ).aggregate(total=Coalesce(Sum('amount'), Decimal('0.00')))['total']

            # 2. Calculate Real-Time Cash from Debt Recoveries
            debt_cash = Payment.objects.filter(
                tenant=user.tenant, 
                processed_by=user, 
                method='Cash', 
                transaction_type=Payment.Transactiontype.DEBT_PAYMENT, # ✅ Added Transaction Type Filter
                created_at__gte=active_shift.start_time
            ).aggregate(total=Coalesce(Sum('amount'), Decimal('0.00')))['total']
            
            # 3. Combine for the exact drawer balance
            real_time_expected_cash = sales_cash + debt_cash

            return Response({
                "status": "active",
                "shift_code": active_shift.shift_code,
                "start_time": active_shift.start_time,
                "expected_cash": real_time_expected_cash, # ✅ Now 100% accurate!
                "debt_recovery_cash": debt_cash
            })
        
        # No active shift found. Frontend should route them to the "Start Shift" screen.
        return Response({
            "status": "none"
        })


class StartShiftAPIView(APIView):
    """
    Creates a brand new Open shift for the cashier or admin.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        data = request.data
        
        # 1. Prevent duplicate open shifts
        active_shift = ShiftReport.objects.filter(
            cashier=user, 
            status=ShiftReport.Status.OPEN
        ).first()

        if active_shift:
            return Response(
                {"error": "You already have an open shift.", "shift_code": active_shift.shift_code}, 
                status=drf_status.HTTP_400_BAD_REQUEST
            )

        # 2. Determine the correct Branch
        admin_roles = ['Admin', 'Tenant_Admin', 'Super_Admin']
        
        if getattr(user, 'role', '') in admin_roles or user.is_superuser:
            # Admins MUST pass a branch_id from the frontend to tell the system where they are working
            branch_id = data.get('branch_id')
            if not branch_id:
                return Response(
                    {"error": "Admins must select a branch to start a shift."}, 
                    status=drf_status.HTTP_400_BAD_REQUEST
                )
            # TenantAwareModel handles the tenant filtering automatically
            shift_branch = get_object_or_404(Branch, id=branch_id)
        else:
            # Standard users automatically use their assigned branch
            shift_branch = user.branch
            if not shift_branch:
                 return Response(
                    {"error": "Your account is not assigned to a branch. Contact an administrator."}, 
                    status=drf_status.HTTP_400_BAD_REQUEST
                )

        # 3. Create the new shift
        new_shift = ShiftReport.objects.create(
            tenant=user.tenant,
            branch=shift_branch, 
            cashier=user,
            status=ShiftReport.Status.OPEN
            # Add expected_cash here if you accept an opening float from the frontend!
        )

        return Response({
            "message": "Shift started successfully.",
            "shift_code": new_shift.shift_code,
            "start_time": new_shift.start_time,
            "branch_id": shift_branch.id
        }, status=drf_status.HTTP_201_CREATED)
    



class ClosedShiftListApi(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Allow admins to optionally filter by branch using ?branch_id=uuid
        branch_id = request.query_params.get('branch_id')

        search_term = request.query_params.get('search', '').strip()
        
        # Fetch shifts with 'Closed' status
        shifts = get_shift_reports(
            user=request.user, 
            branch_id=branch_id, 
            status='Closed',
             search_term=search_term
        )
        # 2. Initialize the paginator
        paginator = StandardResultsSetPagination()
        
        # 3. Slice the data based on the ?page= parameter in the URL
        paginated_shifts = paginator.paginate_queryset(shifts, request)
        
        # 4. Serialize ONLY the 10 items for this specific page
        serializer = ShiftReportSerializer(paginated_shifts, many=True)
        
        # 5. Return the special paginated response format
        return paginator.get_paginated_response(serializer.data)
    


class ShiftReportDetailApi(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, shift_id):
        # Fetch the specific shift securely
        shift = get_shift_report_detail(user=request.user, shift_id=shift_id)
        
        # Serialize the data
        serializer = ShiftReportSerializer(shift)
        
        return Response(serializer.data, status=status.HTTP_200_OK)
from .models import SalesOrder, CustomerLedger, ShiftReport, SalesOrder, Payment
from django.shortcuts import get_object_or_404
from django.db.models import Sum, Count, Q
from django.db.models.functions import Coalesce
from decimal import Decimal


def get_sales_list(*, user, branch_id=None, search_term=None):
    """
    Fetches sales history for the tenant.
    Optionally filters by branch.
    """
    query = SalesOrder.objects.filter(tenant=user.tenant).select_related(
        'customer', 'user', 'branch'
    ).prefetch_related('payments').order_by('-created_at')


    admin_roles = ['Admin', 'Tenant_Admin', 'Super_Admin']

    if user.role not in admin_roles:
        # Non-admins: FORCE the query to only return their assigned branch
        # Even if they try to pass a different branch_id in the URL, we ignore it.
        query = query.filter(branch_id=user.branch_id)
    
    elif branch_id:
        # Admins: Can see everything, but allow them to filter by a specific branch if requested
        query = query.filter(branch_id=branch_id)
    if search_term:
        query = query.filter(
            Q(id__icontains=search_term) |
            Q(cashier__first_name__icontains=search_term) |
            Q(cashier__last_name__icontains=search_term) |
            Q(cashier__email__icontains=search_term)
        )

    return query.order_by('-created_at')# sales/selectors.py


def get_sale_detail(*, user, sale_id):
    """
    Fetches a single sale with security checks.
    """
    # 🔒 Security: Start with tenant isolation
    qs = SalesOrder.objects.filter(tenant=user.tenant).select_related(
        'branch', 'customer', 'user'
    ).prefetch_related(
        'items', 'items__product', 'payments' # Fetch items and payments efficiently
    )

    # 🔒 Security: If not Admin, ensure they can only see their own branch's sales
    admin_roles = ['Admin', 'Tenant_Admin', 'Super_Admin']
    if user.role not in admin_roles:
        qs = qs.filter(branch_id=user.branch_id)

    return get_object_or_404(qs, id=sale_id)



def get_customer_ledger(*, user, customer_id: str):
    return CustomerLedger.objects.filter(
        tenant=user.tenant, 
        customer_id=customer_id
    ).order_by('-created_at')


def get_current_shift_data(*, user):
    active_branch_id = getattr(user, 'branch_id', None)
    
    # 1. Find the Open Shift
    shift, created = ShiftReport.objects.get_or_create(
        tenant=user.tenant,
        cashier=user, 
        status=ShiftReport.Status.OPEN,
        defaults={'branch_id': active_branch_id}
    )

    # 2. Count New Sales Orders
    order_count = SalesOrder.objects.filter(
        tenant=user.tenant,
        user=user,
        created_at__gte=shift.start_time
    ).count()

    # 3. Aggregate NEW SALES Payment
# 2. Count New Sales Orders
    order_count = SalesOrder.objects.filter(
        tenant=user.tenant, user=user, created_at__gte=shift.start_time
    ).count()

    # 3. 🚀 Aggregate ALL Payments in one single query
    payments = Payment.objects.filter(
        tenant=user.tenant,
        processed_by=user,
        created_at__gte=shift.start_time
    ).aggregate(
        # The ultimate drawer totals (Sales + Debt)
        expected_cash=Coalesce(Sum('amount', filter=Q(method='Cash')), Decimal('0.00')),
        expected_pos=Coalesce(Sum('amount', filter=Q(method='POS')), Decimal('0.00')),
        expected_transfer=Coalesce(Sum('amount', filter=Q(method='Transfer')), Decimal('0.00')),
        total_revenue=Coalesce(Sum('amount'), Decimal('0.00')),
        
        # Breakdown values for the UI
        new_sales_cash=Coalesce(Sum('amount', filter=Q(method='Cash', transaction_type='Sales')), Decimal('0.00')),
        debt_recovery_cash=Coalesce(Sum('amount', filter=Q(method='Cash', transaction_type='Debt Payment')), Decimal('0.00')),
    )
   
    # 6. Return the EXACT JSON dictionary your frontend expects
    return {
        "shift_id": shift.shift_code, # ✅ Restored! Frontend will now find this to close the shift.
        "start_time": shift.start_time.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "cashier_name": user.get_full_name() or user.email,
        "order_count": order_count or 0,
        "expected_cash": payments['expected_cash'] or Decimal('0.00'),
        "expected_pos": payments['expected_pos'] or Decimal('0.00'),
        "expected_transfer": payments['expected_transfer'] or Decimal('0.00'),
        "total_revenue": payments['total_revenue'] or Decimal('0.00'),
        
        # We can still pass the breakdown safely just in case the UI wants to show it
        "breakdown": {
            "new_sales_cash": payments['new_sales_cash'],
            "debt_recovery_cash": payments['debt_recovery_cash']
        }
    }



def get_shift_reports(*, user, branch_id=None, status='Closed', search_term=None):
    """
    Fetches shift reports based on status.
    Cashiers only see their own shifts. Admins see all or filter by branch.
    """
    # Base query
    query = ShiftReport.objects.filter(
        tenant=user.tenant,
        status=status
    ).select_related('cashier', 'branch').order_by('-start_time')

    # Security: Isolate data based on role
    admin_roles = ['Admin', 'Tenant_Admin', 'Super_Admin']
    
    if getattr(user, 'role', '') not in admin_roles and not user.is_superuser:
        # Standard staff/cashiers only see their own shift history
        query = query.filter(cashier=user)
    elif branch_id:
        # Admins can filter down to a specific branch's shifts
        query = query.filter(branch_id=branch_id)
    
    if search_term:
        query = query.filter(
            Q(shift_code__icontains=search_term) |
            Q(cashier__first_name__icontains=search_term) |
            Q(cashier__last_name__icontains=search_term) |
            Q(cashier__email__icontains=search_term)
        )

    return query




def get_shift_report_detail(*, user, shift_id):
    """
    Fetches a specific shift report by its ID or shift_code.
    Enforces role-based security so cashiers can't snoop on other registers.
    """
    query = ShiftReport.objects.filter(
        tenant=user.tenant
    ).select_related('cashier', 'branch')

    # Security: Isolate data based on role
    admin_roles = ['Admin', 'Tenant_Admin', 'Super_Admin']
    
    if getattr(user, 'role', '') not in admin_roles and not user.is_superuser:
        # Cashiers can only view their own shifts
        query = query.filter(cashier=user)

    
    # Fetch by the database ID (or change to shift_code if your frontend uses that in the URL)
    return get_object_or_404(query, id=shift_id)
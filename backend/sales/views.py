# sales/views.py
from rest_framework import viewsets, filters
from rest_framework.permissions import IsAuthenticated
from .models import Customer
from .serializers import CustomerSerializer
from .pagination import StandardResultsSetPagination
from django.db.models.functions import Coalesce
from django.db.models import Sum,Q, F
from decimal import Decimal
from rest_framework.decorators import action
from rest_framework.response import Response

class CustomerViewSet(viewsets.ModelViewSet):
    serializer_class = CustomerSerializer
    permission_classes = [IsAuthenticated]

    # Apply standard pagination
    pagination_class = StandardResultsSetPagination
    
    # Enable the Search Filter backend
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    
    # Define the exact database columns the frontend can search through
    search_fields = ['name', 'email', 'phone']

    ordering_fields = ['name', 'phone', 'current_debt', 'calculated_branch_debt']

    def get_queryset(self):
        query = Customer.objects.filter(tenant=self.request.user.tenant ).order_by('-created_at')
    
        admin_roles = ['Admin', 'Tenant_Admin', 'Super_Admin']
        user = self.request.user

        branch_id_param = self.request.query_params.get('branch_id')
        target_branch_id = None
        if user.role not in admin_roles:
            target_branch_id = user.branch_id
            
        elif branch_id_param:
        # Admins: Can see everything, but allow them to filter by a specific branch if requested
            target_branch_id = branch_id_param

        if target_branch_id:
            query = query.annotate(
                branch_sales=Coalesce(Sum('ledger_entries__amount', filter=Q(
                    ledger_entries__branch_id=target_branch_id,
                    ledger_entries__transaction_type='Sale'
                )), Decimal('0.00')),
                branch_payments_returns=Coalesce(Sum('ledger_entries__amount', filter=Q(
                    ledger_entries__branch_id=target_branch_id,
                    ledger_entries__transaction_type__in=['Payment', 'Return']
                )), Decimal('0.00'))
            ).annotate(
                # Branch Debt = (Total Branch Sales) - (Total Branch Payments + Returns)
                calculated_branch_debt=F('branch_sales') - F('branch_payments_returns')
            )
        else:
            # If an Admin views all branches at once, just fallback to global debt
            query = query.annotate(
                calculated_branch_debt=F('current_debt')
            )

        return query

    
    def paginate_queryset(self, queryset):
        if self.request.query_params.get('no_page') == 'true':
            return None  # Returning None turns off pagination!
        return super().paginate_queryset(queryset)

    def perform_create(self, serializer):
        # Auto-assign the customer to the user's tenant
        serializer.save(tenant=self.request.user.tenant)

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())

        # 2. Calculate the grand total debt using our newly annotated field
        total_debt = queryset.aggregate(
            total=Coalesce(Sum('calculated_branch_debt'), Decimal('0.00'))
        )['total']

        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            response = self.get_paginated_response(serializer.data)
            response.data['total_outstanding_debt'] = total_debt
            return response

        serializer = self.get_serializer(queryset, many=True)
        return Response({
            'total_outstanding_debt': total_debt,
            'results': serializer.data
        })
    
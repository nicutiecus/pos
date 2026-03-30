# sales/views.py
from rest_framework import viewsets, filters
from rest_framework.permissions import IsAuthenticated
from .models import Customer
from .serializers import CustomerSerializer
from .pagination import StandardResultsSetPagination
from django.db.models.functions import Coalesce
from django.db.models import Sum
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

    ordering_fields = ['name', 'phone', 'current debt']

    def get_queryset(self):
        return Customer.objects.filter(tenant=self.request.user.tenant ).order_by('-created_at')
    
    def paginate_queryset(self, queryset):
        if self.request.query_params.get('no_page') == 'true':
            return None  # Returning None turns off pagination!
        return super().paginate_queryset(queryset)

    def perform_create(self, serializer):
        # Auto-assign the customer to the user's tenant
        serializer.save(tenant=self.request.user.tenant)

    def list(self, request, *args, **kwargs):
        # 1. Get the queryset and apply any active Search or Ordering filters
        queryset = self.filter_queryset(self.get_queryset())

        # 2. Calculate the grand total debt for this specific list of customers
        # NOTE: Change 'outstanding_balance' to whatever your actual debt field is named on the Customer model!
        total_debt = queryset.aggregate(
            total=Coalesce(Sum('current_debt'), Decimal('0.00'))
        )['total']

        # 3. Paginate the data exactly as DRF normally would
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            response = self.get_paginated_response(serializer.data)
            
            # 4. Inject our new custom data directly into the top level of the JSON response
            response.data['total_outstanding_debt'] = total_debt
            return response

        # Fallback just in case pagination is ever turned off
        serializer = self.get_serializer(queryset, many=True)
        return Response({
            'total_outstanding_debt': total_debt,
            'results': serializer.data
        })
    
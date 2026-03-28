# sales/views.py
from rest_framework import viewsets, filters
from rest_framework.permissions import IsAuthenticated
from .models import Customer
from .serializers import CustomerSerializer
from .pagination import StandardResultsSetPagination

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

    def perform_create(self, serializer):
        # Auto-assign the customer to the user's tenant
        serializer.save(tenant=self.request.user.tenant)
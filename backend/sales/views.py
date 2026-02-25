# sales/views.py
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from .models import Customer
from .serializers import CustomerSerializer

class CustomerViewSet(viewsets.ModelViewSet):
    serializer_class = CustomerSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Customer.objects.filter(tenant=self.request.user.tenant)

    def perform_create(self, serializer):
        # Auto-assign the customer to the user's tenant
        serializer.save(tenant=self.request.user.tenant)
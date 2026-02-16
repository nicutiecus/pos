# common/views.py
from rest_framework import viewsets
from users.permissions import IsTenantAdmin
from .models import Branch
from .serializers import BranchSerializer

class BranchViewSet(viewsets.ModelViewSet):
    serializer_class = BranchSerializer
    permission_classes = [IsTenantAdmin]

    def get_queryset(self):
        # Security: Only return branches belonging to the user's tenant
        return Branch.objects.filter(tenant=self.request.user.tenant)

    def perform_create(self, serializer):
        # Security: Automatically assign the creator's tenant
        serializer.save(tenant=self.request.user.tenant)
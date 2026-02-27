# common/views.py
from rest_framework import viewsets, status
from users.permissions import IsTenantAdmin
from .models import Branch
from .serializers import BranchSerializer
from rest_framework.decorators import action
from .selectors import get_transfer_destination_branches
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response


class BranchViewSet(viewsets.ModelViewSet):
    serializer_class = BranchSerializer
    permission_classes = [IsTenantAdmin]

    def get_queryset(self):
        # Security: Only return branches belonging to the user's tenant
        return Branch.objects.filter(tenant=self.request.user.tenant)

    def perform_create(self, serializer):
        # Security: Automatically assign the creator's tenant
        serializer.save(tenant=self.request.user.tenant)
    
    @action(detail=False, methods=['get'], url_path='destinations', permission_classes=[IsAuthenticated])
    def destinations(self, request):
        """
        Custom endpoint: /api/branches/destinations/
        Returns all branches except the user's current branch.
        """
        branches = get_transfer_destination_branches(user=request.user)
        serializer = self.get_serializer(branches, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
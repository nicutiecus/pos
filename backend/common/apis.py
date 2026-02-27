from rest_framework import views, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .selectors import (get_transfer_destination_branches, 
                        get_branches_for_tenant, get_tenant_settings)
from .serializers import BranchSerializer, TenantSettingsSerializer

class BranchListApi(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        branches = get_branches_for_tenant(user=request.user)
        serializer = BranchSerializer(branches, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
    


class TenantSettingsApi(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        settings = get_tenant_settings(user=request.user)
        serializer = TenantSettingsSerializer(settings)
        return Response(serializer.data)

    def put(self, request):
        # We use 'put' to update the existing settings object
        settings = get_tenant_settings(user=request.user)
        
        serializer = TenantSettingsSerializer(settings, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        
        return Response(serializer.data)
    



class TransferDestinationBranchListApi(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        branches = get_transfer_destination_branches(user=request.user)
        serializer = BranchSerializer(branches, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
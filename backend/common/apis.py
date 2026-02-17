from rest_framework import views, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from .selectors import get_branches_for_tenant
from .serializers import BranchSerializer

class BranchListApi(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        branches = get_branches_for_tenant(user=request.user)
        serializer = BranchSerializer(branches, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
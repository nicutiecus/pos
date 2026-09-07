from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

class UserMeApi(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        return Response({
            "id": user.id,
            "name": f"{user.first_name} {user.last_name}".strip() or user.username,
            "email": user.email,
            "role": getattr(user, 'role', 'User'),
            "tenant_id": str(user.tenant.id) if hasattr(user, 'tenant') and user.tenant else None
        })
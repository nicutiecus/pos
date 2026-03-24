# users/views.py
from rest_framework_simplejwt.views import TokenObtainPairView
from .serializers import (TenantTokenObtainPairSerializer, TenantRegistrationSerializer, 
                          StaffCreationSerializer, StaffUpdateSerializer)
from rest_framework import generics, viewsets
from rest_framework.permissions import AllowAny
from .permissions import IsTenantAdmin
from .models import User

class CustomTokenObtainPairView(TokenObtainPairView):
    """
    Takes a set of user credentials and returns an access and refresh JSON web
    token pair to prove the authentication of those credentials.
    Includes Tenant and Branch context in the token.
    """
    serializer_class = TenantTokenObtainPairSerializer

class TenantRegistrationView(generics.CreateAPIView):
    permission_classes = [AllowAny] # Public endpoint
    serializer_class = TenantRegistrationSerializer



class StaffViewSet(viewsets.ModelViewSet):
    permission_classes = [IsTenantAdmin]
    serializer_class = StaffCreationSerializer

    def get_queryset(self):
        # Admin can see all staff in their tenant
        return User.objects.filter(tenant=self.request.user.tenant)
    
    def get_serializer_class(self):
        if self.action in ['update', 'partial_update']:
            return StaffUpdateSerializer
        return StaffCreationSerializer
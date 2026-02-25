from django.contrib import admin
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from users.views import TenantRegistrationView, StaffViewSet, CustomTokenObtainPairView
from common.views import BranchViewSet

router = DefaultRouter()
router.register(r'branches', BranchViewSet, basename='branches')
router.register(r'staff', StaffViewSet, basename='staff')

urlpatterns = [
    path('admin/', admin.site.urls),
    #path('api/users/', include('users.urls') ),

    # Auth
    path('api/auth/register/', TenantRegistrationView.as_view(), name='register_tenant'),
    path('api/auth/login/', CustomTokenObtainPairView.as_view(), name='login'), # Returns JWT
    
    # Dashboard Resources
    path('api/', include(router.urls)),
    path('api/inventory/', include('inventory.urls')),
    path('api/sales/', include('sales.urls')),
    path('api/common/', include('common.urls')),
    path('api/reports/', include('reports.urls')),
]

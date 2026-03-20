from django.urls import path
from .apis import SuperAdminStatsApi, SuperAdminTenantListApi, ImpersonateTenantApi

urlpatterns = [
    # ... your existing user urls ...
    path('stats/', SuperAdminStatsApi.as_view(), name='superadmin-stats'),
    path('tenants/', SuperAdminTenantListApi.as_view(), name='superadmin-tenants'),
    path('tenants/impersonate/<str:tenant_id>/', 
         ImpersonateTenantApi.as_view(), name='superadmin-impersonate'),

]
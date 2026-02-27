from django.urls import path
from .apis import BranchListApi, TenantSettingsApi

urlpatterns = [
    path('branches/', BranchListApi.as_view(), name='branch-list'),
    path('settings/', TenantSettingsApi.as_view(), name='tenant-settings'),

]

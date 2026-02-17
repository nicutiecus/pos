from django.urls import path
from .apis import BranchListApi

urlpatterns = [
    path('branches/', BranchListApi.as_view(), name='branch-list'),
]
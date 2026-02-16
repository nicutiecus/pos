from django.urls import path
from .apis import CreateSaleApi, SalesListApi

urlpatterns = [
    path('create/', CreateSaleApi.as_view(), name='create-sale'),
    path('list/', SalesListApi.as_view(), name = 'sales-list')
]
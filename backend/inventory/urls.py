from django.urls import path
from .apis import (StockReceiveApi, StockLevelApi, InventoryLogListApi,
                   ExpiringStockApi, ProductCreateApi, CategoryListCreateApi, ProductCatalogApi)

urlpatterns = [
    path('receive/', StockReceiveApi.as_view(), name='stock-receive'),
    path('levels/<uuid:branch_id>/', StockLevelApi.as_view(), name='stock-levels'),
    path('expiring/<uuid:branch_id>/', ExpiringStockApi.as_view(), name='stock-expiring'),
    path('products/', ProductCreateApi.as_view(), name='product-create'),
    path('categories/', CategoryListCreateApi.as_view(), name='category-list-create'),
    path('logs/', InventoryLogListApi.as_view(), name='inventory-logs'),
    path('catalog/', ProductCatalogApi.as_view(), name='product-catalog'),

]
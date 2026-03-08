from django.urls import path
from .apis import (StockReceiveApi, StockLevelApi, InventoryLogListApi,
                   ExpiringStockApi, ProductCreateApi, CategoryListCreateApi, ProductCatalogApi,
                   StockTransferApi, StockTransferLogListApi, AcceptTransferApi, RejectTransferApi,
                   UpdateProductPriceApi, ProductPriceHistoryApi, OrganizationStockLevelsAPIView,
                   RemoveStockAPIView)

urlpatterns = [
    path('receive/', StockReceiveApi.as_view(), name='stock-receive'),
    path('remove/', RemoveStockAPIView.as_view(), name='stock-remove'),
    path('levels/organization/', OrganizationStockLevelsAPIView.as_view(), name='stock-levels'),
    path('levels/<uuid:branch_id>/', StockLevelApi.as_view(), name='stock-levels'),
    path('expiring/<uuid:branch_id>/', ExpiringStockApi.as_view(), name='stock-expiring'),
    path('products/', ProductCreateApi.as_view(), name='product-create'),
    path('categories/', CategoryListCreateApi.as_view(), name='category-list-create'),
    path('logs/', InventoryLogListApi.as_view(), name='inventory-logs'),
    path('catalog/', ProductCatalogApi.as_view(), name='product-catalog'),
    #Initiate transfer 
    path('transfers/initiate/', StockTransferApi.as_view(), name='stock-transfer-initiate'),
    path('transfers/logs/', StockTransferLogListApi.as_view(), name='stock-transfer-logs'),
    path('transfers/<int:transfer_id>/accept/', AcceptTransferApi.as_view(), name='stock-transfer-accept'),
    path('transfers/<int:transfer_id>/reject/', RejectTransferApi.as_view(), name='stock-transfer-rejectt'),
    path('products/<int:product_id>/price/', UpdateProductPriceApi.as_view(), name='update-product-price'),
    path('products/<int:product_id>/price-history/', ProductPriceHistoryApi.as_view(), name='product-price-history'),

]
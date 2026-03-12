from django.urls import path, include
from .apis import (CreateSaleApi, SalesListApi, SalesDetailApi, 
                   PayDebtApi, CustomerLedgerApi, CloseShiftApi, CurrentShiftApi,
                   ActiveShiftAPIView, StartShiftAPIView, ClosedShiftListApi, ShiftReportDetailApi)
from rest_framework.routers import DefaultRouter
from .views import CustomerViewSet


router = DefaultRouter()
router.register(r'customers', CustomerViewSet, basename='customers')

urlpatterns = [
    # Customer CRUD endpoints (e.g., POST /api/sales/customers/ to add a customer)
    path('', include(router.urls)),
    # Custom Customer Actions
    path('customers/<str:customer_id>/pay-debt/', PayDebtApi.as_view(), name='pay-debt'),
    path('customers/<str:customer_id>/ledger/', CustomerLedgerApi.as_view(), name='customer-ledger'),

    path('create/', CreateSaleApi.as_view(), name='create-sale'),
    path('list/', SalesListApi.as_view(), name = 'sales-list'),
    path('<str:sale_id>/', SalesDetailApi.as_view(), name='sales-detail'),
    path('shift/active/', ActiveShiftAPIView.as_view(), name='active-shift'),
    path('shift/start/', StartShiftAPIView.as_view(), name='start-shift' ),

    #shift reports
    path('reports/shift/current/', CurrentShiftApi.as_view(), name='shift-current'),
    path('reports/shift/close/', CloseShiftApi.as_view(), name='shift-close'),
    path('reports/closed-shift/', ClosedShiftListApi.as_view(), name='closed-shifts-list'),
    path('reports/closed-shift/<str:shift_id>/', ShiftReportDetailApi.as_view(), name='shift-detail')

   
]
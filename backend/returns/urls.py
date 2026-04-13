from django.urls import path
from .views import ReturnOrderListCreateAPIView, ReturnOrderDetailAPIView


urlpatterns=[
    path('process-returns/', ReturnOrderListCreateAPIView.as_view(), name='process-returns')



]
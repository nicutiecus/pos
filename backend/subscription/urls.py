from django.urls import path
#from .views import payment_webhook
from .apis import create_plan_api, list_plans_api

urlpatterns = [
    #path('webhook/payment/', payment_webhook, name='payment_webhook'),
    path('plans/', list_plans_api, name='list_plans'),
    path('plans/create-plan/', create_plan_api, name ='create_plan'),
   
]
from django.contrib import admin
from .models import Plan, Subscription, PaymentHistory

# Register your models here.
@admin.register(Plan)
class PlanAdmin(admin.ModelAdmin):
    list_display= ('name','price','billing_cycle','is_active')
    search_fields = ('name',)

@admin.register(Subscription)
class SubscriptionAdmin(admin.ModelAdmin):
    list_display= ('tenant','plan','status')
    search_fields = ('tenant',)
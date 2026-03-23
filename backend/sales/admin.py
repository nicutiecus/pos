from django.contrib import admin
from .models import Customer, SalesOrder, CustomerLedger, Payment

class CustomerLedgerInline(admin.TabularInline):
    model= CustomerLedger
    extra = 1

# Register your models here.
@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    inlines=[CustomerLedgerInline]

@admin.register(SalesOrder)
class SalesOrderAdmin(admin.ModelAdmin):
    list_display=("id","branch","customer")
    search_fields=("id","branch","customer")

@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display=("order","branch","method")
    list_filter=("branch","method")

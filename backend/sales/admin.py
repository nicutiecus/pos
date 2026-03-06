from django.contrib import admin
from .models import Customer, SalesOrder

# Register your models here.
@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    pass

@admin.register(SalesOrder)
class SalesOrderAdmin(admin.ModelAdmin):
    pass
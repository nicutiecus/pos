from django.contrib import admin
from .models import Branch, TenantAwareModel
from inventory.models import InventoryBatch
from sales.models import SalesOrder

class InventoryBatchInline(admin.TabularInline):
    model= InventoryBatch
    extra = 1

class SalesOrderInline(admin.TabularInline):
    model= SalesOrder
    extra =1



@admin.register(Branch)
class BranchAdmin(admin.ModelAdmin):
    inlines = [InventoryBatchInline, SalesOrderInline]


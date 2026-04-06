from django.contrib import admin
from .models import Product, InventoryBatch
# Register your models here.
@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display=("name","category")
    search_fields=("name","sku")

@admin.register(InventoryBatch)
class InventoryBatchAdmin(admin.ModelAdmin):
    list_display=("branch","product","batch_number")
    search_fields=("branch", "batch number")

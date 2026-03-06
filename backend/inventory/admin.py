from django.contrib import admin
from .models import Product, InventoryBatch
# Register your models here.
@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    pass

@admin.register(InventoryBatch)
class InventoryBatchAdmin(admin.ModelAdmin):
    pass

from django.contrib import admin
from .models import Product, InventoryBatch, Supplier, SupplierLedger, PurchaseInvoice, PurchaseOrder
# Register your models here.
@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display=("name","category")
    search_fields=("name","sku")

@admin.register(InventoryBatch)
class InventoryBatchAdmin(admin.ModelAdmin):
    list_display=("branch","product","batch_number")
    search_fields=("branch", "batch number")

@admin.register(Supplier)
class SupplierAdmin(admin.ModelAdmin):
    list_display=("name","contact_person","current_debt")
    search_fields=("name","contact_person")

@admin.register(SupplierLedger)
class SupplierLedgerAdmin(admin.ModelAdmin):
    list_display=("supplier","amount","transaction_type","balance_after")
    search_fields=("supplier", "transaction_type")


@admin.register(PurchaseInvoice)
class PurchaseInvoiceAdmin(admin.ModelAdmin):
    list_display=("purchase_order","supplier","amount_paid","payment_status")


@admin.register(PurchaseOrder)
class PurchaseOrderAdmin(admin.ModelAdmin):
    list_display=("id","supplier","status")
   
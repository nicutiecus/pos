from django.contrib import admin
from .models import Expense, ExpenseCategory

# Register your models here.
class ExpenseAdmin(admin.ModelAdmin):
    list_display = ('scope','branch','description','expense_date')
    list_filter = ('branch','scope')
    search_fields = ('description',)

class ExpenseCategoryAdmin(admin.ModelAdmin):
    list_display = ('name','account','is_active',)
    list_filter = ('account__name',)
    


admin.site.register(Expense, ExpenseAdmin)
admin.site.register(ExpenseCategory, ExpenseCategoryAdmin)
    

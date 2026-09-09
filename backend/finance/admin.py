from django.contrib import admin
from .models import Expense, ExpenseCategory

# Register your models here.
    
class ExpenseCategoryAdmin(admin.ModelAdmin):
    list_display = ('name','account','is_active',)
    list_filter = ('account__name',)
    


admin.site.register(Expense)
admin.site.register(ExpenseCategory, ExpenseCategoryAdmin)
    

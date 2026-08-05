from django.contrib import admin
from .models import Expense

# Register your models here.
class ExpenseAdmin(admin.ModelAdmin):
    list_display = ('scope','branch','description','expense_date')
    list_filter = ('branch','scope')
    search_fields = ('description',)

admin.site.register(Expense, ExpenseAdmin)
    

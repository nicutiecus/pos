from django.contrib import admin
from .models import Account, AccountingSettings

# Register your models here.
admin.site.register(Account)
admin.site.register(AccountingSettings)
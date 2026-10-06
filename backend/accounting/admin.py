from django.contrib import admin
from .models import Account, AccountingSettings, JournalEntry, JournalEntryLine

# Register your models here.
admin.site.register(Account)
admin.site.register(AccountingSettings)
admin.site.register(JournalEntryLine)
admin.site.register(JournalEntry)
from django.contrib import admin
from .models import Tenant, User, UserManager

# Register your models here.

@admin.register(Tenant)
class TenantAdmin(admin.ModelAdmin):
    pass

@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    pass

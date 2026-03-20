from rest_framework import serializers
from users.models import Tenant  # Import the model from users

class SuperAdminTenantSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tenant
        # Expose everything the super admin needs to audit the business
        fields = ['id', 'name', 'subdomain', 'created_at', 'is_active']
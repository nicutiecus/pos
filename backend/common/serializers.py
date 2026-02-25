# common/serializers.py
from rest_framework import serializers
from .models import Branch, TenantSettings

class BranchSerializer(serializers.ModelSerializer):
    class Meta:
        model = Branch
        fields = ['id', 'name', 'code', 'location', 'created_at']
        read_only_fields = ['id', 'created_at']

    def validate_code(self, value):
        # Unique code validation is handled by DB constraints, 
        # but nice to have a friendly error here.
        user = self.context['request'].user
        if Branch.objects.filter(tenant=user.tenant, code=value).exists():
            raise serializers.ValidationError("Branch code must be unique within your organization.")
        return value
    

class TenantSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = TenantSettings
        fields = [
            'business_name', 'address', 'phone', 'email',
            'currency_symbol', 'tax_rate', 'receipt_footer'
        ]
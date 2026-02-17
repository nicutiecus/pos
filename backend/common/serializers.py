# common/serializers.py
from rest_framework import serializers
from .models import Branch

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
    

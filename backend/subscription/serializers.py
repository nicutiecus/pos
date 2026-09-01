from rest_framework import serializers
from .models import Plan

class PlanSerializer(serializers.ModelSerializer):
    class Meta:
        model = Plan
        fields = [
            'id', 'name', 'slug', 'price', 'billing_cycle', 
            'max_users', 'max_branches', 'max_inventory_items', 'is_active'
        ]
# finances/serializers.py
from rest_framework import serializers
from .models import Expense

class ExpenseCreateSerializer(serializers.Serializer):
    branch_id = serializers.UUIDField()
    category = serializers.ChoiceField(choices=Expense.Category.choices)
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=0.01)
    description = serializers.CharField(max_length=500)

class ExpenseListSerializer(serializers.ModelSerializer):
    branch_name = serializers.CharField(source='branch.name', read_only=True)
    recorded_by_name = serializers.CharField(source='approved_by.get_full_name', read_only=True, default="System")
    
    class Meta:
        model = Expense
        fields = ['id', 'branch_name', 'category', 'amount', 'description', 'recorded_by_name', 'expense_date', 'created_at']
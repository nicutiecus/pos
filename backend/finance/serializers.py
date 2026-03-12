# finances/serializers.py
from rest_framework import serializers
from .models import Expense
from common.pagination import StandardResultsSetPagination
from .selectors import get_expenses
class ExpenseCreateSerializer(serializers.Serializer):
    scope = serializers.ChoiceField(choices=Expense.ExpenseScope.choices, default=Expense.ExpenseScope.BRANCH)
    
    # 1. Change to CharField and explicitly allow blanks
    branch_id = serializers.CharField(required=False, allow_null=True, allow_blank=True) 
    
    category = serializers.ChoiceField(choices=Expense.Category.choices)
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=0.01)
    description = serializers.CharField(max_length=500, allow_blank=True)

    # 2. Add this method to clean the data before it hits the service
    def validate_branch_id(self, value):
        # If the frontend sends an empty string "", convert it to Python's None
        if not value: 
            return None
            
        # (Optional) Ensure it's a valid UUID if it IS provided
        import uuid
        try:
            uuid.UUID(str(value))
        except ValueError:
            raise serializers.ValidationError("Must be a valid UUID.")
            
        return value


class ExpenseListSerializer(serializers.ModelSerializer):
    branch_name = serializers.CharField(source='branch.name', read_only=True)
    recorded_by_name = serializers.CharField(source='approved_by.get_full_name', read_only=True, default="System")
    
    class Meta:
        model = Expense
        fields = ['id', 'branch_name', 'category', 'amount', 'description', 'recorded_by_name', 'expense_date', 'created_at']
   
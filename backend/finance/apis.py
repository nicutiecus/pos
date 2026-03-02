from rest_framework import views, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.core.exceptions import ValidationError
from .models import Expense

from .serializers import ExpenseCreateSerializer, ExpenseListSerializer
from .services import record_expense_service
from .selectors import get_expenses

class ExpenseApi(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        branch_id = request.GET.get('branch_id')
        start_date = request.GET.get('start_date')
        end_date = request.GET.get('end_date')

        expenses = get_expenses(user=request.user, branch_id=branch_id, start_date=start_date, end_date=end_date)
        serializer = ExpenseListSerializer(expenses, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        serializer = ExpenseCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            expense = record_expense_service(
                user=request.user,
                **serializer.validated_data
            )
            return Response({
                "message": "Expense recorded successfully.",
                "expense": ExpenseListSerializer(expense).data
            }, status=status.HTTP_201_CREATED)

        except ValidationError as e:
            return Response({"error": e.message}, status=status.HTTP_400_BAD_REQUEST)
        




class ExpenseCategoryApi(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Expense.Category.choices looks like: [('Fuel & Power', 'Fuel & Power'), ...]
        # We format it into a list of dictionaries for the frontend
        categories = [
            {"id": key, "name": label} 
            for key, label in Expense.Category.choices
        ]
        
        return Response(categories, status=status.HTTP_200_OK)
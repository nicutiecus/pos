from django.urls import path
from .apis import ExpenseApi, ExpenseCategoryApi

urlpatterns = [
    path('expenses/', ExpenseApi.as_view(), name='expenses'),
    path('expenses/categories/', ExpenseCategoryApi.as_view(), name ='expense-categories')
]
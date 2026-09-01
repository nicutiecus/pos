from django.urls import path
from .apis import (
    AccountApi, 
    AccountDetailApi, 
    JournalEntryListApi, 
    JournalEntryDetailApi, 
    JournalEntryReverseApi, GeneralLedgerApi, TrialBalanceApi, ReceivableListApi, ReceivableDetailApi,
    PayableListApi, PayableDetailApi, CashBankApi, ProfitLossReportApi, BalanceSheetReportApi,
    CashFlowReportApi, TaxReportApi, AccountingSettingsApi
)

urlpatterns = [
    # Existing Account endpoints
    path('accounts/', AccountApi.as_view(), name='accounts'),
    path('accounts/<int:account_id>/', AccountDetailApi.as_view(), name='account-detail'),
    path('journals/', JournalEntryListApi.as_view(), name='journal-list'),
    path('journals/<int:pk>/', JournalEntryDetailApi.as_view(), name='journal-detail'),
    path('journals/<int:pk>/reverse/', JournalEntryReverseApi.as_view(), name='journal-reverse'),
    path('general-ledger/', GeneralLedgerApi.as_view(), name='general-ledger'),
    path('trial-balance/', TrialBalanceApi.as_view(), name='trial-balance'),
    path('receivables/', ReceivableListApi.as_view(), name = 'receivable-list'),
    path('receivables/<str:customer_id>/', ReceivableDetailApi.as_view(), name = 'receivable-detail'),
    path('payables/', PayableListApi.as_view(), name='payable-list'),
    path('payables/<str:supplier_id>/', PayableDetailApi.as_view(), name='payable-detail'),
    path('cash-bank/', CashBankApi.as_view(), name='cash-bank'),
    path('reports/profit-loss/', ProfitLossReportApi.as_view(), name='report-profit-loss'),
    path('reports/balance-sheet/', BalanceSheetReportApi.as_view(), name='report-balance-sheet'),
    path('reports/cash-flow/', CashFlowReportApi.as_view(), name='report-cash-flow'),
    path('reports/tax/', TaxReportApi.as_view(), name='report-tax'),
    path('settings/', AccountingSettingsApi.as_view(), name='accounting-settings'),

        
]
from rest_framework import views, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.core.exceptions import ValidationError
from users.permissions import IsTenantAdmin  
from .models import Account, JournalEntry
from .serializers import (AccountListSerializer, AccountCreateSerializer, AccountUpdateSerializer,
                          JournalEntryCreateSerializer, JournalEntrySerializer, GeneralLedgerSerializer,
                          TrialBalanceSerializer, ReceivableSerializer, CustomerLedgerSerializer,
                          PayableSerializer, SupplierLedgerSerializer, ReportAccountSerializer,
                          AccountingSettingsSerializer)
from .services import (create_account_service, update_account_service, create_manual_journal_entry,
                       reverse_journal_entry_service)
from .selectors import (get_general_ledger, get_trial_balance, get_receivables, get_customer_ledger,
                        get_payables, get_supplier_ledger, get_cash_and_bank_balances, get_profit_and_loss,
                        get_balance_sheet, get_cash_flow, get_tax_report, get_accounting_settings)



class AccountApi(views.APIView):
    permission_classes = [IsAuthenticated, IsTenantAdmin]

    def get(self, request):
        # Strict tenant isolation via request.user.tenant
        accounts = Account.objects.filter(tenant=request.user.tenant).order_by('code')
        serializer = AccountListSerializer(accounts, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        serializer = AccountCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            # Service layer handles the DB insertion, tenant logic, and data validation
            account = create_account_service(
                user=request.user,
                **serializer.validated_data
            )
            return Response({
                "message": "Chart of account created successfully.",
                "account": AccountListSerializer(account).data
            }, status=status.HTTP_201_CREATED)

        except ValidationError as e:
            return Response({"error": e.message}, status=status.HTTP_400_BAD_REQUEST)

class AccountDetailApi(views.APIView):
    permission_classes = [IsAuthenticated, IsTenantAdmin]

    def patch(self, request, account_id):
        serializer = AccountUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            account = update_account_service(
                user=request.user,
                account_id=account_id,
                **serializer.validated_data
            )
            return Response({
                "message": "Account updated successfully.",
                "account": AccountListSerializer(account).data
            }, status=status.HTTP_200_OK)

        except ValidationError as e:
            return Response({"error": getattr(e, 'message', str(e))}, status=status.HTTP_400_BAD_REQUEST)


class JournalEntryListApi(views.APIView):
    permission_classes = [IsAuthenticated, IsTenantAdmin]

    def get(self, request):
        # In a production scenario with high volume, consider using your StandardResultsSetPagination here
        journals = JournalEntry.objects.filter(
            tenant=request.user.tenant
        ).prefetch_related('lines__account').order_by('-created_at')[:100]
        
        serializer = JournalEntrySerializer(journals, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        serializer = JournalEntryCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            journal = create_manual_journal_entry(
                user=request.user,
                **serializer.validated_data
            )
            return Response(JournalEntrySerializer(journal).data, status=status.HTTP_201_CREATED)
        except ValidationError as e:
            return Response({"error": getattr(e, 'message', str(e))}, status=status.HTTP_400_BAD_REQUEST)

class JournalEntryDetailApi(views.APIView):
    permission_classes = [IsAuthenticated, IsTenantAdmin]

    def get(self, request, pk):
        try:
            journal = JournalEntry.objects.prefetch_related('lines__account').get(
                pk=pk, 
                tenant=request.user.tenant
            )
            serializer = JournalEntrySerializer(journal)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except JournalEntry.DoesNotExist:
            return Response({"error": "Journal entry not found."}, status=status.HTTP_404_NOT_FOUND)

class JournalEntryReverseApi(views.APIView):
    permission_classes = [IsAuthenticated, IsTenantAdmin]

    def post(self, request, pk):
        try:
            reversal = reverse_journal_entry_service(
                user=request.user,
                journal_entry_id=pk
            )
            return Response({
                "message": "Journal entry reversed successfully.",
                "reversal_entry": JournalEntrySerializer(reversal).data
            }, status=status.HTTP_201_CREATED)
        except ValidationError as e:
            return Response({"error": getattr(e, 'message', str(e))}, status=status.HTTP_400_BAD_REQUEST)


class GeneralLedgerApi(views.APIView):
    permission_classes = [IsAuthenticated, IsTenantAdmin]

    def get(self, request):
        lines = get_general_ledger(
            tenant=request.user.tenant,
            start_date=request.query_params.get('start_date'),
            end_date=request.query_params.get('end_date'),
            account_id=request.query_params.get('account_id')
        )
        serializer = GeneralLedgerSerializer(lines, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class TrialBalanceApi(views.APIView):
    permission_classes = [IsAuthenticated, IsTenantAdmin]

    def get(self, request):
        accounts = get_trial_balance(
            tenant=request.user.tenant, 
            as_of_date=request.query_params.get('as_of_date')
        )
        serializer = TrialBalanceSerializer(accounts, many=True)

        # Compute grand totals to verify the books are balanced
        total_debits = sum(acc.total_debit for acc in accounts)
        total_credits = sum(acc.total_credit for acc in accounts)

        return Response({
            "accounts": serializer.data,
            "grand_totals": {
                "total_debit": total_debits,
                "total_credit": total_credits,
                "is_balanced": total_debits == total_credits
            }
        }, status=status.HTTP_200_OK)


class ReceivableListApi(views.APIView):
    permission_classes = [IsAuthenticated, IsTenantAdmin]

    def get(self, request):
        customers = get_receivables(tenant=request.user.tenant)
        serializer = ReceivableSerializer(customers, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

class ReceivableDetailApi(views.APIView):
    permission_classes = [IsAuthenticated, IsTenantAdmin]

    def get(self, request, customer_id):
        entries = get_customer_ledger(tenant=request.user.tenant, customer_id=customer_id)
        serializer = CustomerLedgerSerializer(entries, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class PayableListApi(views.APIView):
    permission_classes = [IsAuthenticated, IsTenantAdmin]

    def get(self, request):
        suppliers = get_payables(tenant=request.user.tenant)
        serializer = PayableSerializer(suppliers, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

class PayableDetailApi(views.APIView):
    permission_classes = [IsAuthenticated, IsTenantAdmin]

    def get(self, request, supplier_id):
        entries = get_supplier_ledger(tenant=request.user.tenant, supplier_id=supplier_id)
        serializer = SupplierLedgerSerializer(entries, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class CashBankApi(views.APIView):
    permission_classes = [IsAuthenticated, IsTenantAdmin]

    def get(self, request):
        accounts = get_cash_and_bank_balances(
            tenant=request.user.tenant, 
            as_of_date=request.query_params.get('as_of_date')
        )
        serializer = ReportAccountSerializer(accounts, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class ProfitLossReportApi(views.APIView):
    permission_classes = [IsAuthenticated, IsTenantAdmin]

    def get(self, request):
        data = get_profit_and_loss(
            tenant=request.user.tenant,
            start_date=request.query_params.get('start_date'),
            end_date=request.query_params.get('end_date')
        )
        return Response({
            "revenues": ReportAccountSerializer(data['revenues'], many=True).data,
            "cogs": ReportAccountSerializer(data['cogs'], many=True).data,
            "operating_expenses": ReportAccountSerializer(data['operating_expenses'], many=True).data,
            "totals": data['totals']
        }, status=status.HTTP_200_OK)


class BalanceSheetReportApi(views.APIView):
    permission_classes = [IsAuthenticated, IsTenantAdmin]

    def get(self, request):
        data = get_balance_sheet(
            tenant=request.user.tenant,
            as_of_date=request.query_params.get('as_of_date')
        )
        return Response({
            "assets": ReportAccountSerializer(data['assets'], many=True).data,
            "liabilities": ReportAccountSerializer(data['liabilities'], many=True).data,
            "equity": ReportAccountSerializer(data['equity'], many=True).data,
            "totals": data['totals']
        }, status=status.HTTP_200_OK)


class CashFlowReportApi(views.APIView):
    permission_classes = [IsAuthenticated, IsTenantAdmin]

    def get(self, request):
        data = get_cash_flow(
            tenant=request.user.tenant,
            start_date=request.query_params.get('start_date'),
            end_date=request.query_params.get('end_date')
        )
        return Response({
            "accounts": ReportAccountSerializer(data['accounts'], many=True).data,
            "totals": data['totals']
        }, status=status.HTTP_200_OK)


class TaxReportApi(views.APIView):
    permission_classes = [IsAuthenticated, IsTenantAdmin]

    def get(self, request):
        data = get_tax_report(
            tenant=request.user.tenant,
            start_date=request.query_params.get('start_date'),
            end_date=request.query_params.get('end_date')
        )
        data['tax_liability_accounts'] = ReportAccountSerializer(data['tax_liability_accounts'], many=True).data
        return Response(data, status=status.HTTP_200_OK)



class AccountingSettingsApi(views.APIView):
    permission_classes = [IsAuthenticated, IsTenantAdmin]

    def get(self, request):
        settings = get_accounting_settings(tenant=request.user.tenant)
        serializer = AccountingSettingsSerializer(settings, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)

    def patch(self, request):
        settings = get_accounting_settings(tenant=request.user.tenant)
        serializer = AccountingSettingsSerializer(
            settings, 
            data=request.data, 
            partial=True, 
            context={'request': request}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_200_OK)
from rest_framework import serializers
from .models import Account, AccountingSettings, JournalEntry, JournalEntryLine
from sales.models import Customer, CustomerLedger
from inventory.models import Supplier, SupplierLedger


class AccountListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Account
        fields = ['id', 'name', 'code', 'account_type', 'description', 'is_active', 'created_at']

class AccountCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255)
    code = serializers.CharField(max_length=50)
    account_type = serializers.ChoiceField(choices=Account.AccountType.choices)
    description = serializers.CharField(required=False, allow_blank=True, default="")
    is_active = serializers.BooleanField(default=True)

class AccountUpdateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255, required=False)
    code = serializers.CharField(max_length=50, required=False)
    account_type = serializers.ChoiceField(choices=Account.AccountType.choices, required=False)
    description = serializers.CharField(required=False, allow_blank=True)
    is_active = serializers.BooleanField(required=False)


class AccountingSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = AccountingSettings
        exclude = ['tenant', 'created_at', 'updated_at']


class JournalEntryLineSerializer(serializers.ModelSerializer):
    account_name = serializers.CharField(source='account.name', read_only=True)
    account_code = serializers.CharField(source='account.code', read_only=True)

    class Meta:
        model = JournalEntryLine
        fields = ['id', 'account', 'account_name', 'account_code', 'debit', 'credit']

class JournalEntrySerializer(serializers.ModelSerializer):
    lines = JournalEntryLineSerializer(many=True, read_only=True)
    branch_name = serializers.CharField(source='branch.name', read_only=True, default=None)

    class Meta:
        model = JournalEntry
        fields = ['id', 'date', 'reference_id', 'description', 'branch', 'branch_name', 'created_at', 'lines']

# --- Write Serializers ---
class JournalEntryLineCreateSerializer(serializers.Serializer):
    account_id = serializers.IntegerField()
    debit = serializers.DecimalField(max_digits=15, decimal_places=2, default=0)
    credit = serializers.DecimalField(max_digits=15, decimal_places=2, default=0)

class JournalEntryCreateSerializer(serializers.Serializer):
    reference_id = serializers.CharField(max_length=100, required=False, allow_blank=True)
    description = serializers.CharField()
    branch_id = serializers.UUIDField(required=False, allow_null=True)
    lines = JournalEntryLineCreateSerializer(many=True)


class GeneralLedgerSerializer(serializers.ModelSerializer):
    date = serializers.DateField(source='journal_entry.date', read_only=True)
    reference_id = serializers.CharField(source='journal_entry.reference_id', read_only=True)
    description = serializers.CharField(source='journal_entry.description', read_only=True)
    branch_name = serializers.CharField(source='journal_entry.branch.name', read_only=True, default=None)
    account_code = serializers.CharField(source='account.code', read_only=True)
    account_name = serializers.CharField(source='account.name', read_only=True)

    class Meta:
        model = JournalEntryLine
        fields = [
            'id', 'date', 'reference_id', 'description', 'branch_name',
            'account_code', 'account_name', 'debit', 'credit'
        ]

class TrialBalanceSerializer(serializers.ModelSerializer):
    total_debit = serializers.DecimalField(max_digits=15, decimal_places=2, read_only=True)
    total_credit = serializers.DecimalField(max_digits=15, decimal_places=2, read_only=True)
    net_balance = serializers.SerializerMethodField()

    class Meta:
        model = Account
        fields = ['id', 'code', 'name', 'account_type', 'total_debit', 'total_credit', 'net_balance']

    def get_net_balance(self, obj):
        """
        Calculates the normal balance based on account type.
        Assets and Expenses increase with Debits.
        Liabilities, Equity, and Revenue increase with Credits.
        """
        if obj.account_type in ['Asset', 'Expense']:
            return obj.total_debit - obj.total_credit
        else:
            return obj.total_credit - obj.total_debit


class ReceivableSerializer(serializers.ModelSerializer):
    class Meta:
        model = Customer
        fields = ['id', 'name', 'phone', 'email', 'credit_limit', 'current_debt']

class CustomerLedgerSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomerLedger
        fields = ['id', 'created_at', 'transaction_type', 'amount', 'balance_after', 'reference_id', 'notes']

class PayableSerializer(serializers.ModelSerializer):
    class Meta:
        model = Supplier
        fields = ['id', 'name', 'phone', 'email', 'current_debt']

class SupplierLedgerSerializer(serializers.ModelSerializer):
    class Meta:
        model = SupplierLedger
        fields = ['id', 'created_at', 'transaction_type', 'amount', 'balance_after', 'reference_id', 'notes']

class ReportAccountSerializer(serializers.ModelSerializer):
    net_balance = serializers.SerializerMethodField()

    class Meta:
        model = Account
        fields = ['id', 'code', 'name', 'account_type', 'total_debit', 'total_credit', 'net_balance']

    def get_net_balance(self, obj):
        if obj.account_type in ['Asset', 'Expense']:
            return getattr(obj, 'total_debit', 0) - getattr(obj, 'total_credit', 0)
        return getattr(obj, 'total_credit', 0) - getattr(obj, 'total_debit', 0)


class AccountingSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = AccountingSettings
        exclude = ['tenant', 'created_at', 'updated_at']

    def get_fields(self):
        """
        Dynamically restricts the queryset of all Account ForeignKeys to ensure 
        users can only select accounts belonging to their specific tenant.
        """
        fields = super().get_fields()
        request = self.context.get('request')
        
        if request and hasattr(request, 'user'):
            tenant = request.user.tenant
            for field_name, field in fields.items():
                if isinstance(field, serializers.PrimaryKeyRelatedField):
                    field.queryset = Account.objects.filter(tenant=tenant, is_active=True)
                    
        return fields
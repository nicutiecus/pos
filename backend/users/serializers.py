from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework import serializers
from django.db import transaction
from .models import User, Tenant
from rest_framework import serializers


VALID_PERMISSIONS = [
    'view_expenses',
    'view_eod_reports',
    'manage_inventory',
    'void_sales',
    'issue_refunds',
    'edit_product_prices',
    'create_products',
    'transfer_stock',
    'receive_stock',
    'remove_stock'
]


class TenantTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)

        actual_role = 'Super_Admin' if user.is_superuser else user.role
        # Add custom claims
        token['email'] = user.email
        token['role'] = actual_role
        
        # Handle Tenant Context
        if user.tenant:
            token['tenant_id'] = str(user.tenant.id)
            token['tenant_name'] = user.tenant.name
        else:
            token['tenant_id'] = None

        # Handle Branch Context (Critical for Cashiers)
        if user.branch:
            token['branch_id'] = str(user.branch.id)
            token['branch_code'] = user.branch.code
        else:
            token['branch_id'] = None

        return token
    def validate(self, attrs):
        # 1. Generate the standard tokens (access/refresh)
        data = super().validate(attrs)

        actual_role = 'Super_Admin' if self.user.is_superuser else self.user.role

        # 2. Add custom data to the JSON response body
        # This allows the frontend to read 'role' without decoding the token
        data['user'] = {
            'id': self.user.id,
            'email': self.user.email,
            'role': actual_role,
            'first_name': self.user.first_name,
            'tenant_id': self.user.tenant.id if self.user.tenant else None,
            'branch_id': self.user.branch.id if self.user.branch else None,
            'branch_name': self.user.branch.name if self.user.branch else None,
            'permissions': self.user.custom_permissions
            
        }
        
        # SimpleJWT calls the access token 'access' by default. 
        # You can keep it as 'access' or rename it to 'token' here if you prefer.
        # data['token'] = data['access'] 

        return data
class TenantRegistrationSerializer(serializers.ModelSerializer):
    """
    Registers a new Company (Tenant) AND its first Admin User.
    """
    company_name = serializers.CharField(write_only=True)
    subdomain = serializers.CharField(write_only=True)
    password = serializers.CharField(write_only=True, style={'input_type': 'password'})

    class Meta:
        model = User
        fields = ['email', 'password', 'company_name', 'subdomain']

    def create(self, validated_data):
        company_name = validated_data.pop('company_name')
        subdomain = validated_data.pop('subdomain')
        password = validated_data.pop('password')
        email = validated_data.pop('email')

        with transaction.atomic():
            # 1. Create the Tenant
            tenant = Tenant.objects.create(name=company_name, subdomain=subdomain)

            # 2. Create the Admin User linked to this Tenant
            user = User.objects.create_user(
                email=email, 
                password=password, 
                tenant=tenant,
                role=User.Roles.TENANT_ADMIN,
                is_staff=True # Optional: gives access to Django Admin
            )
        
        return user
    



class StaffCreationSerializer(serializers.ModelSerializer):
    custom_permissions=serializers.ListField(child=serializers.ChoiceField(choices=VALID_PERMISSIONS),
                                             required=False, default=list)


    branch_id = serializers.UUIDField(write_only=True)
    password = serializers.CharField(write_only=True)
    first_name = serializers.CharField(required=True)
    last_name = serializers.CharField(required=True)

    class Meta:
        model = User
        fields = ['id', 'email', 'password', 'role', 'branch_id', 'first_name', 'last_name', 'branch', 'custom_permissions']

    def validate_branch_id(self, value):
        user = self.context['request'].user
        # Security Check: Does this branch belong to the Admin's tenant?
        from common.models import Branch
        if not Branch.objects.filter(id=value, tenant=user.tenant).exists():
            raise serializers.ValidationError("Invalid branch or branch belongs to another organization.")
        return value

    def create(self, validated_data):
        branch_id = validated_data.pop('branch_id')
        password = validated_data.pop('password')
        
        user = self.context['request'].user
        
        # Create user linked to Admin's tenant and selected branch
        new_staff = User.objects.create_user(
            tenant=user.tenant, # Inherit Tenant
            branch_id=branch_id,
            password=password,
            **validated_data
        )
        return new_staff

    def update(self, instance, validated_data):
        # 1. Pop the password out so standard save doesn't save it as plain text
        password = validated_data.pop('password', None)

        # 2. Update the other fields normally (like is_active)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        # 3. Securely hash the new password if one was sent!
        if password:
            instance.set_password(password)

        instance.save()
        return instance



class StaffUpdateSerializer(serializers.ModelSerializer):

    custom_permissions = serializers.ListField(
        child=serializers.ChoiceField(choices=VALID_PERMISSIONS),
        required=False
    )
    class Meta:
        model = User
        # Include the fields you want them to be able to update
        fields = ['is_active', 'password', 'first_name', 'last_name','custom_permissions','role','branch']
        
        # Security: Make sure the password can NEVER be read in a GET request
        extra_kwargs = {
            'password': {'write_only': True, 'required': False}
        }

    def update(self, instance, validated_data):
        # 1. Pop the password out of the data so the standard save doesn't touch it
        password = validated_data.pop('password', None)

        # 2. Update all the other normal fields (like is_active = False)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        # 3. If a password was provided, hash it safely using set_password()
        if password:
            instance.set_password(password)

        # 4. Save to the database
        instance.save()
        return instance

        
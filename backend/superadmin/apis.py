from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from common.models import Branch
from users.models import Tenant, User
from users.permissions import IsSuperAdmin
from .serializers import SuperAdminTenantSerializer, SuperAdminTenantBranchesSerializer
from sales.models import Payment
from django.db.models import Sum
from django.db.models.functions import Coalesce
from decimal import Decimal
from rest_framework import status
from django.shortcuts import get_object_or_404
from users.serializers import TenantTokenObtainPairSerializer




class SuperAdminTenantListApi(APIView):
    permission_classes = [IsAuthenticated, IsSuperAdmin]

    def get(self, request):
        tenants = Tenant.objects.all().order_by('-created_at')
        serializer = SuperAdminTenantSerializer(tenants, many=True)
        return Response(serializer.data)


class SuperAdminTenantBranchesApi(APIView):
    permission_classes = [IsAuthenticated, IsSuperAdmin]

    def get(self, request, tenant_id):
        tenant_branches = Branch.objects.filter(tenant=tenant_id)
        serializer = SuperAdminTenantBranchesSerializer(tenant_branches, many=True)
        return Response(serializer.data)
    
class SuperAdminStatsApi(APIView):
    """ GET /api/super-admin/stats/ """
    permission_classes = [IsAuthenticated, IsSuperAdmin]

    def get(self, request):
        # 1. Tenant & User Metrics
        total_tenants = Tenant.objects.count()
        
        # Assuming your Tenant model has a boolean field like 'is_active' or similar
        active_tenants = Tenant.objects.filter(is_active=True).count() 
        
        total_users = User.objects.count()

        # 2. Global Processed Revenue (Sum of all Sales across all tenants)
        # We filter specifically for SALES to avoid double-counting debt recovery
        total_revenue = Payment.objects.filter(
            transaction_type=Payment.Transactiontype.SALES
        ).aggregate(
            total=Coalesce(Sum('amount'), Decimal('0.00'))
        )['total']

        return Response({
            "total_tenants": total_tenants,
            "active_tenants": active_tenants,
            "total_users": total_users,
            "total_processed_revenue": total_revenue
        })


class ImpersonateTenantApi(APIView):
    """
    POST /api/super-admin/tenants/<tenant_id>/impersonate/
    Allows a Super Admin to log in as the Tenant Admin of a specific tenant,
    or optionally as a Branch Manager if a branch_id is provided in the request payload.
    """
    permission_classes = [IsAuthenticated, IsSuperAdmin]

    def post(self, request, tenant_id):
        # 1. Verify the tenant exists
        tenant = get_object_or_404(Tenant, id=tenant_id)
        
        # Extract optional branch_id from request body
        branch_id = request.data.get('branch_id')

        # 2. Determine target user based on branch provision
        if branch_id:
            # Look for a branch manager in the specified branch
            target_user = User.objects.filter(
                tenant=tenant,
                branch_id=branch_id,
                role='Branch_Manager'
            ).first()
            
            if not target_user:
                return Response(
                    {"error": "No Branch Manager found for the specified branch."}, 
                    status=status.HTTP_404_NOT_FOUND
                )
        else:
            # Fallback to standard Tenant Admin impersonation
            target_user = User.objects.filter(tenant=tenant, role='Tenant_Admin').first()
            
            # If no specific admin role is found, grab the first user
            if not target_user:
                target_user = User.objects.filter(tenant=tenant).first()
                
            if not target_user:
                return Response(
                    {"error": "This tenant has no users to impersonate yet."}, 
                    status=status.HTTP_404_NOT_FOUND
                )

        # 3. Manually mint a new token pair using the custom serializer
        refresh = TenantTokenObtainPairSerializer.get_token(target_user)

        # 4. Return the standard JSON structure
        return Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': {
                'id': target_user.id,
                'email': target_user.email,
                'role': target_user.role,
                'first_name': target_user.first_name,
                'tenant_id': str(tenant.id),
                'branch_id': str(target_user.branch.id) if target_user.branch else None,
            }
        }, status=status.HTTP_200_OK)
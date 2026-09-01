# subscriptions/api.py
import hmac
import hashlib
import json
from django.conf import settings
from django.http import HttpResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework import status
from .serializers import PlanSerializer
from .permissions import IsSuperAdminUser
from .services import process_successful_payment, create_subscription_plan
from users.models import Tenant
from rest_framework.permissions import AllowAny #IsAuthenticated
from .selectors import get_active_subscription_plans

def verify_webhook_signature(request) -> bool:
    """Utility function to keep the API view clean."""
    secret_key = settings.PAYSTACK_SECRET_KEY.encode('utf-8')
    signature = request.headers.get('X-Paystack-Signature', '')
    computed_hmac = hmac.new(secret_key, request.body, hashlib.sha512).hexdigest()
    return hmac.compare_digest(computed_hmac, signature)

@api_view(['POST'])
@permission_classes([]) # Gateway needs no DRF auth
def payment_webhook_api(request):
    # 1. Boundary Validation
    if not verify_webhook_signature(request):
        return HttpResponse(status=400)

    # 2. Parsing
    payload = json.loads(request.body)
    event_type = payload.get('event')
    data = payload.get('data', {})

    # 3. Execution via Service Layer
    if event_type == 'charge.success':
        try:
            tenant_id = data.get('metadata', {}).get('tenant_id')
            tenant = Tenant.objects.get(id=tenant_id)
            
            process_successful_payment(
                tenant=tenant,
                reference=data.get('reference'),
                amount=data.get('amount') / 100
            )
        except Tenant.DoesNotExist:
            pass # Log this anomaly appropriately

    # 4. Response
    return HttpResponse(status=200)




@api_view(['POST'])
@permission_classes([IsSuperAdminUser]) # CRITICAL: Lock this down
def create_plan_api(request):
    serializer = PlanSerializer(data=request.data)
    
    if serializer.is_valid():
        plan = create_subscription_plan(data=serializer.validated_data)
        
        # Serialize the newly created plan to return to the frontend
        response_serializer = PlanSerializer(plan)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)
        
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)




@api_view(['GET'])
@permission_classes([AllowAny]) 
def list_plans_api(request):
    """
    Returns a list of all active subscription plans.
    """
    plans = get_active_subscription_plans()
    
    # Set many=True because we are serializing a QuerySet, not a single instance
    serializer = PlanSerializer(plans, many=True)
    
    return Response(serializer.data)
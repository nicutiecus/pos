# subscriptions/services.py
import requests
from datetime import timedelta
from django.db import transaction
from django.conf import settings
from django.utils import timezone
from .models import Subscription, PaymentHistory, Plan
from datetime import timedelta
from typing import Dict, Any
from users.models import Tenant

@transaction.atomic
def process_successful_payment(*, tenant: Tenant, reference: str, amount: float) -> PaymentHistory:
    """
    Handles subscription renewal idempotently. 
    Returns the PaymentHistory record.
    """
    # 1. Idempotency Check
    payment, created = PaymentHistory.objects.get_or_create(
        tenant=tenant,
        transaction_reference=reference,
        defaults={
            'amount': amount,
            'status': 'successful'
        }
    )
    
    if not created:
        # Transaction already processed
        return payment

    # 2. Mutate Subscription State (with row-level lock)
    try:
        subscription = Subscription.objects.select_for_update().get(tenant=tenant)
        payment.subscription = subscription
        payment.save(update_fields=['subscription'])
        
        if subscription.status != 'active':
            subscription.current_period_start = timezone.now()
            
        subscription.status = 'active'
        subscription.current_period_end = timezone.now() + timedelta(days=30) # Or based on Plan.billing_cycle
        subscription.save(update_fields=['status', 'current_period_start', 'current_period_end'])
        
    except Subscription.DoesNotExist:
        # Edge case: Handle gracefully if a tenant exists but has no initialized subscription
        pass
        
    return payment

def charge_saved_card(amount, authorization_code, email):
    """
    Helper function to charge a saved card (Example using Paystack).
    Returns True if successful, False otherwise.
    """
    url = "https://api.paystack.co/transaction/charge_authorization"
    headers = {
        "Authorization": f"Bearer {settings.PAYSTACK_SECRET_KEY}",
        "Content-Type": "application/json"
    }
    data = {
        "authorization_code": authorization_code,
        "email": email,
        "amount": int(amount * 100) # Paystack uses kobo
    }
    
    try:
        response = requests.post(url, json=data, headers=headers)
        result = response.json()
        return result.get('data', {}).get('status') == 'success'
    except requests.RequestException:
        return False


def process_single_renewal(subscription_id: int):
    """
    Processes the renewal or downgrade for a single subscription.
    """
    # 1. Fetch and Lock the Row
    with transaction.atomic():
        try:
            sub = Subscription.objects.select_for_update().get(id=subscription_id)
        except Subscription.DoesNotExist:
            return
            
        # Check if already processed by another worker
        if sub.current_period_end > timezone.now() or sub.status != 'active':
            return

        # 2. Handle Explicit Cancellations
        if sub.cancel_at_period_end:
            sub.status = 'canceled'
            sub.save(update_fields=['status'])
            return

        # 3. Apply Scheduled Downgrades
        if sub.next_plan:
            sub.plan = sub.next_plan
            sub.next_plan = None
            # Do not save yet; we need to attempt the charge for the new plan first

        amount_to_charge = sub.plan.price
        
    # 4. Attempt the Charge (Outside the lock to prevent DB blocking)
    # Note: For zero-dollar plans (e.g., Free Tier), skip the API call
    payment_successful = True
    if amount_to_charge > 0:
        payment_successful = charge_saved_card(
            amount=amount_to_charge, 
            authorization_code=sub.payment_authorization_code, 
            email=sub.tenant.owner.email # Adjust based on your User/Tenant model
        )

    # 5. Update State Based on Payment Result
    with transaction.atomic():
        sub = Subscription.objects.select_for_update().get(id=subscription_id)
        
        if payment_successful:
            sub.status = 'active'
            sub.current_period_start = timezone.now()
            
            # Add 30 days or 365 days based on cycle
            days_to_add = 30 if sub.plan.billing_cycle == 'monthly' else 365
            sub.current_period_end = timezone.now() + timedelta(days=days_to_add)
            
            # If a downgrade was applied, save the plan changes
            sub.save(update_fields=['status', 'current_period_start', 'current_period_end', 'plan', 'next_plan'])
            
            # Log the successful renewal
            PaymentHistory.objects.create(
                tenant=sub.tenant,
                subscription=sub,
                amount=amount_to_charge,
                transaction_reference=f"renewal_{sub.id}_{timezone.now().timestamp()}",
                status='successful'
            )
        else:
            # Payment failed. Grace period logic goes here.
            sub.status = 'past_due' 
            sub.save(update_fields=['status', 'plan', 'next_plan'])


def create_subscription_plan(*, data: Dict[str, Any]) -> Plan:
    """
    Creates a new global SaaS subscription plan.
    """
    # You can add additional business logic here if needed 
    # (e.g., auto-generating the slug from the name if not provided)
    
    plan = Plan.objects.create(**data)
    return plan
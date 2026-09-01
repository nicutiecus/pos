# subscriptions/selectors.py
from django.utils import timezone
from .models import Subscription, Plan
from typing import Optional
from users.models import Tenant # Adjust based on your structure
from inventory.models import Product
from django.db.models import QuerySet


def get_subscriptions_due_for_renewal():
    """
    Fetches all active subscriptions where the current billing period has ended.
    """
    now = timezone.now()
    return Subscription.objects.filter(
        status='active',
        current_period_end__lte=now
    ).select_related('plan', 'next_plan', 'tenant')




def get_active_subscription(*, tenant: Tenant) -> Optional[Subscription]:
    """Returns the subscription only if it grants active access."""
    return Subscription.objects.filter(
        tenant=tenant,
        status__in=['active', 'trialing']
    ).select_related('plan').first()

def get_tenant_inventory_count(*, tenant: Tenant) -> int:
    """Returns the current inventory usage for a tenant."""
    # Since InventoryItem is TenantAware, you might have a custom manager, 
    # but explicitly passing the tenant is safest for cross-app selectors.
    return Product.objects.filter(tenant=tenant).count()



def get_active_subscription_plans() -> QuerySet[Plan]:
    """
    Fetches all active plans, ordered from lowest to highest price.
    """
    return Plan.objects.filter(is_active=True).order_by('price')
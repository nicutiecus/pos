# inventory/signals.py
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.core.cache import cache
from .models import Product

@receiver([post_save, post_delete], sender=Product)
def invalidate_product_cache(sender, instance, **kwargs):
    """
    Clears the product catalog cache whenever a Product is created, updated, or deleted.
    """
    if instance.tenant:
        cache_key = f"product_catalog:{instance.tenant.id}"
        cache.delete(cache_key)
        print(f"🧹 Cache cleared for tenant: {instance.tenant.id}")
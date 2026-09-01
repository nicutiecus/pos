from celery import shared_task
from .selectors import get_subscriptions_due_for_renewal
from .services import process_single_renewal

@shared_task
def run_nightly_renewals():
    """
    Fetches all expiring subscriptions and queues them for processing.
    This should be scheduled via Celery Beat to run daily at midnight.
    """
    subscriptions = get_subscriptions_due_for_renewal()
    
    for sub in subscriptions:
        # Pass the ID to a separate task so they run concurrently 
        # and don't block each other if the payment gateway is slow.
        process_renewal_worker.delay(sub.id)


@shared_task(bind=True, max_retries=3)
def process_renewal_worker(self, subscription_id):
    """
    Worker task that processes a single subscription.
    """
    try:
        process_single_renewal(subscription_id)
    except Exception as exc:
        # Retry up to 3 times for transient database or network errors
        raise self.retry(exc=exc, countdown=60)
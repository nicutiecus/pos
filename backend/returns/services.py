from django.db import transaction
from django.core.exceptions import ValidationError
from django.db.models import Sum
from .models import ReturnOrder, ReturnItem, SaleItem
from inventory.models import InventoryBatch
from decimal import Decimal

@transaction.atomic
def process_customer_return(*, tenant, branch_id, original_order, cashier, return_data: list, reason: str = ""):
    """
    Processes a return transaction.
    return_data format:
    [
        {"sale_item_id": 12, "quantity": 1, "condition": "Restockable", "refund_amount": "5000.00"},
    ]
    """
    
    return_order = ReturnOrder.objects.create(
        tenant=tenant,
        branch_id=branch_id,
        original_order=original_order,
        cashier=cashier,
        reason=reason,
        total_refund_amount=sum(Decimal(str(item['refund_amount'])) for item in return_data)
    )

    for item_data in return_data:
        # Lock the row to prevent double-returns during concurrent requests
        sale_item = SaleItem.objects.select_for_update().get(
            id=item_data['sale_item_id'], 
            order__tenant=tenant 
        )

        # Optional but recommended: Validate they aren't returning more than they bought
        previously_returned = ReturnItem.objects.filter(original_item=sale_item).aggregate(Sum('quantity_returned'))['quantity_returned__sum'] or 0
        if (previously_returned + item_data['quantity']) > sale_item.quantity:
            raise ValidationError(f"Cannot return more items than originally purchased for {sale_item.product.name}.")

        ReturnItem.objects.create(
            tenant=tenant,
            branch_id=branch_id,
            return_order=return_order,
            original_item=sale_item,
            quantity_returned=item_data['quantity'],
            refund_amount=item_data['refund_amount'],
            condition=item_data['condition']
        )

        # The FIFO Restock Trigger
        if item_data['condition'] == ReturnItem.ConditionChoices.RESTOCKABLE:
            _restock_inventory_fifo(
                tenant=tenant, 
                branch_id=branch_id, 
                product=sale_item.product, 
                quantity=item_data['quantity'],
                # We pull the exact cost price from the original sale to maintain perfect FIFO margins
                cost_price=sale_item.cost_price_at_sale 
            )

    return return_order


def _restock_inventory_fifo(tenant, branch_id, product, quantity, cost_price):
    """
    Creates a new inventory batch for the returned items to maintain FIFO integrity.
    """
    # Create a fresh batch. Because your deduction logic relies on FIFO 
    # (likely ordering by created_at ASC), this new batch will sit at the 
    # back of the queue and be sold after older existing stock is depleted.
    InventoryBatch.objects.create(
        tenant=tenant,
        branch_id=branch_id,
        product=product,
        quantity_received=quantity,    # The amount returned
        quantity_remaining=quantity,   # All of it is available to be sold again
        cost_price=cost_price,         # Preserves the exact original asset value
        notes="Restocked from customer return." # Audit trail
    )
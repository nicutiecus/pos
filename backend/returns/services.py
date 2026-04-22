from django.db import transaction
from django.core.exceptions import ValidationError
from django.db.models import Sum
from .models import ReturnOrder, ReturnItem
from sales.models import SaleItem
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
        identifier = item_data.get('product_name')
        if not identifier:
            raise ValueError("Missing product identifier (SKU or Name) in return payload.")
        
        try:
            sale_item = SaleItem.objects.select_for_update().get(
                order=original_order, 
                product__name=identifier
            )
        except SaleItem.DoesNotExist:
            raise ValueError(f"Product '{identifier}' was not found on this receipt.")
        except SaleItem.MultipleObjectsReturned:
            # Fallback: If the cashier rang up the exact same product on two separate 
            # lines on the receipt instead of grouping by quantity.
            sale_item = SaleItem.objects.select_for_update().filter(
                order=original_order, 
                product__name=identifier
            ).first()


        # Optional but recommended: Validate they aren't returning more than they bought
        previously_returned = ReturnItem.objects.filter(original_item=sale_item).aggregate(Sum('quantity_returned'))['quantity_returned__sum'] or 0
        if (previously_returned + item_data['quantity']) > sale_item.quantity:
            raise ValidationError(f"Cannot return more items than originally purchased for {sale_item.product.name}.")

        ReturnItem.objects.create(
            tenant=tenant,
            return_order=return_order,
            original_item=sale_item,
            quantity_returned=item_data['quantity'],
            refund_amount=item_data['refund_amount'],
            condition=item_data['condition']
        )
        # 1. Extract the condition and safely convert it to a string
        raw_condition = item_data.get('condition', '')

        # 2. Normalize it to match your Django choices (assuming they are UPPERCASE)
        condition = str(raw_condition).upper() if raw_condition else ''
        # The FIFO Restock Trigger
        if condition == str(ReturnItem.ConditionChoices.RESTOCKABLE).upper():
            original_batch = sale_item.batch 
            
            # Safely extract values in case the batch was somehow deleted
            orig_batch_num = original_batch.batch_number if original_batch else None
            orig_expiry = original_batch.expiry_date if original_batch else None
            _restock_inventory_fifo(
                tenant=tenant, 
                branch_id=branch_id, 
                product=sale_item.product, 
                quantity=item_data['quantity'],
                original_batch_number= orig_batch_num,
                # We pull the exact cost price from the original sale to maintain perfect FIFO margins
                cost_price=sale_item.cost_price_at_sale,
                expiry_date= orig_expiry
            )

    return return_order


def _restock_inventory_fifo(tenant, branch_id, product, quantity, original_batch_number, expiry_date, cost_price):
    """
    Creates a new inventory batch for the returned items to maintain FIFO integrity.
    """
    # Create a fresh batch. Because your deduction logic relies on FIFO 
    # (likely ordering by created_at ASC), this new batch will sit at the 
    # back of the queue and be sold after older existing stock is depleted.
    new_batch_number = f"RET-{original_batch_number}" if original_batch_number else "RET-UNKNOWN"


    InventoryBatch.objects.create(
        tenant=tenant,
        branch_id=branch_id,
        batch_number= new_batch_number,
        expiry_date= expiry_date,
        product=product,
        quantity_on_hand=quantity,       # All of it is available to be sold again
        cost_price_at_receipt=cost_price,         # Preserves the exact original asset value
    
    )



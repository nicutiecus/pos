from django.db import transaction
from django.core.exceptions import ValidationError
from django.db.models import Sum
from .models import ReturnOrder, ReturnItem
from sales.models import SaleItem, Payment, CustomerLedger, Customer
from inventory.models import InventoryBatch
from decimal import Decimal

@transaction.atomic
def process_customer_return(*, tenant, branch_id, original_order,
                            cashier, return_data: list, reason: str = "", refund_method: str='Cash'):
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

    # FINANCIAL REVERSAL & DEBT RECONCILIATION
    total_refund_amount=item_data['refund_amount']
    refund_remaining = total_refund_amount

    # 1. If there is a refund to process, and the original order belonged to a tracked customer
    if refund_remaining > 0 and original_order.customer:
        
        # Find out if THIS specific order generated debt
        ledger_entry = CustomerLedger.objects.filter(
            reference_id=original_order.id, 
            transaction_type=CustomerLedger.TransactionType.SALE
        ).first()
        
        original_order_debt = ledger_entry.amount if ledger_entry else Decimal('0.00')

        if original_order_debt > 0:
            # Lock the customer row to prevent race conditions during financial updates
            customer = Customer.objects.select_for_update().get(id=original_order.customer.id)
            
            # CRITICAL CALCULATION: 
            # We can only forgive up to the refund amount, up to the debt incurred on THIS order,
            # AND we cannot forgive more than their current overall debt balance.
            debt_to_forgive = min(refund_remaining, original_order_debt, customer.current_debt)
            
            if debt_to_forgive > 0:
                # Deduct the debt
                customer.current_debt -= debt_to_forgive
                customer.save()
                
                # Create the Ledger Entry to maintain the audit trail
                CustomerLedger.objects.create(
                    tenant=tenant,
                    branch_id=branch_id,
                    customer=customer,
                    transaction_type=CustomerLedger.TransactionType.PAYMENT, # Acts as a payment against their debt
                    amount=debt_to_forgive,
                    balance_after=customer.current_debt,
                    reference_id=return_order.id, # Link it to the Return transaction!
                    notes=f"Debt reversal for returned items (Orig. Order #{original_order.id})",
                    processed_by=cashier
                )
                
                # Deduct the forgiven debt from the remaining refund pool
                refund_remaining -= debt_to_forgive

    # 2. Handle leftover Cash Refunds
    # If there is STILL a refund remaining (either it wasn't a credit sale, 
    # or the refund exceeded the debt), issue it as a cash out flow.
    if refund_remaining > 0:
        Payment.objects.create(
            tenant=tenant,
            branch_id=branch_id,
            order=original_order, 
            processed_by=cashier,
            method=refund_method,
            amount=-refund_remaining, # Negative amount signifies money leaving the drawer
            reference_code=f"RET-{return_order.id}",
            transaction_type = Payment.transaction_type('REFUND')
        )
    """order=original_order
    order.status='Returned'
    order.save()"""
  
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



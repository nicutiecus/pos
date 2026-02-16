import threading
from django.test import TransactionTestCase
from django.db import connections
from django.core.exceptions import ValidationError
from decimal import Decimal
from django.db import models

from users.models import User, Tenant
from common.models import Branch
from inventory.models import Category, Product, InventoryBatch
from sales.services import create_sale_service
from sales.models import SalesOrder

class SalesConcurrencyTest(TransactionTestCase):
    """
    Heavy tests for Race Conditions.
    Simulates multiple cashiers selling the same stock simultaneously.
    """
    # Flushes the DB after run to ensure clean state for other tests
    serialized_rollback = True 

    def setUp(self):
        # 1. Setup Tenant & Branch
        self.tenant = Tenant.objects.create(name="Test Corp", subdomain="test")
        self.branch = Branch.objects.create(
            tenant=self.tenant, name="Main Branch", code="MB-01"
        )

        # 2. Setup User (Cashier)
        self.user = User.objects.create_user(
            email="cashier@test.com", 
            password="pass", 
            tenant=self.tenant
        )

        # 3. Setup Product
        self.category = Category.objects.create(tenant=self.tenant, name="General")
        self.product = Product.objects.create(
            tenant=self.tenant,
            name="Hot Cake",
            sku="HOT-001",
            category=self.category,
            cost_price=10.00,
            selling_price=20.00,
            unit_type=Product.UnitType.UNIT
        )

    def test_race_condition_selling_last_item(self):
        """
        SCENARIO: 
        We have exactly 1 item in stock.
        Two threads (Cashier A and Cashier B) try to sell 1 item simultaneously.
        
        EXPECTATION:
        - One transaction succeeds.
        - One transaction fails (ValidationError).
        - Final stock is 0 (NOT -1).
        """
        
        # 1. Setup Inventory: Exactly 1 item
        batch = InventoryBatch.objects.create(
            tenant=self.tenant,
            branch=self.branch,
            product=self.product,
            batch_number="BATCH-X",
            quantity_on_hand=Decimal('1.00'),
            status=InventoryBatch.Status.ACTIVE
        )

        # 2. Define the payload
        sale_payload = {
            "user": self.user,
            "branch_id": self.branch.id,
            "items": [{"product_id": self.product.id, "quantity": 1}],
            "payment_data": {"amount": 20.00, "method": "Cash"}
        }

        # 3. Define the Worker Function for Threads
        results = []
        errors = []

        def attempt_sale():
            # Ensure each thread has its own DB connection
            connections.close_all()
            try:
                order = create_sale_service(**sale_payload)
                results.append(order)
            except ValidationError as e:
                errors.append(e)
            except Exception as e:
                # Catch unexpected errors to debug
                print(f"\n🛑 THREAD ERROR: {e}")
                errors.append(f"Unexpected: {e}")
            finally:
                connections.close_all()

        # 4. Create Threads
        t1 = threading.Thread(target=attempt_sale)
        t2 = threading.Thread(target=attempt_sale)

        # 5. Start Threads "Simultaneously"
        t1.start()
        t2.start()

        # 6. Wait for both to finish
        t1.join()
        t2.join()

        # --- ASSERTIONS ---

        # Check 1: Exactly one success and one failure
        print(f"\nResults: {len(results)} Successes, {len(errors)} Failures")
        
        self.assertEqual(len(results), 1, "Exactly one sale should succeed.")
        self.assertEqual(len(errors), 1, "Exactly one sale should fail due to stock.")
        
        # Check 2: Verify the error message
        if errors:
            self.assertIn("Insufficient stock", str(errors[0]))

        # Check 3: Database Integrity (Crucial)
        # Refresh the batch from DB
        batch.refresh_from_db()
        self.assertEqual(batch.quantity_on_hand, 0, "Stock should be 0, not negative.")
        
        # Check 4: Sales Order Count
        self.assertEqual(SalesOrder.objects.count(), 1, "Only one order should exist.")
def test_concurrent_fifo_selection(self):
        """
        SCENARIO:
        Batch A (Expiring Today): 1 item
        Batch B (Expiring Tomorrow): 1 item
        Total Stock: 2 items
        
        Three threads try to buy 1 item each.
        
        EXPECTATION:
        - 2 Successes, 1 Failure.
        - Batch A becomes empty (DEPLETED).
        - Batch B becomes empty (DEPLETED).
        """
        # Create Batches
        InventoryBatch.objects.create(
            tenant=self.tenant, branch=self.branch, product=self.product,
            batch_number="OLD", quantity_on_hand=1, expiry_date="2024-01-01",
            cost_price_at_receipt=10.00 # Ensure cost is set
        )
        InventoryBatch.objects.create(
            tenant=self.tenant, branch=self.branch, product=self.product,
            batch_number="NEW", quantity_on_hand=1, expiry_date="2024-02-01",
            cost_price_at_receipt=10.00
        )

        successes = []
        failures = []

        def worker():
            connections.close_all()
            try:
                create_sale_service(
                    user=self.user, 
                    branch_id=self.branch.id,
                    items=[{"product_id": self.product.id, "quantity": 1}],
                    # ✅ FIX: Add Payment so it's not rejected as a credit sale
                    payment_data={"amount": 20.00, "method": "Cash"} 
                )
                successes.append(1)
            except ValidationError:
                failures.append(1)
            except Exception as e:
                # Print unexpected errors so we can see them in the console
                print(f"THREAD ERROR: {e}")
                failures.append(1)
            finally:
                connections.close_all()

        threads = [threading.Thread(target=worker) for _ in range(3)]
        
        for t in threads: t.start()
        for t in threads: t.join()

        self.assertEqual(len(successes), 2)
        self.assertEqual(len(failures), 1)
        
        # Verify Total Stock is 0
        total_stock = InventoryBatch.objects.filter(product=self.product).aggregate(
            total=models.Sum('quantity_on_hand')
        )['total'] or 0
        self.assertEqual(total_stock, 0)
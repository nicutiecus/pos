from django.db import migrations

def migrate_categories(apps, schema_editor):
    Expense = apps.get_model('finance', 'Expense')
    ExpenseCategory = apps.get_model('finance', 'ExpenseCategory')
    Account = apps.get_model('accounting', 'Account')
    
    for expense in Expense.objects.all():
        if expense.category:
            # Find an existing expense account to act as a fallback mapping
            account = Account.objects.filter(tenant=expense.tenant, account_type='Expense').first()
            if not account:
                continue 
                
            cat, _ = ExpenseCategory.objects.get_or_create(
                tenant=expense.tenant,
                name=expense.category, # The old string (e.g., "Internet & Communication")
                defaults={'account': account, 'is_active': True}
            )
            expense.category_fk = cat
            expense.save(update_fields=['category_fk'])

class Migration(migrations.Migration):
    dependencies = [
        ('finance', '0005_expensecategory_and_category_fk'),
    ]
    operations = [
        migrations.RunPython(migrate_categories, reverse_code=migrations.RunPython.noop),
    ]
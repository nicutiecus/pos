from django.db import migrations, models
import django.db.models.deletion

class Migration(migrations.Migration):
    dependencies = [
        ('finance', '0004_expense_scope_alter_expense_branch'),
        ('accounting', '0001_initial'),
        ('users', '0002_user_custom_permissions'),
    ]
    operations = [
        migrations.CreateModel(
            name='ExpenseCategory',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('name', models.CharField(max_length=150)),
                ('is_active', models.BooleanField(default=True)),
                ('account', models.ForeignKey(help_text='The General Ledger account to debit for this category.', limit_choices_to={'account_type': 'Expense'}, on_delete=django.db.models.deletion.PROTECT, to='accounting.account')),
                ('tenant', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='%(app_label)s_%(class)s_set', to='users.tenant')),
            ],
            options={
                'db_table': 'finance_expense_categories',
            },
        ),
        migrations.AddConstraint(
            model_name='expensecategory',
            constraint=models.UniqueConstraint(fields=('tenant', 'name'), name='unique_expense_category_per_tenant'),
        ),
        migrations.AddField(
            model_name='expense',
            name='category_fk',
            field=models.ForeignKey(null=True, on_delete=django.db.models.deletion.PROTECT, to='finance.expensecategory'),
        ),
    ]
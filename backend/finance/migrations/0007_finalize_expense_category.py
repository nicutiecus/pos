from django.db import migrations

class Migration(migrations.Migration):
    dependencies = [
        ('finance', '0006_populate_expense_categories'),
    ]
    operations = [
        migrations.RemoveField(
            model_name='expense',
            name='category',
        ),
        migrations.RenameField(
            model_name='expense',
            old_name='category_fk',
            new_name='category',
        ),
    ]
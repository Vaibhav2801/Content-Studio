# Generated for Content Studio Plan Roles & Billing Quotas

import django.db.models.deletion
import uuid
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('prospecting', '0019_workspacemembership'),
        ('social_content', '0013_engagementwebhookevent_engagementcontact_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='WorkspaceSubscription',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('tier', models.CharField(choices=[('FREE', 'Free'), ('STARTER', 'Starter'), ('ADVANCE', 'Advance'), ('ADMIN', 'Admin')], db_index=True, default='STARTER', max_length=20)),
                ('extra_connections', models.PositiveIntegerField(default=0)),
                ('has_engage_addon', models.BooleanField(default=False)),
                ('is_active', models.BooleanField(default=True)),
                ('billing_name', models.CharField(blank=True, default='', max_length=255)),
                ('billing_email', models.CharField(blank=True, default='', max_length=255)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('workspace', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='subscription', to='prospecting.workspace')),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='CreditAccount',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('total_allocated', models.PositiveIntegerField(default=50)),
                ('total_used', models.PositiveIntegerField(default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('workspace', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='credit_account', to='prospecting.workspace')),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='CreditTransaction',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('amount', models.IntegerField()),
                ('action_type', models.CharField(max_length=50)),
                ('description', models.CharField(max_length=255)),
                ('balance_after', models.IntegerField(default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('post', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='credit_transactions', to='social_content.socialpost')),
                ('workspace', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='credit_transactions', to='prospecting.workspace')),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='BillingInvoice',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('invoice_number', models.CharField(db_index=True, max_length=50, unique=True)),
                ('amount', models.DecimalField(decimal_places=2, max_digits=10)),
                ('currency', models.CharField(default='USD', max_length=10)),
                ('status', models.CharField(default='PAID', max_length=20)),
                ('title', models.CharField(max_length=255)),
                ('line_items', models.JSONField(blank=True, default=list)),
                ('payment_method', models.CharField(default='Credit Card (Simulated Checkout)', max_length=100)),
                ('billing_name', models.CharField(blank=True, default='', max_length=255)),
                ('billing_email', models.CharField(blank=True, default='', max_length=255)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('paid_at', models.DateTimeField(blank=True, null=True)),
                ('workspace', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='invoices', to='prospecting.workspace')),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
    ]

import uuid

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("social_content", "0015_billing_hardening"),
    ]

    operations = [
        migrations.CreateModel(
            name="VideoGenerationJob",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("idempotency_key", models.CharField(max_length=255, unique=True)),
                ("prompt", models.TextField()),
                ("provider", models.CharField(default="gemini", max_length=30)),
                ("model", models.CharField(max_length=100)),
                ("aspect_ratio", models.CharField(default="16:9", max_length=10)),
                ("resolution", models.CharField(default="720p", max_length=20)),
                ("duration_seconds", models.PositiveSmallIntegerField(default=8)),
                ("credits_charged", models.PositiveSmallIntegerField(default=10)),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("QUEUED", "Queued"),
                            ("SUBMITTED", "Submitted"),
                            ("PROCESSING", "Processing"),
                            ("COMPLETED", "Completed"),
                            ("FAILED", "Failed"),
                        ],
                        db_index=True,
                        default="QUEUED",
                        max_length=20,
                    ),
                ),
                ("provider_operation_id", models.CharField(blank=True, default="", max_length=500)),
                ("provider_metadata", models.JSONField(blank=True, default=dict)),
                ("error_message", models.CharField(blank=True, default="", max_length=500)),
                ("completed_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "credit_reservation",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="video_generation_job",
                        to="social_content.creditreservation",
                    ),
                ),
                (
                    "output_asset",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="video_generation_jobs",
                        to="social_content.mediaasset",
                    ),
                ),
                (
                    "variant",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="video_generation_jobs",
                        to="social_content.socialpostvariant",
                    ),
                ),
                (
                    "workspace",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="video_generation_jobs",
                        to="prospecting.workspace",
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at"],
                "indexes": [
                    models.Index(fields=["workspace", "status", "created_at"], name="social_video_ws_status_idx"),
                    models.Index(fields=["variant", "status"], name="social_video_variant_idx"),
                ],
            },
        ),
    ]

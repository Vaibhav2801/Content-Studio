from django.db import migrations


def route_all_workspaces_to_zernio(apps, schema_editor):
    social_workspace_settings = apps.get_model("social_content", "SocialWorkspaceSettings")
    social_workspace_settings.objects.filter(
        publishing_provider_override="UPLOAD_POST",
    ).update(publishing_provider_override="")

    for settings in social_workspace_settings.objects.exclude(
        disabled_publishing_providers=[],
    ).iterator():
        disabled = [
            provider
            for provider in settings.disabled_publishing_providers
            if provider != "ZERNIO"
        ]
        if disabled != settings.disabled_publishing_providers:
            settings.disabled_publishing_providers = disabled
            settings.save(update_fields=["disabled_publishing_providers", "updated_at"])


class Migration(migrations.Migration):
    dependencies = [
        ("social_content", "0011_social_audit_event"),
    ]

    operations = [
        migrations.RunPython(route_all_workspaces_to_zernio, migrations.RunPython.noop),
    ]

from io import StringIO

from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase
from django.utils import timezone

from integrations.social.models import (
    ConnectionState,
    PublishJob,
    PublishJobState,
    SocialConnection,
    SocialNetwork,
    SocialPost,
    SocialPostVariant,
    SocialPostVersion,
    SocialProvider,
)
from prospecting.models import Workspace


class DeleteUploadPostConnectionsCommandTests(TestCase):
    def setUp(self):
        self.workspace = Workspace.objects.create(name="Legacy Upload Post")
        self.other_workspace = Workspace.objects.create(name="Other workspace")

    def create_connection(self, workspace, provider=SocialProvider.UPLOAD_POST, account_id="account-1"):
        return SocialConnection.objects.create(
            workspace=workspace,
            network=SocialNetwork.LINKEDIN,
            provider=provider,
            provider_profile_id="profile-1",
            provider_account_id=account_id,
            display_name="Example page",
            status=ConnectionState.DISCONNECTED,
        )

    def test_default_is_preview_only(self):
        connection = self.create_connection(self.workspace)
        output = StringIO()

        call_command("delete_upload_post_connections", workspace_id=self.workspace.id, stdout=output)

        self.assertTrue(SocialConnection.objects.filter(pk=connection.pk).exists())
        self.assertIn("Preview only", output.getvalue())

    def test_confirmed_deletion_is_scoped_and_nulls_variant_reference(self):
        connection = self.create_connection(self.workspace)
        other_upload_post = self.create_connection(self.other_workspace, account_id="account-2")
        zernio = self.create_connection(self.workspace, provider=SocialProvider.ZERNIO, account_id="account-3")
        post = SocialPost.objects.create(workspace=self.workspace, idea_title="Existing draft")
        variant = SocialPostVariant.objects.create(
            post=post,
            connection=connection,
            network=SocialNetwork.LINKEDIN,
            copy="Draft copy",
            scheduled_for=timezone.now(),
        )

        call_command(
            "delete_upload_post_connections",
            workspace_id=self.workspace.id,
            confirm=True,
            stdout=StringIO(),
        )

        self.assertFalse(SocialConnection.objects.filter(pk=connection.pk).exists())
        self.assertTrue(SocialConnection.objects.filter(pk=other_upload_post.pk).exists())
        self.assertTrue(SocialConnection.objects.filter(pk=zernio.pk).exists())
        variant.refresh_from_db()
        self.assertIsNone(variant.connection_id)

    def test_publish_history_must_be_explicitly_deleted(self):
        connection = self.create_connection(self.workspace)
        post = SocialPost.objects.create(workspace=self.workspace, idea_title="Published post")
        variant = SocialPostVariant.objects.create(
            post=post,
            connection=connection,
            network=SocialNetwork.LINKEDIN,
            copy="Published copy",
            scheduled_for=timezone.now(),
        )
        version = SocialPostVersion.objects.create(
            variant=variant,
            version=1,
            copy=variant.copy,
            scheduled_for=variant.scheduled_for,
        )
        job = PublishJob.objects.create(
            variant=variant,
            connection=connection,
            approved_version=version,
            provider=SocialProvider.UPLOAD_POST,
            idempotency_key="legacy-upload-post-job",
            status=PublishJobState.PUBLISHED,
            scheduled_for=variant.scheduled_for,
        )

        with self.assertRaisesMessage(CommandError, "Deletion blocked"):
            call_command(
                "delete_upload_post_connections",
                workspace_id=self.workspace.id,
                confirm=True,
                stdout=StringIO(),
                stderr=StringIO(),
            )

        self.assertTrue(SocialConnection.objects.filter(pk=connection.pk).exists())
        self.assertTrue(PublishJob.objects.filter(pk=job.pk).exists())

        call_command(
            "delete_upload_post_connections",
            workspace_id=self.workspace.id,
            confirm=True,
            delete_publish_history=True,
            stdout=StringIO(),
        )

        self.assertFalse(SocialConnection.objects.filter(pk=connection.pk).exists())
        self.assertFalse(PublishJob.objects.filter(pk=job.pk).exists())

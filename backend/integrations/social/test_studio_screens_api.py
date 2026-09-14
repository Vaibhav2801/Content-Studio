from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from integrations.social.models import (
    ConnectionState,
    ContentSource,
    SocialConnection,
    SocialNetwork,
    SocialPost,
    SocialPostState,
    SocialPostVariant,
    SocialPostVersion,
    SocialProvider,
    SocialWorkspaceSettings,
    PublishJob,
    PublishJobState,
)
from integrations.social.publishing.fakes import FakeUploadPostProvider, FakeZernioProvider
from integrations.social.publishing.errors import ProviderTemporaryFailureError
from integrations.social.publishing.types import PublishingNetwork, SocialAccount
from integrations.social.services.composer import submit_for_review
from integrations.social.services.publishing_routing import create_publish_job
from integrations.social.services.studio import approve_exact_version
from prospecting.models import Workspace, WorkspaceMembership


@override_settings(CONTENT_AUTOMATION_DEV_BOOTSTRAP=False, SOCIAL_PUBLISHER_DEFAULT="UPLOAD_POST")
class ContentStudioScreensApiTests(TestCase):
    def setUp(self):
        users = get_user_model()
        self.user = users.objects.create_user(username="studio-screens")
        self.other_user = users.objects.create_user(username="other-studio-screens")
        self.workspace = Workspace.objects.create(name="Studio screens")
        self.other_workspace = Workspace.objects.create(name="Other studio screens")
        WorkspaceMembership.objects.create(workspace=self.workspace, user=self.user, role=WorkspaceMembership.OWNER, is_active=True)
        WorkspaceMembership.objects.create(workspace=self.other_workspace, user=self.other_user, role=WorkspaceMembership.OWNER, is_active=True)
        self.settings = SocialWorkspaceSettings.objects.create(
            workspace=self.workspace,
            brand_name="Studio Co",
            timezone="Asia/Kolkata",
            schedule_days=list(range(7)),
        )
        self.connection = SocialConnection.objects.create(
            workspace=self.workspace,
            network=SocialNetwork.LINKEDIN,
            provider=SocialProvider.UPLOAD_POST,
            provider_profile_id="profile-1",
            provider_account_id="account-1",
            display_name="Studio Company Page",
            status=ConnectionState.CONNECTED,
            connected_at=timezone.now(),
        )
        self.source = ContentSource.objects.create(workspace=self.workspace, label="Customer research", text_content="Research notes")
        self.post, self.variant = self.make_post("Review this", SocialPostState.DRAFT)
        submit_for_review(self.post)
        self.variant.refresh_from_db()
        self.other_post = SocialPost.objects.create(workspace=self.other_workspace, idea_title="Private post")
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def make_post(self, title, status, *, scheduled_for=None):
        post = SocialPost.objects.create(workspace=self.workspace, source=self.source, idea_title=title, idea_text="Shared idea", state=status)
        variant = SocialPostVariant.objects.create(
            post=post,
            connection=self.connection,
            network=SocialNetwork.LINKEDIN,
            copy=f"{title} copy",
            hashtags=["#Studio"],
            scheduled_for=scheduled_for or timezone.now() + timedelta(days=2),
            status=status,
        )
        return post, variant

    def test_approvals_are_grouped_and_expose_exact_immutable_versions(self):
        response = self.client.get(reverse("social-approvals"))
        self.assertEqual(response.status_code, 200)
        item = response.data["NEEDS_REVIEW"][0]
        self.assertEqual(item["topic"], "Review this")
        self.assertEqual(item["versions"][0]["copy"], "Review this copy")
        self.assertTrue(item["versions"][0]["id"])
        self.assertNotContains(response, "UPLOAD_POST")

    def test_exact_version_approval_and_edit_revocation(self):
        version = self.variant.versions.latest("version")
        with patch("integrations.social.services.studio.publishing_provider_registry.create", return_value=FakeUploadPostProvider()):
            approved = self.client.post(reverse("social-approval-action", args=[self.variant.id]), {
                "action": "APPROVE", "version_id": str(version.id),
            }, format="json")
        self.assertEqual(approved.status_code, 200)
        self.variant.refresh_from_db()
        self.assertEqual(self.variant.approved_version_id, version.id)
        self.assertEqual(self.variant.status, SocialPostState.APPROVED)
        edited = self.client.patch(reverse("social-variant-detail", args=[self.variant.id]), {"copy": "Edited approved copy"}, format="json")
        self.assertEqual(edited.status_code, 200)
        self.variant.refresh_from_db()
        self.assertIsNone(self.variant.approved_version_id)
        self.assertEqual(self.variant.status, SocialPostState.NEEDS_REVIEW)

    def test_exact_version_approval_accepts_dev_bootstrap_actor(self):
        version = self.variant.versions.latest("version")

        with patch(
            "integrations.social.services.studio.publishing_provider_registry.create",
            return_value=FakeUploadPostProvider(),
        ):
            approve_exact_version(self.variant, version.id, user=AnonymousUser())

        version.refresh_from_db()
        self.assertIsNone(version.approved_by)
        self.assertIsNotNone(version.approved_at)

    def test_approved_version_can_be_published_immediately_and_idempotently(self):
        version = self.variant.versions.latest("version")
        provider = FakeUploadPostProvider()
        with patch(
            "integrations.social.services.studio.publishing_provider_registry.create",
            return_value=provider,
        ):
            approve_exact_version(self.variant, version.id, user=self.user)

        before_publish = timezone.now()
        with patch(
            "integrations.social.services.lifecycle.publishing_provider_registry.create",
            return_value=provider,
        ):
            first = self.client.post(
                reverse("social-publish-now", args=[self.variant.id]),
                {},
                format="json",
            )
            second = self.client.post(
                reverse("social-publish-now", args=[self.variant.id]),
                {},
                format="json",
            )

        self.assertEqual(first.status_code, 202, first.data)
        self.assertEqual(first.data["publish_job"]["status"], PublishJobState.SUBMITTED)
        self.assertEqual(second.status_code, 202, second.data)
        self.assertEqual(PublishJob.objects.filter(variant=self.variant).count(), 1)
        job = PublishJob.objects.get(variant=self.variant)
        self.assertGreaterEqual(job.scheduled_for, before_publish)
        self.assertLessEqual(job.scheduled_for, timezone.now())
        self.assertEqual(provider.calls.count("publish_now"), 1)

    def test_existing_scheduled_job_can_publish_now(self):
        version = self.variant.versions.latest("version")
        provider = FakeUploadPostProvider()
        with patch(
            "integrations.social.services.studio.publishing_provider_registry.create",
            return_value=provider,
        ):
            approve_exact_version(self.variant, version.id, user=self.user)
        self.variant.refresh_from_db()
        version.refresh_from_db()
        route = create_publish_job(
            variant=self.variant,
            approved_version=version,
            idempotency_key="existing-scheduled-job",
            scheduled_for=timezone.now() + timedelta(days=2),
            provider_account_id=self.connection.provider_account_id,
            provider_profile_id=self.connection.provider_profile_id,
        )
        self.assertTrue(route.ready)
        self.variant.refresh_from_db()
        self.assertEqual(self.variant.status, SocialPostState.SCHEDULED)
        approvals = self.client.get(reverse("social-approvals"))
        self.assertIn(str(self.variant.id), [item["id"] for item in approvals.data["APPROVED"]])

        with patch(
            "integrations.social.services.lifecycle.publishing_provider_registry.create",
            return_value=provider,
        ):
            response = self.client.post(
                reverse("social-publish-now", args=[self.variant.id]),
                {},
                format="json",
            )

        self.assertEqual(response.status_code, 202, response.data)
        self.assertEqual(response.data["publish_job"]["id"], str(route.publish_job_id))
        self.assertEqual(PublishJob.objects.filter(variant=self.variant).count(), 1)
        job = PublishJob.objects.get(pk=route.publish_job_id)
        self.assertLessEqual(job.scheduled_for, timezone.now())
        self.assertEqual(provider.calls.count("publish_now"), 1)
    def test_request_changes_reject_and_batch_approval(self):
        changed = self.client.post(reverse("social-approval-action", args=[self.variant.id]), {
            "action": "REQUEST_CHANGES", "note": "Use a clearer opening.",
        }, format="json")
        self.assertEqual(changed.status_code, 200)
        self.assertEqual(changed.data["CHANGES_REQUESTED"][0]["review_note"], "Use a clearer opening.")
        second_post, second = self.make_post("Second review", SocialPostState.DRAFT)
        submit_for_review(second_post)
        second.refresh_from_db()
        approvals = [
            {"variant_id": str(self.variant.id), "version_id": str(self.variant.versions.latest("version").id)},
            {"variant_id": str(second.id), "version_id": str(second.versions.latest("version").id)},
        ]
        with patch("integrations.social.services.studio.publishing_provider_registry.create", return_value=FakeUploadPostProvider()):
            batch = self.client.post(reverse("social-approvals-batch"), {"approvals": approvals}, format="json")
        self.assertEqual(batch.status_code, 200)
        self.assertEqual(len(batch.data["APPROVED"]), 2)
        third_post, third = self.make_post("Reject this", SocialPostState.DRAFT)
        submit_for_review(third_post)
        rejected = self.client.post(reverse("social-approval-action", args=[third.id]), {"action": "REJECT", "note": "Not suitable."}, format="json")
        self.assertEqual(rejected.status_code, 200)
        third.refresh_from_db()
        self.assertEqual(third.status, SocialPostState.CANCELLED)

    def test_calendar_week_month_and_rescheduling_conflicts(self):
        week = self.client.get(reverse("social-calendar"), {"view": "WEEK", "date": self.variant.scheduled_for.date().isoformat()})
        month = self.client.get(reverse("social-calendar"), {"view": "MONTH", "date": self.variant.scheduled_for.date().isoformat()})
        self.assertEqual(week.status_code, 200)
        self.assertEqual(month.status_code, 200)
        self.assertEqual(week.data["timezone"], "Asia/Kolkata")
        self.assertEqual(week.data["items"][0]["account"]["display_name"], "Studio Company Page")
        conflict_time = timezone.now() + timedelta(days=4)
        _, conflict = self.make_post("Conflict", SocialPostState.SCHEDULED, scheduled_for=conflict_time)
        response = self.client.patch(reverse("social-reschedule", args=[self.variant.id]), {"scheduled_for": (conflict_time + timedelta(minutes=2)).isoformat()}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("within five minutes", str(response.data))
        past = self.client.patch(reverse("social-reschedule", args=[conflict.id]), {"scheduled_for": (timezone.now() - timedelta(days=1)).isoformat()}, format="json")
        self.assertEqual(past.status_code, 400)
        self.assertIn("future", str(past.data))

    def test_library_filters_search_duplicate_reuse_archive_and_isolation(self):
        published_post, _ = self.make_post("Published customer story", SocialPostState.PUBLISHED)
        filtered = self.client.get(reverse("social-library"), {"status": "PUBLISHED", "q": "customer", "platform": "LINKEDIN"})
        self.assertEqual(filtered.status_code, 200)
        self.assertEqual([item["id"] for item in filtered.data], [str(published_post.id)])
        duplicate = self.client.post(reverse("social-library-action", args=[published_post.id]), {"action": "DUPLICATE"}, format="json")
        reuse = self.client.post(reverse("social-library-action", args=[published_post.id]), {"action": "REUSE_IDEA"}, format="json")
        self.assertEqual(duplicate.status_code, 200)
        self.assertEqual(duplicate.data["variants"][0]["copy"], "Published customer story copy")
        self.assertEqual(reuse.data["variants"][0]["copy"], "")
        archived = self.client.post(reverse("social-library-action", args=[published_post.id]), {"action": "ARCHIVE"}, format="json")
        self.assertEqual(archived.status_code, 200)
        self.assertNotIn(str(published_post.id), [item["id"] for item in self.client.get(reverse("social-library")).data])
        private = self.client.post(reverse("social-library-action", args=[self.other_post.id]), {"action": "ARCHIVE"}, format="json")
        self.assertEqual(private.status_code, 404)

    def test_connections_are_vendor_neutral_and_support_disconnect_reconnect(self):
        scheduled_post, scheduled_variant = self.make_post("Scheduled before disconnect", SocialPostState.SCHEDULED)
        scheduled_version = SocialPostVersion.objects.create(
            variant=scheduled_variant,
            version=1,
            copy=scheduled_variant.copy,
            hashtags=scheduled_variant.hashtags,
            scheduled_for=scheduled_variant.scheduled_for,
        )
        scheduled_job = PublishJob.objects.create(
            variant=scheduled_variant,
            connection=self.connection,
            approved_version=scheduled_version,
            provider=SocialProvider.UPLOAD_POST,
            idempotency_key="disconnect-scheduled-job",
            status=PublishJobState.SCHEDULED,
            scheduled_for=scheduled_variant.scheduled_for,
        )
        published_post, published_variant = self.make_post("Already published", SocialPostState.PUBLISHED)
        listed = self.client.get(reverse("social-connections"))
        self.assertEqual(listed.status_code, 200)
        self.assertEqual(listed.data[0]["display_name"], "Studio Company Page")
        self.assertEqual(listed.data[0]["provider_label"], "Upload Post")
        self.assertTrue(listed.data[0]["can_remove"])
        self.assertEqual(listed.data[0]["removal_method"], "PROVIDER_MANAGED")
        self.assertNotContains(listed, "UPLOAD_POST")
        disconnected = self.client.post(reverse("social-connection-action", args=[self.connection.id]), {"action": "DISCONNECT"}, format="json")
        self.assertEqual(disconnected.status_code, 200)
        self.assertEqual(disconnected.data["status"], ConnectionState.DISCONNECTED)
        self.assertIsNotNone(disconnected.data["disconnected_at"])
        scheduled_job.refresh_from_db()
        scheduled_variant.refresh_from_db()
        scheduled_post.refresh_from_db()
        published_variant.refresh_from_db()
        published_post.refresh_from_db()
        self.assertEqual(scheduled_job.status, PublishJobState.CONNECTION_REQUIRED)
        self.assertEqual(scheduled_variant.status, SocialPostState.CONNECTION_REQUIRED)
        self.assertEqual(scheduled_post.state, SocialPostState.CONNECTION_REQUIRED)
        self.assertEqual(published_variant.status, SocialPostState.PUBLISHED)
        self.assertEqual(published_post.state, SocialPostState.PUBLISHED)
        with patch("integrations.social.services.studio.publishing_provider_registry.create", return_value=FakeUploadPostProvider()):
            reconnect = self.client.post(reverse("social-connection-action", args=[self.connection.id]), {"action": "RECONNECT"}, format="json")
        self.assertEqual(reconnect.status_code, 200)
        self.assertIn("authorization_url", reconnect.data)
        self.assertNotContains(reconnect, "Upload Post")

    def test_upload_post_removal_requires_remote_disconnect(self):
        fake = FakeUploadPostProvider()
        fake.accounts = (SocialAccount(
            provider_profile_id="profile-1",
            provider_account_id="account-1",
            network=PublishingNetwork.LINKEDIN,
            display_name="Studio Company Page",
            account_type="ORGANIZATION",
            capabilities=fake.capabilities,
        ),)
        with patch("integrations.social.services.studio.publishing_provider_registry.create", return_value=fake):
            response = self.client.post(
                reverse("social-connection-action", args=[self.connection.id]),
                {"action": "REMOVE"}, format="json",
            )
        self.assertEqual(response.status_code, 400)
        self.connection.refresh_from_db()
        self.assertEqual(self.connection.status, ConnectionState.CONNECTED)
        self.assertEqual(self.connection.provider_account_id, "account-1")

    def test_upload_post_removal_after_remote_disconnect_frees_local_connection(self):
        fake = FakeUploadPostProvider(accounts=())
        with patch("integrations.social.services.studio.publishing_provider_registry.create", return_value=fake):
            response = self.client.post(
                reverse("social-connection-action", args=[self.connection.id]),
                {"action": "REMOVE"}, format="json",
            )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, {"id": str(self.connection.id), "removed": True})
        self.connection.refresh_from_db()
        self.assertEqual(self.connection.status, ConnectionState.DISCONNECTED)
        self.assertEqual(self.connection.provider_account_id, "")
        self.assertNotIn(str(self.connection.id), [row["id"] for row in self.client.get(reverse("social-connections")).data])

    def test_upload_post_removal_opens_provider_account_manager_without_disconnect(self):
        fake = FakeUploadPostProvider()
        with patch("integrations.social.services.studio.publishing_provider_registry.create", return_value=fake):
            response = self.client.post(
                reverse("social-connection-action", args=[self.connection.id]),
                {"action": "PREPARE_REMOVE"}, format="json",
                HTTP_ORIGIN="http://localhost:5173",
            )
        self.assertEqual(response.status_code, 200)
        self.assertIn("authorization_url", response.data)
        self.assertIn("get_connection_url", fake.calls)
        self.connection.refresh_from_db()
        self.assertEqual(self.connection.status, ConnectionState.CONNECTED)

    def test_remove_zernio_account_removes_remote_connection_and_hides_local_record(self):
        account = SocialConnection.objects.create(
            workspace=self.workspace,
            network=SocialNetwork.INSTAGRAM,
            provider=SocialProvider.ZERNIO,
            provider_profile_id="zernio-profile",
            provider_account_id="zernio-account",
            display_name="@studio",
            status=ConnectionState.CONNECTED,
        )
        fake = FakeZernioProvider()
        with patch("integrations.social.services.studio.publishing_provider_registry.create", return_value=fake):
            response = self.client.post(
                reverse("social-connection-action", args=[account.id]),
                {"action": "REMOVE"}, format="json",
            )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, {"id": str(account.id), "removed": True})
        self.assertEqual(fake.removed_account, (self.workspace.id, "zernio-profile", "zernio-account"))
        account.refresh_from_db()
        self.assertEqual(account.status, ConnectionState.DISCONNECTED)
        self.assertEqual(account.provider_account_id, "")
        self.assertNotIn(str(account.id), [row["id"] for row in self.client.get(reverse("social-connections")).data])

    def test_remove_zernio_account_is_workspace_scoped(self):
        other_account = SocialConnection.objects.create(
            workspace=self.other_workspace,
            network=SocialNetwork.INSTAGRAM,
            provider=SocialProvider.ZERNIO,
            provider_profile_id="other-profile",
            provider_account_id="other-account",
            display_name="@other",
            status=ConnectionState.CONNECTED,
        )
        fake = FakeZernioProvider()
        with patch("integrations.social.services.studio.publishing_provider_registry.create", return_value=fake):
            response = self.client.post(
                reverse("social-connection-action", args=[other_account.id]),
                {"action": "REMOVE"}, format="json",
            )
        self.assertEqual(response.status_code, 404)
        self.assertNotIn("remove_account", fake.calls)
        other_account.refresh_from_db()
        self.assertEqual(other_account.status, ConnectionState.CONNECTED)

    def test_failed_zernio_removal_keeps_account_connected(self):
        account = SocialConnection.objects.create(
            workspace=self.workspace,
            network=SocialNetwork.INSTAGRAM,
            provider=SocialProvider.ZERNIO,
            provider_profile_id="zernio-profile",
            provider_account_id="zernio-account",
            display_name="@studio",
            status=ConnectionState.CONNECTED,
        )
        fake = FakeZernioProvider()
        fake.remove_account = lambda **kwargs: (_ for _ in ()).throw(ProviderTemporaryFailureError("Temporary failure"))
        with patch("integrations.social.services.studio.publishing_provider_registry.create", return_value=fake):
            response = self.client.post(
                reverse("social-connection-action", args=[account.id]),
                {"action": "REMOVE"}, format="json",
            )
        self.assertEqual(response.status_code, 502)
        account.refresh_from_db()
        self.assertEqual(account.status, ConnectionState.CONNECTED)
        self.assertEqual(account.provider_account_id, "zernio-account")

    def test_disconnect_is_blocked_while_provider_submission_is_in_flight(self):
        _, variant = self.make_post("Publishing now", SocialPostState.SUBMITTED)
        version = SocialPostVersion.objects.create(
            variant=variant,
            version=1,
            copy=variant.copy,
            hashtags=variant.hashtags,
            scheduled_for=variant.scheduled_for,
        )
        PublishJob.objects.create(
            variant=variant,
            connection=self.connection,
            approved_version=version,
            provider=SocialProvider.UPLOAD_POST,
            idempotency_key="disconnect-in-flight-job",
            status=PublishJobState.SUBMITTED,
            scheduled_for=variant.scheduled_for,
        )

        response = self.client.post(
            reverse("social-connection-action", args=[self.connection.id]),
            {"action": "DISCONNECT"},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("still being processed", str(response.data))
        self.connection.refresh_from_db()
        self.assertEqual(self.connection.status, ConnectionState.CONNECTED)

    def test_home_summarizes_reviews_schedule_and_failures(self):
        self.make_post("Upcoming", SocialPostState.SCHEDULED)
        self.make_post("Failure", SocialPostState.FAILED)
        response = self.client.get(reverse("social-studio-home"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["needs_approval"][0]["topic"], "Review this")
        self.assertEqual(response.data["upcoming"][0]["topic"], "Upcoming")
        self.assertEqual(response.data["failures"][0]["topic"], "Failure")
        self.assertEqual(response.data["totals"], {
            "drafts": 0,
            "needs_review": 1,
            "scheduled": 1,
            "published": 0,
        })

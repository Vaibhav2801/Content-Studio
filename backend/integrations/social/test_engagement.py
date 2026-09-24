import hashlib
import hmac
import json
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.db import connection
from django.test import TestCase, override_settings
from django.test.utils import CaptureQueriesContext
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from integrations.social.models import (
    ConnectionState,
    EngagementAutomation,
    EngagementAutomationStatus,
    EngagementContact,
    EngagementItemKind,
    EngagementReviewItem,
    EngagementReviewStatus,
    SocialConnection,
    SocialNetwork,
    SocialProvider,
    WorkspaceSubscription,
    WorkspaceTier,
)
from prospecting.models import Workspace, WorkspaceMembership


@override_settings(CONTENT_AUTOMATION_DEV_BOOTSTRAP=False, ZERNIO_WEBHOOK_SECRET="engagement-secret")
class EngagementApiTests(TestCase):
    def setUp(self):
        users = get_user_model()
        self.user = users.objects.create_user(username="engagement-owner")
        self.other_user = users.objects.create_user(username="other-engagement-owner")
        self.workspace = Workspace.objects.create(name="Engagement workspace")
        self.other_workspace = Workspace.objects.create(name="Other engagement workspace")
        WorkspaceMembership.objects.create(workspace=self.workspace, user=self.user, role=WorkspaceMembership.OWNER, is_active=True)
        WorkspaceMembership.objects.create(workspace=self.other_workspace, user=self.other_user, role=WorkspaceMembership.OWNER, is_active=True)
        WorkspaceSubscription.objects.create(workspace=self.workspace, tier=WorkspaceTier.ADVANCE)
        self.instagram = SocialConnection.objects.create(
            workspace=self.workspace,
            network=SocialNetwork.INSTAGRAM,
            provider=SocialProvider.ZERNIO,
            provider_profile_id="profile-engagement",
            provider_account_id="account-instagram",
            display_name="@engagement",
            status=ConnectionState.CONNECTED,
            connected_at=timezone.now(),
        )
        self.linkedin = SocialConnection.objects.create(
            workspace=self.workspace,
            network=SocialNetwork.LINKEDIN,
            provider=SocialProvider.ZERNIO,
            provider_profile_id="profile-engagement",
            provider_account_id="account-linkedin",
            display_name="Engagement Company",
            status=ConnectionState.CONNECTED,
            connected_at=timezone.now(),
        )
        self.other_connection = SocialConnection.objects.create(
            workspace=self.other_workspace,
            network=SocialNetwork.INSTAGRAM,
            provider=SocialProvider.ZERNIO,
            provider_profile_id="profile-other",
            provider_account_id="account-other",
            display_name="@other",
            status=ConnectionState.CONNECTED,
        )
        self.contact = EngagementContact.objects.create(
            workspace=self.workspace,
            platform=SocialNetwork.INSTAGRAM,
            provider_contact_id="contact-1",
            handle="@contact",
            display_name="Contact One",
        )
        self.review = EngagementReviewItem.objects.create(
            workspace=self.workspace,
            connection=self.instagram,
            contact=self.contact,
            kind=EngagementItemKind.DIRECT_MESSAGE,
            incoming_text="DEMO",
            suggested_text="Here is the approved demo reply.",
            conversation_id="conversation-1",
            provider_event_id="event-review",
            assignee=self.user,
        )
        EngagementReviewItem.objects.create(
            workspace=self.other_workspace,
            connection=self.other_connection,
            kind=EngagementItemKind.DIRECT_MESSAGE,
            suggested_text="Private other workspace reply",
            conversation_id="conversation-other",
            provider_event_id="event-other-review",
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def test_overview_is_workspace_scoped(self):
        response = self.client.get(reverse("social-engagement-overview"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual([item["id"] for item in response.data["reviews"]], [str(self.review.id)])
        self.assertEqual(response.data["reviews"][0]["connection_id"], str(self.instagram.id))
        self.assertEqual(response.data["reviews"][0]["account_name"], "@engagement")
        self.assertEqual(response.data["team"][0]["id"], str(self.user.id))
        self.assertTrue(response.data["policy"]["human_approval_required"])
        self.assertNotContains(response, "Private other workspace reply")

    def test_automation_is_created_as_draft_and_needs_explicit_approval(self):
        created = self.client.post(reverse("social-engagement-automations"), {
            "connection_id": str(self.instagram.id),
            "kind": "DM_KEYWORD",
            "name": "Demo requests",
            "keywords": ["DEMO"],
            "match_mode": "exact",
            "dm_message": "Would you like a team or solo demo?",
            "owner_id": str(self.user.id),
        }, format="json")
        self.assertEqual(created.status_code, 201)
        self.assertEqual(created.data["status"], EngagementAutomationStatus.DRAFT)
        automation = EngagementAutomation.objects.get(pk=created.data["id"])
        with CaptureQueriesContext(connection) as queries:
            activated = self.client.post(
                reverse("social-engagement-automation", args=[automation.id]),
                {"action": "APPROVE"},
                format="json",
            )
        self.assertEqual(activated.status_code, 200)
        self.assertEqual(activated.data["status"], EngagementAutomationStatus.ACTIVE)
        automation_table = connection.ops.quote_name(EngagementAutomation._meta.db_table)
        lookup = next(query["sql"] for query in queries if f"FROM {automation_table}" in query["sql"])
        self.assertNotIn(" JOIN ", lookup.upper())
        automation.refresh_from_db()
        self.assertEqual(automation.approved_by, self.user)

    def test_review_is_sent_only_after_approval(self):
        with patch("integrations.social.services.engagement.EngagementProvider.send_review", return_value="message-1") as send:
            response = self.client.post(
                reverse("social-engagement-review", args=[self.review.id]),
                {"action": "APPROVE_SEND", "draft": "Edited and approved reply."},
                format="json",
            )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], EngagementReviewStatus.SENT)
        send.assert_called_once()
        self.review.refresh_from_db()
        self.assertEqual(self.review.final_text, "Edited and approved reply.")
        self.assertEqual(self.review.approved_by, self.user)
        self.assertIsNotNone(self.review.sent_at)

    def test_ai_generation_only_updates_the_editable_draft(self):
        with patch(
            "integrations.social.engagement_views.generate_reply_suggestion",
            return_value="AI suggestion for human review.",
        ):
            response = self.client.post(
                reverse("social-engagement-review", args=[self.review.id]),
                {"action": "GENERATE"},
                format="json",
            )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["draft"], "AI suggestion for human review.")
        self.review.refresh_from_db()
        self.assertEqual(self.review.status, EngagementReviewStatus.PENDING)
        self.assertIsNone(self.review.approved_at)
        self.assertIsNone(self.review.sent_at)

    def test_linkedin_personal_message_cannot_be_sent(self):
        item = EngagementReviewItem.objects.create(
            workspace=self.workspace,
            connection=self.linkedin,
            kind=EngagementItemKind.DIRECT_MESSAGE,
            suggested_text="Personal LinkedIn DM",
            conversation_id="linkedin-conversation",
            provider_event_id="linkedin-personal-dm",
        )
        response = self.client.post(
            reverse("social-engagement-review", args=[item.id]),
            {"action": "APPROVE_SEND"},
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertContains(response, "must be copied and sent manually", status_code=400)
        item.refresh_from_db()
        self.assertEqual(item.status, EngagementReviewStatus.FAILED)

    def test_signed_message_webhook_creates_one_review_and_deduplicates(self):
        automation = EngagementAutomation.objects.create(
            workspace=self.workspace,
            connection=self.instagram,
            kind="DM_KEYWORD",
            name="Demo keyword",
            status=EngagementAutomationStatus.ACTIVE,
            keywords=["DEMO"],
            match_mode="exact",
            approved_dm_message="Approved demo suggestion",
            owner=self.user,
        )
        payload = {
            "id": "webhook-message-1",
            "event": "message.received",
            "account": {"id": "account-instagram"},
            "conversation": {"id": "conversation-webhook"},
            "message": {"id": "provider-message", "text": "DEMO", "senderId": "contact-webhook"},
            "contact": {"id": "contact-webhook", "name": "Webhook Contact", "username": "webhook"},
        }
        body = json.dumps(payload, separators=(",", ":")).encode()
        signature = hmac.new(b"engagement-secret", body, hashlib.sha256).hexdigest()
        url = reverse("social-engagement-webhook")
        first = self.client.post(url, data=body, content_type="application/json", HTTP_X_ZERNIO_SIGNATURE=signature)
        second = self.client.post(url, data=body, content_type="application/json", HTTP_X_ZERNIO_SIGNATURE=signature)
        self.assertEqual(first.status_code, 202)
        self.assertEqual(first.data["accepted"], 1)
        self.assertEqual(second.status_code, 202)
        self.assertEqual(second.data["accepted"], 0)
        created = EngagementReviewItem.objects.get(provider_event_id="webhook-message-1")
        self.assertEqual(created.suggested_text, "Approved demo suggestion")
        automation.refresh_from_db()
        self.assertEqual(automation.stats["runs"], 1)

    def test_story_reply_uses_top_level_webhook_metadata(self):
        automation = EngagementAutomation.objects.create(
            workspace=self.workspace,
            connection=self.instagram,
            kind="STORY_REPLY",
            name="Story greeting",
            status=EngagementAutomationStatus.ACTIVE,
            keywords=["HI"],
            match_mode="contains",
            approved_dm_message="Story reply suggestion",
            owner=self.user,
        )
        payload = {
            "id": "webhook-story-reply-1",
            "event": "message.received",
            "account": {"id": "account-instagram"},
            "conversation": {"id": "conversation-story"},
            "message": {"id": "provider-story-message", "text": "HI", "senderId": "contact-story"},
            "metadata": {"storyReply": {"storyId": "story-1", "storyUrl": "https://example.com/story"}},
            "contact": {"id": "contact-story", "name": "Story Contact", "username": "story"},
        }
        body = json.dumps(payload, separators=(",", ":")).encode()
        signature = hmac.new(b"engagement-secret", body, hashlib.sha256).hexdigest()

        response = self.client.post(
            reverse("social-engagement-webhook"),
            data=body,
            content_type="application/json",
            HTTP_X_ZERNIO_SIGNATURE=signature,
        )

        self.assertEqual(response.status_code, 202)
        self.assertEqual(response.data["accepted"], 1)
        created = EngagementReviewItem.objects.get(provider_event_id="webhook-story-reply-1")
        self.assertEqual(created.kind, EngagementItemKind.STORY_REPLY)
        self.assertEqual(created.suggested_text, "Story reply suggestion")
        self.assertEqual(created.metadata["automation_id"], str(automation.id))
        automation.refresh_from_db()
        self.assertEqual(automation.stats["runs"], 1)

    def test_campaign_uses_workspace_contact_picker_and_hides_provider_ids(self):
        response = self.client.post(reverse("social-engagement-campaigns"), {
            "connection_id": str(self.instagram.id),
            "name": "Demo follow-up",
            "audience": {"contact_ids": [str(self.contact.id)], "label": "Warm leads"},
            "steps": [{"message": "Would a short demo help?", "delay_minutes": 0}],
        }, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["audience"]["contact_ids"], [str(self.contact.id)])
        self.assertNotContains(response, "contact-1", status_code=201)
        campaign = self.workspace.engagement_campaigns.get(pk=response.data["id"])
        self.assertEqual(campaign.audience["provider_contact_ids"], ["contact-1"])
        with CaptureQueriesContext(connection) as queries:
            with patch(
                "integrations.social.engagement_views.approve_campaign",
                side_effect=lambda item, actor: item,
            ):
                approved = self.client.post(
                    reverse("social-engagement-campaign", args=[campaign.id]),
                    {"action": "APPROVE"},
                    format="json",
                )
        self.assertEqual(approved.status_code, 200)
        campaign_table = connection.ops.quote_name(type(campaign)._meta.db_table)
        lookup = next(query["sql"] for query in queries if f"FROM {campaign_table}" in query["sql"])
        self.assertNotIn(" JOIN ", lookup.upper())

    def test_comment_to_dm_webhook_creates_public_comment_and_private_dm(self):
        automation = EngagementAutomation.objects.create(
            workspace=self.workspace,
            connection=self.instagram,
            kind="COMMENT_TO_DM",
            name="Pricing Comment Automation",
            status=EngagementAutomationStatus.ACTIVE,
            keywords=["PRICE", "COST"],
            match_mode="contains",
            approved_dm_message="Here is our pricing sheet: https://example.com/pricing",
            approved_comment_reply="Sent you a DM with the details!",
            owner=self.user,
        )
        payload = {
            "id": "webhook-comment-1",
            "event": "comment.received",
            "account": {"id": "account-instagram"},
            "post": {"id": "instagram-post-101"},
            "comment": {"id": "comment-555", "text": "What is the price of this?", "postId": "instagram-post-101"},
            "contact": {"id": "contact-commenter", "name": "Commenter User", "username": "commenter"},
        }
        body = json.dumps(payload, separators=(",", ":")).encode()
        signature = hmac.new(b"engagement-secret", body, hashlib.sha256).hexdigest()

        response = self.client.post(
            reverse("social-engagement-webhook"),
            data=body,
            content_type="application/json",
            HTTP_X_ZERNIO_SIGNATURE=signature,
        )
        self.assertEqual(response.status_code, 202)
        self.assertEqual(response.data["accepted"], 2)

        public_item = EngagementReviewItem.objects.get(provider_event_id="webhook-comment-1")
        self.assertEqual(public_item.kind, EngagementItemKind.COMMENT_REPLY)
        self.assertEqual(public_item.suggested_text, "Sent you a DM with the details!")
        self.assertEqual(public_item.provider_post_id, "instagram-post-101")
        self.assertEqual(public_item.provider_comment_id, "comment-555")

        private_item = EngagementReviewItem.objects.get(provider_event_id="webhook-comment-1:private")
        self.assertEqual(private_item.kind, EngagementItemKind.DIRECT_MESSAGE)
        self.assertEqual(private_item.suggested_text, "Here is our pricing sheet: https://example.com/pricing")
        self.assertEqual(private_item.provider_post_id, "instagram-post-101")
        self.assertEqual(private_item.provider_comment_id, "comment-555")
        self.assertTrue(private_item.metadata.get("private_reply"))

        automation.refresh_from_db()
        self.assertEqual(automation.stats["runs"], 1)

    def test_story_reply_with_meta_reply_to_story_format(self):
        automation = EngagementAutomation.objects.create(
            workspace=self.workspace,
            connection=self.instagram,
            kind="STORY_REPLY",
            name="Meta Story Greeting",
            status=EngagementAutomationStatus.ACTIVE,
            keywords=["COOL"],
            match_mode="contains",
            approved_dm_message="Thanks for checking out our story!",
            owner=self.user,
        )
        # Native Meta Graph API webhook format for story reply
        payload = {
            "id": "webhook-meta-story-1",
            "event": "message.received",
            "account": {"id": "account-instagram"},
            "conversation": {"id": "conv-story-100"},
            "message": {
                "id": "mid-story-1",
                "text": "So cool!",
                "reply_to": {
                    "story": {
                        "id": "story-meta-id-1",
                        "url": "https://instagram.com/stories/...",
                    }
                },
                "senderId": "contact-story-fan",
            },
            "contact": {"id": "contact-story-fan", "name": "Story Fan", "username": "storyfan"},
        }
        body = json.dumps(payload, separators=(",", ":")).encode()
        signature = hmac.new(b"engagement-secret", body, hashlib.sha256).hexdigest()

        response = self.client.post(
            reverse("social-engagement-webhook"),
            data=body,
            content_type="application/json",
            HTTP_X_ZERNIO_SIGNATURE=signature,
        )
        self.assertEqual(response.status_code, 202)
        self.assertEqual(response.data["accepted"], 1)

        created = EngagementReviewItem.objects.get(provider_event_id="webhook-meta-story-1")
        self.assertEqual(created.kind, EngagementItemKind.STORY_REPLY)
        self.assertEqual(created.suggested_text, "Thanks for checking out our story!")
        self.assertEqual(created.metadata["automation_id"], str(automation.id))
        automation.refresh_from_db()
        self.assertEqual(automation.stats["runs"], 1)

    def test_story_reply_without_keywords_matches_any_story_response(self):
        automation = EngagementAutomation.objects.create(
            workspace=self.workspace,
            connection=self.instagram,
            kind="STORY_REPLY",
            name="Catch-All Story Reply",
            status=EngagementAutomationStatus.ACTIVE,
            keywords=[],
            match_mode="contains",
            approved_dm_message="Hey! Thanks for replying to our story.",
            owner=self.user,
        )
        payload = {
            "id": "webhook-story-emoji-1",
            "event": "message.received",
            "account": {"id": "account-instagram"},
            "conversation": {"id": "conv-story-200"},
            "message": {
                "id": "mid-story-emoji",
                "text": "🔥",
                "storyReply": {"storyId": "story-emoji-id"},
                "senderId": "contact-emoji-fan",
            },
            "contact": {"id": "contact-emoji-fan", "name": "Emoji Fan", "username": "emojifan"},
        }
        body = json.dumps(payload, separators=(",", ":")).encode()
        signature = hmac.new(b"engagement-secret", body, hashlib.sha256).hexdigest()

        response = self.client.post(
            reverse("social-engagement-webhook"),
            data=body,
            content_type="application/json",
            HTTP_X_ZERNIO_SIGNATURE=signature,
        )
        self.assertEqual(response.status_code, 202)
        created = EngagementReviewItem.objects.get(provider_event_id="webhook-story-emoji-1")
        self.assertEqual(created.kind, EngagementItemKind.STORY_REPLY)
        self.assertEqual(created.suggested_text, "Hey! Thanks for replying to our story.")

    def test_auto_activate_on_create_automation(self):
        response = self.client.post(reverse("social-engagement-automations"), {
            "connection_id": str(self.instagram.id),
            "kind": "STORY_REPLY",
            "name": "Auto Activated Story Rule",
            "keywords": ["LINK"],
            "dm_message": "Here is the story link!",
            "activate": True,
        }, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["status"], EngagementAutomationStatus.ACTIVE)

    def test_test_trigger_endpoint_creates_review_items(self):
        automation = EngagementAutomation.objects.create(
            workspace=self.workspace,
            connection=self.instagram,
            kind="COMMENT_TO_DM",
            name="Test Sim Rule",
            status=EngagementAutomationStatus.ACTIVE,
            keywords=["DISCOUNT"],
            approved_dm_message="Your 20% discount code is SAVE20",
            approved_comment_reply="Check your DMs for the discount code!",
            owner=self.user,
        )
        response = self.client.post(reverse("social-engagement-test-trigger"), {
            "automation_id": str(automation.id),
            "text": "DISCOUNT please",
            "handle": "@test_shopper",
        }, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(len(response.data["reviews"]), 2)
        kinds = [r["kind"] for r in response.data["reviews"]]
        self.assertIn("Comment reply", kinds)
        self.assertIn("Direct message", kinds)

    def test_active_automation_auto_dispatches_reply_without_manual_approval(self):
        automation = EngagementAutomation.objects.create(
            workspace=self.workspace,
            connection=self.instagram,
            kind="STORY_REPLY",
            name="Instant Story Responder",
            status=EngagementAutomationStatus.ACTIVE,
            keywords=["HI"],
            approved_dm_message="Instant auto-reply without manual approval!",
            owner=self.user,
        )
        payload = {
            "id": "webhook-instant-auto-send-1",
            "event": "message.received",
            "account": {"id": "account-instagram"},
            "conversation": {"id": "conversation-instant"},
            "message": {"id": "msg-instant", "text": "HI", "senderId": "contact-instant"},
            "metadata": {"storyReply": {"storyId": "story-instant"}},
            "contact": {"id": "contact-instant", "name": "Instant Contact", "username": "instant"},
        }
        body = json.dumps(payload, separators=(",", ":")).encode()
        signature = hmac.new(b"engagement-secret", body, hashlib.sha256).hexdigest()

        with patch("integrations.social.services.engagement.EngagementProvider.send_review", return_value="provider-msg-999") as send:
            response = self.client.post(
                reverse("social-engagement-webhook"),
                data=body,
                content_type="application/json",
                HTTP_X_ZERNIO_SIGNATURE=signature,
            )
            self.assertEqual(response.status_code, 202)
            send.assert_called_once()
            created = EngagementReviewItem.objects.get(provider_event_id="webhook-instant-auto-send-1")
            self.assertEqual(created.status, EngagementReviewStatus.SENT)
            self.assertEqual(created.final_text, "Instant auto-reply without manual approval!")
            self.assertEqual(created.provider_message_id, "provider-msg-999")
            self.assertIsNotNone(created.sent_at)

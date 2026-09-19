from datetime import timedelta
from unittest.mock import Mock, patch
from urllib.parse import parse_qs, urlparse

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils import timezone

from integrations.linkedin.models import LinkedInAutomationSettings, LinkedInPost
from integrations.social.models import BrandProfile, ConnectionState, ContentStudioOnboarding, SocialConnection, SocialNetwork, SocialProvider
from integrations.social.publishing.adapters import TARGET_CAPABILITIES
from integrations.social.publishing.fakes import FakeUploadPostProvider
from integrations.social.publishing.errors import ProviderPermanentFailureError, ProviderValidationError
from integrations.social.publishing.types import CompleteConnectionResult, ProviderName, PublishingNetwork, SocialAccount
from integrations.social.services.linkedin_compat import sync_settings
from prospecting.models import Workspace, WorkspaceMembership


@override_settings(CONTENT_STUDIO_DRAFT_ONLY_ALLOWED=True, SOCIAL_PUBLISHER_DEFAULT="UPLOAD_POST")
class ContentStudioOnboardingApiTests(TestCase):
    def setUp(self):
        user_model = get_user_model()
        self.user = user_model.objects.create_user(username="onboarding-user", password="test-password")
        self.workspace = Workspace.objects.create(name="Onboarding workspace")
        WorkspaceMembership.objects.create(
            workspace=self.workspace,
            user=self.user,
            role=WorkspaceMembership.OWNER,
            is_active=True,
        )
        self.client.force_login(self.user)
        self.fake_account = SocialAccount(
            provider_profile_id="profile-1",
            provider_account_id="page-1",
            network=PublishingNetwork.LINKEDIN,
            display_name="LumaDesk Company Page",
            account_type="ORGANIZATION",
            capabilities=TARGET_CAPABILITIES,
        )
        self.fake = FakeUploadPostProvider(accounts=(self.fake_account,))

    @staticmethod
    def connection_state(response):
        return parse_qs(urlparse(response.data["authorization_url"]).query)["state"][0]

    def test_first_use_is_not_started_and_can_enter_draft_only_mode(self):
        response = self.client.get(reverse("content-studio-onboarding"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], "NOT_STARTED")
        self.assertEqual(response.data["current_step"], 1)
        self.assertTrue(response.data["can_skip_connection"])
        self.assertEqual([item["network"] for item in response.data["networks"]], ["LINKEDIN", "X", "INSTAGRAM"])

        completed = self.client.post(
            reverse("content-studio-onboarding-step", args=[1]),
            {"skip": True},
            content_type="application/json",
        )
        self.assertEqual(completed.status_code, 200)
        self.assertTrue(completed.data["draft_only_mode"])
        self.assertIn(1, completed.data["completed_steps"])

    def test_established_workspace_is_not_forced_through_first_run(self):
        LinkedInAutomationSettings.objects.create(
            workspace=self.workspace,
            page_name="Established Business",
            company_description="Existing saved setup",
        )
        response = self.client.get(reverse("content-studio-onboarding"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], "COMPLETE")
        self.assertEqual(response.data["completed_steps"], [1, 2, 3, 4])

    def test_ordinary_compatibility_sync_preserves_brand_edits_until_an_explicit_settings_update(self):
        legacy = LinkedInAutomationSettings.objects.create(
            workspace=self.workspace,
            company_description="Initial legacy description",
        )
        sync_settings(legacy, update_brand=True)
        brand = BrandProfile.objects.get(settings__workspace=self.workspace)
        brand.business_description = "A richer Brand profile written in Settings."
        brand.save(update_fields=["business_description", "updated_at"])

        sync_settings(legacy)
        brand.refresh_from_db()
        self.assertEqual(brand.business_description, "A richer Brand profile written in Settings.")

        legacy.company_description = "An intentional business profile update."
        legacy.save(update_fields=["company_description"])
        sync_settings(legacy, update_brand=True)
        brand.refresh_from_db()
        self.assertEqual(brand.business_description, "An intentional business profile update.")

    def test_back_navigation_and_refresh_recover_saved_answers(self):
        self.client.post(reverse("content-studio-onboarding"), {}, content_type="application/json")
        self.client.post(reverse("content-studio-onboarding-step", args=[1]), {"skip": True}, content_type="application/json")
        saved = self.client.post(reverse("content-studio-onboarding-step", args=[2]), {
            "name": "Saved Business",
            "description": "We help operations teams.",
            "audience": "Operations leaders",
            "language": "English",
        }, content_type="application/json")
        self.assertEqual(saved.status_code, 200)
        self.assertEqual(saved.data["current_step"], 3)

        back = self.client.patch(reverse("content-studio-onboarding"), {"current_step": 2}, content_type="application/json")
        self.assertEqual(back.status_code, 200)
        refreshed = self.client.get(reverse("content-studio-onboarding"))
        self.assertEqual(refreshed.data["current_step"], 2)
        self.assertEqual(refreshed.data["business"]["name"], "Saved Business")
        self.assertEqual(refreshed.data["business"]["audience"], "Operations leaders")

    def test_topics_and_schedule_are_saved_to_existing_content_settings(self):
        response = self.client.post(reverse("content-studio-onboarding-step", args=[3]), {
            "topics": ["Customer stories", "Product tips"],
            "posting_days": [1, 3, 5],
            "time": "14:30",
            "timezone": "Europe/London",
        }, content_type="application/json")
        self.assertEqual(response.status_code, 200)
        self.assertIn(3, response.data["completed_steps"])
        self.assertEqual(response.data["schedule"]["topics"], ["Customer stories", "Product tips"])
        self.assertEqual(response.data["schedule"]["posting_days"], [1, 3, 5])
        legacy = LinkedInAutomationSettings.objects.get(workspace=self.workspace)
        self.assertEqual(legacy.post_time.strftime("%H:%M"), "14:30")
        self.assertEqual(legacy.timezone, "Europe/London")
        self.assertEqual(legacy.workspace.social_content_settings.schedule_days, [1, 3, 5])

    @patch("integrations.social.services.onboarding.publishing_provider_registry.create")
    def test_successful_connection_returns_safe_account_details(self, create_provider):
        create_provider.return_value = self.fake
        started = self.client.post(reverse("content-studio-connection-start"), {}, content_type="application/json")
        self.assertEqual(started.status_code, 200)
        self.assertIn("authorization_url", started.data)
        self.assertNotIn("provider", started.data)
        state = self.connection_state(started)
        self.assertNotEqual(
            ContentStudioOnboarding.objects.get(workspace=self.workspace).connection_state,
            state,
        )

        completed = self.client.post(reverse("content-studio-connection-complete"), {
            "state": state,
            "code": "authorization-code",
        }, content_type="application/json")
        self.assertEqual(completed.status_code, 200)
        self.assertEqual(completed.data["connection"]["display_name"], "LumaDesk Company Page")
        self.assertEqual(completed.data["connection"]["account_type"], "Company Page")
        self.assertEqual(completed.data["connection"]["health"], "HEALTHY")
        self.assertNotIn("provider", completed.data)
        connection = SocialConnection.objects.get(provider_account_id="page-1")
        self.assertEqual(connection.provider, SocialProvider.UPLOAD_POST)

    @override_settings(SOCIAL_PUBLISHER_DEFAULT="ZERNIO")
    @patch("integrations.social.services.onboarding.publishing_provider_registry.create")
    def test_zernio_callback_profile_and_account_are_used_for_instagram_completion(self, create_provider):
        instagram = SocialAccount(
            provider_profile_id="profile-instagram",
            provider_account_id="account-instagram",
            network=PublishingNetwork.INSTAGRAM,
            display_name="Kaia Blaze",
            account_type="BUSINESS",
            capabilities=TARGET_CAPABILITIES,
        )
        self.fake.accounts = (instagram,)
        self.fake.complete_connection = Mock(return_value=CompleteConnectionResult(
            provider=ProviderName.ZERNIO,
            provider_connection_id="profile-instagram",
            connected=True,
        ))
        create_provider.return_value = self.fake
        started = self.client.post(
            reverse("content-studio-connection-start"),
            {"network": "INSTAGRAM", "return_to": "connections"},
            content_type="application/json",
        )
        state = self.connection_state(started)

        completed = self.client.post(reverse("content-studio-connection-complete"), {
            "state": state,
            "profile_id": "profile-instagram",
            "account_id": "account-instagram",
        }, content_type="application/json")

        self.assertEqual(completed.status_code, 200, completed.data)
        request = self.fake.complete_connection.call_args.args[0]
        self.assertEqual(request.provider_profile_id, "profile-instagram")
        self.assertEqual(request.network, PublishingNetwork.INSTAGRAM)
        self.assertTrue(SocialConnection.objects.filter(
            workspace=self.workspace,
            provider=SocialProvider.ZERNIO,
            provider_account_id="account-instagram",
        ).exists())

    @override_settings(SOCIAL_PUBLISHER_DEFAULT="ZERNIO")
    @patch("integrations.social.services.onboarding.publishing_provider_registry.create")
    def test_headless_linkedin_choice_is_state_bound_and_keeps_oauth_tokens_private(self, create_provider):
        create_provider.return_value = self.fake
        self.fake.pending_linkedin_selection = Mock(return_value={
            "organizations": [{"id": "123", "name": "LumaDesk Company Page", "vanityName": "lumadesk"}],
            "tempToken": "secret-temporary-token",
            "userProfile": {"id": "member-1", "displayName": "Onboarding Member", "vanityName": "member"},
        })
        self.fake.select_linkedin_account = Mock(return_value={"account": {"accountId": "page-1"}})
        self.fake.complete_connection = Mock(return_value=CompleteConnectionResult(
            provider=ProviderName.ZERNIO, provider_connection_id="profile-1", connected=True,
        ))
        other_page = SocialAccount(
            provider_profile_id="profile-1", provider_account_id="other-page",
            network=PublishingNetwork.LINKEDIN, display_name="Another Company Page",
            account_type="ORGANIZATION", capabilities=TARGET_CAPABILITIES,
        )
        self.fake.accounts = (other_page, self.fake_account)
        started = self.client.post(reverse("content-studio-connection-start"), {}, content_type="application/json")
        self.assertEqual(started.status_code, 200, started.data)
        state = self.connection_state(started)
        premature = self.client.post(reverse("content-studio-connection-complete"), {"state": state}, content_type="application/json")
        self.assertEqual(premature.status_code, 400)
        wrong_state = self.client.post(reverse("content-studio-connection-choices"), {
            "state": "wrong-state", "pending_data_token": "pending-token",
        }, content_type="application/json")
        self.assertEqual(wrong_state.status_code, 400)
        self.fake.pending_linkedin_selection.assert_not_called()
        choices = self.client.post(reverse("content-studio-connection-choices"), {
            "state": state, "pending_data_token": "pending-token",
        }, content_type="application/json")
        self.assertEqual(choices.status_code, 200, choices.data)
        self.assertEqual(choices.data["accounts"], [
            {"id": "personal", "name": "Onboarding Member", "vanity_name": "member", "account_type": "PERSON"},
            {"id": "123", "name": "LumaDesk Company Page", "vanity_name": "lumadesk", "account_type": "ORGANIZATION"},
        ])
        self.assertEqual(choices.data["organizations"], [{"id": "123", "name": "LumaDesk Company Page", "vanity_name": "lumadesk"}])
        self.assertNotIn("secret-temporary-token", str(choices.data))
        selected = self.client.post(reverse("content-studio-connection-select"), {
            "state": state, "pending_data_token": "pending-token", "organization_id": "123",
            "account_type": "ORGANIZATION", "connect_token": "short-connect-token",
        }, content_type="application/json")
        self.assertEqual(selected.status_code, 200, selected.data)
        self.assertEqual(selected.data["connection"]["display_name"], "LumaDesk Company Page")
        self.fake.select_linkedin_account.assert_called_once_with(
            self.workspace.id, "pending-token", "organization", "123", "short-connect-token"
        )
        self.assertEqual(SocialConnection.objects.get(provider_account_id="page-1").provider, SocialProvider.ZERNIO)
        self.assertFalse(SocialConnection.objects.filter(provider_account_id="other-page").exists())

    @override_settings(SOCIAL_PUBLISHER_DEFAULT="ZERNIO")
    @patch("integrations.social.services.onboarding.publishing_provider_registry.create")
    def test_headless_linkedin_choice_connects_personal_profile(self, create_provider):
        personal_account = SocialAccount(
            provider_profile_id="profile-1",
            provider_account_id="personal-1",
            network=PublishingNetwork.LINKEDIN,
            display_name="Onboarding Member",
            account_type="PERSON",
            capabilities=TARGET_CAPABILITIES,
        )
        self.fake.accounts = (personal_account,)
        self.fake.pending_linkedin_selection = Mock(return_value={
            "organizations": [],
            "tempToken": "secret-temporary-token",
            "userProfile": {"id": "member-1", "displayName": "Onboarding Member", "vanityName": "member"},
        })
        self.fake.select_linkedin_account = Mock(return_value={
            "account": {"accountId": "personal-1", "accountType": "personal"},
        })
        self.fake.complete_connection = Mock(return_value=CompleteConnectionResult(
            provider=ProviderName.ZERNIO,
            provider_connection_id="profile-1",
            connected=True,
        ))
        create_provider.return_value = self.fake
        started = self.client.post(
            reverse("content-studio-connection-start"),
            {},
            content_type="application/json",
        )
        state = self.connection_state(started)

        choices = self.client.post(reverse("content-studio-connection-choices"), {
            "state": state,
            "pending_data_token": "pending-token",
        }, content_type="application/json")
        self.assertEqual(choices.status_code, 200, choices.data)
        self.assertEqual(choices.data["accounts"], [{
            "id": "personal",
            "name": "Onboarding Member",
            "vanity_name": "member",
            "account_type": "PERSON",
        }])

        selected = self.client.post(reverse("content-studio-connection-select"), {
            "state": state,
            "pending_data_token": "pending-token",
            "account_type": "PERSON",
            "connect_token": "short-connect-token",
        }, content_type="application/json")
        self.assertEqual(selected.status_code, 200, selected.data)
        self.assertEqual(selected.data["connection"]["display_name"], "Onboarding Member")
        self.assertEqual(selected.data["connection"]["account_type"], "Personal profile")
        self.fake.select_linkedin_account.assert_called_once_with(
            self.workspace.id,
            "pending-token",
            "personal",
            "",
            "short-connect-token",
        )
        self.assertTrue(SocialConnection.objects.filter(
            workspace=self.workspace,
            provider_account_id="personal-1",
            account_type="PERSON",
        ).exists())

    @patch("integrations.social.services.onboarding.publishing_provider_registry.create")
    def test_instagram_can_be_connected_during_onboarding(self, create_provider):
        instagram = SocialAccount(
            provider_profile_id="profile-1", provider_account_id="instagram-1",
            network=PublishingNetwork.INSTAGRAM, display_name="@lumadesk",
            account_type="BUSINESS", capabilities=self.fake.capabilities,
        )
        self.fake.accounts = (instagram,)
        create_provider.return_value = self.fake
        started = self.client.post(reverse("content-studio-connection-start"), {"network": "INSTAGRAM"}, content_type="application/json")
        self.assertEqual(started.status_code, 200, started.data)
        completed = self.client.post(reverse("content-studio-connection-complete"), {
            "state": self.connection_state(started), "code": "authorization-code",
        }, content_type="application/json")
        self.assertEqual(completed.status_code, 200, completed.data)
        self.assertEqual(completed.data["connection"]["network"], "INSTAGRAM")
        self.assertTrue(SocialConnection.objects.filter(workspace=self.workspace, network=SocialNetwork.INSTAGRAM, status=ConnectionState.CONNECTED).exists())
        step = self.client.post(reverse("content-studio-onboarding-step", args=[1]), {"skip": False}, content_type="application/json")
        self.assertEqual(step.status_code, 200, step.data)

    @override_settings(CONTENT_STUDIO_FRONTEND_ORIGINS=["http://localhost:5173"])
    @patch("integrations.social.services.onboarding.publishing_provider_registry.create")
    def test_local_connection_returns_to_the_same_authenticated_frontend(self, create_provider):
        create_provider.return_value = self.fake
        with patch.object(self.fake, "get_connection_url", wraps=self.fake.get_connection_url) as get_url:
            response = self.client.post(
                reverse("content-studio-connection-start"), {},
                content_type="application/json", HTTP_ORIGIN="http://localhost:5173",
            )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(get_url.call_args.args[0].redirect_uri, "http://localhost:5173/content/onboarding")

    @override_settings(CONTENT_STUDIO_FRONTEND_ORIGINS=["http://localhost:5173"])
    @patch("integrations.social.services.onboarding.publishing_provider_registry.create")
    def test_connection_started_from_connections_returns_to_connections(self, create_provider):
        create_provider.return_value = self.fake
        with patch.object(self.fake, "get_connection_url", wraps=self.fake.get_connection_url) as get_url:
            response = self.client.post(
                reverse("content-studio-connection-start"),
                {"return_to": "connections"},
                content_type="application/json",
                HTTP_ORIGIN="http://localhost:5173",
            )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(get_url.call_args.args[0].redirect_uri, "http://localhost:5173/content/connections")

    @override_settings(
        CONTENT_STUDIO_FRONTEND_ORIGINS=["https://content-studio-5m7.pages.dev"],
        SOCIAL_PUBLISHER_DEFAULT="ZERNIO",
    )
    @patch("integrations.social.services.onboarding.publishing_provider_registry.create")
    def test_instagram_connection_uses_zernio_and_deployed_pages_return_url(self, create_provider):
        create_provider.return_value = self.fake
        with patch.object(self.fake, "get_connection_url", wraps=self.fake.get_connection_url) as get_url:
            response = self.client.post(
                reverse("content-studio-connection-start"),
                {"network": "INSTAGRAM", "return_to": "connections"},
                content_type="application/json",
                HTTP_ORIGIN="https://content-studio-5m7.pages.dev",
            )
        self.assertEqual(response.status_code, 200, response.data)
        create_provider.assert_any_call(ProviderName.ZERNIO)
        request = get_url.call_args.args[0]
        self.assertEqual(request.requested_networks, (PublishingNetwork.INSTAGRAM,))
        self.assertEqual(
            request.redirect_uri,
            "https://content-studio-5m7.pages.dev/content/connections",
        )

    @patch("integrations.social.services.onboarding.publishing_provider_registry.create")
    def test_untrusted_origin_does_not_override_configured_return(self, create_provider):
        create_provider.return_value = self.fake
        with patch.object(self.fake, "get_connection_url", wraps=self.fake.get_connection_url) as get_url:
            response = self.client.post(
                reverse("content-studio-connection-start"), {},
                content_type="application/json", HTTP_ORIGIN="https://untrusted.example",
            )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(get_url.call_args.args[0].redirect_uri, "")

    @override_settings(CONTENT_STUDIO_FRONTEND_ORIGINS=["http://localhost:5173"])
    @patch("integrations.social.services.onboarding.publishing_provider_registry.create")
    def test_legacy_placeholder_reconnect_starts_selected_provider(self, create_provider):
        create_provider.return_value = self.fake
        placeholder = SocialConnection.objects.create(
            workspace=self.workspace, network=SocialNetwork.LINKEDIN,
            provider=SocialProvider.MANUAL, display_name="Your business",
            status=ConnectionState.DISCONNECTED,
        )
        listed = self.client.get(reverse("social-connections"))
        self.assertEqual(listed.status_code, 200)
        self.assertEqual(listed.data, [])
        with patch.object(self.fake, "get_connection_url", wraps=self.fake.get_connection_url) as get_url:
            response = self.client.post(
                reverse("social-connection-action", args=[placeholder.id]),
                {"action": "RECONNECT"}, content_type="application/json",
                HTTP_ORIGIN="http://localhost:5173",
            )
        self.assertEqual(response.status_code, 200)
        self.assertIn("authorization_url", response.data)
        self.assertEqual(get_url.call_args.args[0].redirect_uri, "http://localhost:5173/content/connections")
        placeholder.refresh_from_db()
        self.assertEqual(placeholder.status, ConnectionState.DISCONNECTED)

    def test_business_profile_can_be_saved_or_skipped_without_advancing_wizard(self):
        initial = self.client.get(reverse("content-studio-onboarding"))
        self.assertFalse(initial.data["business_profile_configured"])

        skipped = self.client.post(
            reverse("content-studio-business-profile"),
            {"skip": True},
            content_type="application/json",
        )
        self.assertEqual(skipped.status_code, 200, skipped.data)
        self.assertTrue(skipped.data["business_prompt_skipped"])
        self.assertEqual(skipped.data["current_step"], initial.data["current_step"])

        saved = self.client.post(
            reverse("content-studio-business-profile"),
            {"name": "Second Brand", "description": "Workflow software", "audience": "Operations teams", "language": "English"},
            content_type="application/json",
        )
        self.assertEqual(saved.status_code, 200, saved.data)
        self.assertTrue(saved.data["business_profile_configured"])
        self.assertFalse(saved.data["business_prompt_skipped"])
        self.assertEqual(saved.data["business"]["name"], "Second Brand")
        brand = BrandProfile.objects.get(settings__workspace=self.workspace)
        self.assertEqual(brand.business_description, "Workflow software")
        self.assertEqual(brand.audience, "Operations teams")

    @override_settings(SOCIAL_PUBLISHER_DEFAULT="ZERNIO")
    @patch("integrations.social.services.onboarding.publishing_provider_registry.create")
    def test_old_provider_connection_does_not_hide_zernio_connect(self, create_provider):
        create_provider.return_value = self.fake
        SocialConnection.objects.create(
            workspace=self.workspace, network=SocialNetwork.LINKEDIN,
            provider=SocialProvider.UPLOAD_POST, provider_account_id="upload-page",
            display_name="Old Upload-Post Page", status=ConnectionState.CONNECTED,
        )
        response = self.client.get(reverse("content-studio-onboarding"))
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data["connection"]["connected"])
        self.assertTrue(next(item for item in response.data["networks"] if item["network"] == "LINKEDIN")["enabled"])

    @override_settings(SOCIAL_PUBLISHER_DEFAULT="ZERNIO")
    @patch("integrations.social.services.onboarding.publishing_provider_registry.create")
    def test_zernio_reconnect_uses_state_tracked_custom_selection(self, create_provider):
        create_provider.return_value = self.fake
        connection = SocialConnection.objects.create(
            workspace=self.workspace, network=SocialNetwork.LINKEDIN,
            provider=SocialProvider.ZERNIO, provider_profile_id="profile-1",
            provider_account_id="page-1", display_name="LumaDesk Company Page",
            status=ConnectionState.DISCONNECTED,
        )
        response = self.client.post(
            reverse("social-connection-action", args=[connection.id]),
            {"action": "RECONNECT"}, content_type="application/json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        onboarding = ContentStudioOnboarding.objects.get(workspace=self.workspace)
        self.assertTrue(onboarding.connection_state)
        self.assertEqual(onboarding.connection_provider, SocialProvider.ZERNIO)
        self.assertTrue(onboarding.answers["pending_selection_required"])

    @patch("integrations.social.services.onboarding.publishing_provider_registry.create")
    def test_provider_rejection_explains_return_url_configuration(self, create_provider):
        create_provider.return_value = self.fake
        with patch.object(
            self.fake, "get_connection_url",
            side_effect=ProviderValidationError("Upstream rejected callback"),
        ):
            response = self.client.post(
                reverse("content-studio-connection-start"), {},
                content_type="application/json",
            )
        self.assertEqual(response.status_code, 400)
        self.assertIn("return URL", str(response.data))
        self.assertNotIn("Upstream rejected callback", str(response.data))

    @patch("integrations.social.services.onboarding.publishing_provider_registry.create")
    def test_profile_limit_explains_required_account_capacity(self, create_provider):
        create_provider.return_value = self.fake
        with patch.object(
            self.fake, "get_connection_url",
            side_effect=ProviderPermanentFailureError(
                "Provider quota reached",
                safe_details={"status_code": 403, "error_code": "PROFILE_LIMIT_REACHED"},
            ),
        ):
            response = self.client.post(
                reverse("content-studio-connection-start"), {},
                content_type="application/json",
            )
        self.assertEqual(response.status_code, 400)
        self.assertIn("account limit", str(response.data))
        self.assertNotIn("Provider quota reached", str(response.data))

    @patch("integrations.social.services.onboarding.publishing_provider_registry.create")
    def test_connection_cancellation_is_resumable(self, create_provider):
        create_provider.return_value = self.fake
        self.client.post(reverse("content-studio-connection-start"), {}, content_type="application/json")
        cancelled = self.client.post(reverse("content-studio-connection-cancel"), {}, content_type="application/json")
        self.assertEqual(cancelled.status_code, 200)
        self.assertIn("cancelled", cancelled.data["connection"]["message"].lower())
        self.assertEqual(cancelled.data["current_step"], 1)

    @patch("integrations.social.services.onboarding.publishing_provider_registry.create")
    def test_expired_connection_shows_reconnect_explanation(self, create_provider):
        create_provider.return_value = self.fake
        started = self.client.post(reverse("content-studio-connection-start"), {}, content_type="application/json")
        onboarding = ContentStudioOnboarding.objects.get(workspace=self.workspace)
        state = self.connection_state(started)
        onboarding.connection_expires_at = timezone.now() - timedelta(seconds=1)
        onboarding.save(update_fields=["connection_expires_at"])
        failed = self.client.post(reverse("content-studio-connection-complete"), {
            "state": state, "code": "late-code",
        }, content_type="application/json")
        self.assertEqual(failed.status_code, 400)
        refreshed = self.client.get(reverse("content-studio-onboarding"))
        self.assertIn("Reconnect", refreshed.data["connection"]["message"])

    @patch("integrations.social.services.onboarding.publishing_provider_registry.create")
    def test_reconnect_replaces_unhealthy_state_with_connected_account(self, create_provider):
        create_provider.return_value = self.fake
        SocialConnection.objects.create(
            workspace=self.workspace,
            network=SocialNetwork.LINKEDIN,
            provider=SocialProvider.UPLOAD_POST,
            provider_profile_id="old-profile",
            provider_account_id="old-page",
            display_name="Expired Page",
            status=ConnectionState.REVOKED,
        )
        before = self.client.get(reverse("content-studio-onboarding"))
        self.assertEqual(before.data["connection"]["health"], "NEEDS_ATTENTION")
        started = self.client.post(reverse("content-studio-connection-start"), {}, content_type="application/json")
        state = self.connection_state(started)
        completed = self.client.post(reverse("content-studio-connection-complete"), {
            "state": state, "code": "new-code",
        }, content_type="application/json")
        self.assertEqual(completed.data["connection"]["health"], "HEALTHY")
        self.assertEqual(completed.data["connection"]["display_name"], "LumaDesk Company Page")

    def test_schedule_can_be_saved_without_choosing_topics(self):
        legacy = LinkedInAutomationSettings.objects.create(
            workspace=self.workspace,
            content_pillars=["Existing brand theme"],
        )
        response = self.client.post(reverse("content-studio-onboarding-step", args=[3]), {
            "posting_days": [0, 2, 4],
            "time": "10:00",
            "timezone": "Asia/Kolkata",
        }, content_type="application/json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["schedule"]["posting_days"], [0, 2, 4])
        self.assertEqual(response.data["schedule"]["topics"], ["Existing brand theme"])
        legacy.refresh_from_db()
        self.assertEqual(legacy.content_pillars, ["Existing brand theme"])

    def test_finishing_with_first_workspace_post_completes_checklist(self):
        settings = LinkedInAutomationSettings.objects.create(workspace=self.workspace)
        post = LinkedInPost.objects.create(
            settings=settings,
            topic="First post",
            body="First draft",
            scheduled_for=timezone.now(),
        )
        response = self.client.post(reverse("content-studio-onboarding-step", args=[4]), {
            "post_id": str(post.id),
        }, content_type="application/json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], "COMPLETE")
        self.assertEqual(response.data["first_post_id"], str(post.id))

    @override_settings(CONTENT_STUDIO_DRAFT_ONLY_ALLOWED=False)
    def test_skip_is_hidden_and_rejected_when_draft_only_mode_is_disabled(self):
        response = self.client.get(reverse("content-studio-onboarding"))
        self.assertFalse(response.data["can_skip_connection"])
        skipped = self.client.post(reverse("content-studio-onboarding-step", args=[1]), {"skip": True}, content_type="application/json")
        self.assertEqual(skipped.status_code, 400)

    def test_onboarding_is_workspace_isolated(self):
        other = Workspace.objects.create(name="Other workspace")
        response = self.client.get(reverse("content-studio-onboarding"), HTTP_X_WORKSPACE_ID=str(other.id))
        self.assertEqual(response.status_code, 403)

    @override_settings(CONTENT_AUTOMATION_DEV_BOOTSTRAP=False)
    def test_onboarding_requires_authentication(self):
        self.client.logout()
        response = self.client.get(reverse("content-studio-onboarding"))
        self.assertEqual(response.status_code, 401)

import json

from django.test import Client, TestCase, override_settings
from django.urls import reverse

from integrations.social.models import ConnectionState, SocialConnection, SocialNetwork, SocialPost, SocialProvider
from prospecting.models import WorkspaceMembership


@override_settings(CONTENT_AUTOMATION_DEV_BOOTSTRAP=False)
class ContentStudioAuthenticationTests(TestCase):
    def setUp(self):
        self.client = Client(enforce_csrf_checks=True)

    def post(self, name, payload):
        self.client.get(reverse("studio-auth-session"))
        token = self.client.cookies["csrftoken"].value
        return self.client.post(
            reverse(name), data=json.dumps(payload), content_type="application/json",
            HTTP_X_CSRFTOKEN=token,
        )

    def signup(self, name, email, workspace):
        response = self.post("studio-auth-signup", {
            "name": name, "email": email, "password": "AnEvenStrongerPassword42!",
            "workspace_name": workspace,
        })
        self.assertEqual(response.status_code, 201, response.content)
        return response.json()

    def test_signup_creates_private_workspace_and_persists_login(self):
        session = self.signup("Alex Morgan", "ALEX@example.com", "Alex Studio")
        self.assertTrue(session["authenticated"])
        self.assertTrue(session["csrf_token"])
        self.assertEqual(session["user"]["email"], "alex@example.com")
        self.assertEqual(session["workspace"]["name"], "Alex Studio")
        membership = WorkspaceMembership.objects.get(user__email="alex@example.com")
        self.assertEqual(membership.role, WorkspaceMembership.OWNER)
        self.assertTrue(membership.is_active)
        refreshed = self.client.get(reverse("studio-auth-session"))
        self.assertEqual(refreshed.json()["workspace"]["id"], session["workspace"]["id"])
        self.assertEqual(self.client.get(reverse("social-connections")).status_code, 200)

    def test_signin_signout_and_invalid_password(self):
        self.signup("Alex Morgan", "alex@example.com", "Alex Studio")
        self.assertEqual(self.post("studio-auth-signout", {}).status_code, 200)
        self.assertFalse(self.client.get(reverse("studio-auth-session")).json()["authenticated"])
        self.assertIn(self.client.get(reverse("social-connections")).status_code, (401, 403))
        bad = self.post("studio-auth-signin", {"email": "alex@example.com", "password": "wrong"})
        self.assertEqual(bad.status_code, 401)
        self.assertEqual(self.post("studio-auth-signin", {
            "email": "alex@example.com", "password": "AnEvenStrongerPassword42!",
        }).status_code, 200)
        self.assertTrue(self.client.get(reverse("studio-auth-session")).json()["authenticated"])

    def test_signup_and_signin_require_csrf(self):
        self.client.get(reverse("studio-auth-session"))
        response = self.client.post(reverse("studio-auth-signup"), data=json.dumps({
            "name": "Alex", "email": "alex@example.com", "password": "AnEvenStrongerPassword42!",
        }), content_type="application/json")
        self.assertEqual(response.status_code, 403)
        response = self.client.post(reverse("studio-auth-signin"), data="{}", content_type="application/json")
        self.assertEqual(response.status_code, 403)

    def test_content_and_connections_follow_signed_in_user(self):
        first = self.signup("Alex Morgan", "alex@example.com", "Alex Studio")
        first_workspace_id = first["workspace"]["id"]
        first_connection = SocialConnection.objects.create(
            workspace_id=first_workspace_id, network=SocialNetwork.LINKEDIN,
            provider=SocialProvider.UPLOAD_POST, display_name="Alex LinkedIn",
            provider_profile_id="alex-profile", provider_account_id="alex-account", status=ConnectionState.CONNECTED,
        )
        first_post = SocialPost.objects.create(workspace_id=first_workspace_id, idea_title="Alex private draft")
        self.post("studio-auth-signout", {})
        second = self.signup("Sam Taylor", "sam@example.com", "Sam Studio")
        second_workspace_id = second["workspace"]["id"]
        SocialConnection.objects.create(
            workspace_id=second_workspace_id, network=SocialNetwork.X,
            provider=SocialProvider.UPLOAD_POST, display_name="Sam X",
            provider_profile_id="sam-profile", provider_account_id="sam-account", status=ConnectionState.CONNECTED,
        )
        SocialPost.objects.create(workspace_id=second_workspace_id, idea_title="Sam private draft")
        self.assertEqual(
            self.client.get(reverse("social-connections"), HTTP_X_WORKSPACE_ID=first_workspace_id).status_code,
            403,
        )
        connections = self.client.get(reverse("social-connections"))
        self.assertEqual(connections.status_code, 200)
        names = [item["display_name"] for item in connections.json()]
        self.assertIn("Sam X", names)
        self.assertNotIn("Alex LinkedIn", names)
        library = self.client.get(reverse("social-library"))
        self.assertEqual(library.status_code, 200)
        self.assertIn("Sam private draft", library.content.decode())
        self.assertNotIn("Alex private draft", library.content.decode())
        self.assertEqual(self.client.get(reverse("social-post-detail", args=[first_post.pk])).status_code, 404)
        self.assertEqual(self.client.post(
            reverse("social-connection-action", args=[first_connection.pk]),
            data=json.dumps({"action": "DISCONNECT"}), content_type="application/json",
            HTTP_X_CSRFTOKEN=self.client.cookies["csrftoken"].value,
        ).status_code, 404)
        self.assertEqual(self.client.get(reverse("studio-auth-session")).json()["workspace"]["id"], second_workspace_id)

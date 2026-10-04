from unittest.mock import patch

from django.core import mail
from django.test import TestCase, override_settings
from rest_framework.test import APIClient


@override_settings(
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
    DEFAULT_FROM_EMAIL="Quilltap <noreply@visiofy.example>",
    SUPPORT_EMAIL="visiofytech@gmail.com",
    RESEND_API_KEY="",
    RESEND_FROM_EMAIL="Quilltap Support <support@mail.quilltap.com>",
    CACHES={"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}},
)
class SupportRequestAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.payload = {
            "name": "Alex Morgan",
            "email": "alex@example.com",
            "category": "Technical Support",
            "message": "The publishing screen is not loading.",
        }

    def test_anonymous_request_sends_email_to_support(self):
        response = self.client.post("/api/v3/social/support/", self.payload, format="json")

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["detail"], "Your message was sent successfully.")
        self.assertEqual(len(mail.outbox), 1)
        message = mail.outbox[0]
        self.assertEqual(message.to, ["visiofytech@gmail.com"])
        self.assertEqual(message.reply_to, ["alex@example.com"])
        self.assertIn("Technical Support from Alex Morgan", message.subject)
        self.assertIn("The publishing screen is not loading.", message.body)

    @override_settings(RESEND_API_KEY="re_test_key")
    @patch("integrations.social.support_views.requests.post")
    def test_resend_delivery_uses_https_api(self, post):
        response = self.client.post(
            "/api/v3/social/support/",
            self.payload,
            format="json",
            REMOTE_ADDR="198.51.100.10",
        )

        self.assertEqual(response.status_code, 201)
        post.assert_called_once()
        request = post.call_args
        self.assertEqual(request.args, ("https://api.resend.com/emails",))
        self.assertEqual(request.kwargs["headers"]["Authorization"], "Bearer re_test_key")
        self.assertEqual(request.kwargs["json"]["from"], "Quilltap Support <support@mail.quilltap.com>")
        self.assertEqual(request.kwargs["json"]["to"], ["visiofytech@gmail.com"])
        self.assertEqual(request.kwargs["json"]["reply_to"], "alex@example.com")
        self.assertIn("Technical Support from Alex Morgan", request.kwargs["json"]["subject"])
        self.assertIn("The publishing screen is not loading.", request.kwargs["json"]["text"])
        self.assertEqual(request.kwargs["timeout"], 10)
        post.return_value.raise_for_status.assert_called_once_with()
        self.assertEqual(len(mail.outbox), 0)

    @override_settings(RESEND_API_KEY="re_test_key")
    @patch("integrations.social.support_views.requests.post", side_effect=OSError("HTTPS delivery unavailable"))
    def test_resend_delivery_failure_returns_actionable_error(self, _post):
        response = self.client.post(
            "/api/v3/social/support/",
            self.payload,
            format="json",
            REMOTE_ADDR="198.51.100.11",
        )

        self.assertEqual(response.status_code, 503)
        self.assertIn("contact Quilltap support directly", response.data["detail"])

    def test_invalid_request_returns_field_errors_without_sending(self):
        payload = {**self.payload, "email": "not-an-email", "message": ""}
        response = self.client.post(
            "/api/v3/social/support/",
            payload,
            format="json",
            REMOTE_ADDR="198.51.100.20",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("email", response.data)
        self.assertIn("message", response.data)
        self.assertEqual(len(mail.outbox), 0)

    @patch("integrations.social.support_views.EmailMessage.send", side_effect=OSError("SMTP unavailable"))
    def test_delivery_failure_returns_actionable_error(self, _send):
        response = self.client.post(
            "/api/v3/social/support/",
            self.payload,
            format="json",
            REMOTE_ADDR="198.51.100.30",
        )

        self.assertEqual(response.status_code, 503)
        self.assertIn("contact Quilltap support directly", response.data["detail"])

    def test_repeated_requests_are_rate_limited(self):
        for index in range(5):
            response = self.client.post(
                "/api/v3/social/support/",
                {**self.payload, "message": f"Support question {index}"},
                format="json",
                REMOTE_ADDR="198.51.100.40",
            )
            self.assertEqual(response.status_code, 201)

        response = self.client.post(
            "/api/v3/social/support/",
            self.payload,
            format="json",
            REMOTE_ADDR="198.51.100.40",
        )
        self.assertEqual(response.status_code, 429)

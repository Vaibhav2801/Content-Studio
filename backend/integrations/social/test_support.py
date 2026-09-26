from unittest.mock import patch

from django.core import mail
from django.test import TestCase, override_settings
from rest_framework.test import APIClient


@override_settings(
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
    DEFAULT_FROM_EMAIL="Visiofy Studio <noreply@visiofy.example>",
    SUPPORT_EMAIL="visiofytech@gmail.com",
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
        self.assertIn("visiofytech@gmail.com", response.data["detail"])

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

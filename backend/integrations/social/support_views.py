import logging

import requests
from django.conf import settings
from django.core.mail import EmailMessage
from rest_framework import serializers, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import SimpleRateThrottle
from rest_framework.views import APIView


logger = logging.getLogger(__name__)

SUPPORT_CATEGORIES = (
    "General Question",
    "Features & Capabilities",
    "Social Account Connections",
    "Custom Plan / Billing",
    "Technical Support",
)


class SupportRequestSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=120, trim_whitespace=True)
    email = serializers.EmailField(max_length=254)
    category = serializers.ChoiceField(choices=SUPPORT_CATEGORIES)
    message = serializers.CharField(max_length=5000, trim_whitespace=True)

    def validate_name(self, value):
        if not value:
            raise serializers.ValidationError("Enter your name.")
        return value

    def validate_message(self, value):
        if not value:
            raise serializers.ValidationError("Enter your question or message.")
        return value


class SupportRequestThrottle(SimpleRateThrottle):
    scope = "support_request"
    rate = "5/hour"

    def get_cache_key(self, request, view):
        return self.cache_format % {"scope": self.scope, "ident": self.get_ident(request)}


def _single_line(value):
    return " ".join(value.splitlines()).strip()


def _send_support_email(*, subject, body, reply_to, support_email):
    """Deliver over HTTPS on Render Free, with Django email as a fallback."""
    resend_api_key = getattr(settings, "RESEND_API_KEY", "")
    if resend_api_key:
        from_email = getattr(settings, "RESEND_FROM_EMAIL", "")
        if not from_email:
            raise RuntimeError("RESEND_FROM_EMAIL is not configured.")
        response = requests.post(
            "https://api.resend.com/emails",
            headers={
                "Authorization": f"Bearer {resend_api_key}",
                "Content-Type": "application/json",
            },
            json={
                "from": from_email,
                "to": [support_email],
                "subject": subject,
                "text": body,
                "reply_to": reply_to,
            },
            timeout=getattr(settings, "EMAIL_TIMEOUT", 10),
        )
        response.raise_for_status()
        return

    email_backend = getattr(settings, "EMAIL_BACKEND", "")
    email_host = getattr(settings, "EMAIL_HOST", "")
    if email_backend.endswith("smtp.EmailBackend") and not email_host:
        raise RuntimeError("EMAIL_HOST is not configured.")

    email = EmailMessage(
        subject=subject,
        body=body,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[support_email],
        reply_to=[reply_to],
    )
    email.send(fail_silently=False)


class SupportRequestAPIView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = [SupportRequestThrottle]

    def post(self, request):
        serializer = SupportRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        support_email = getattr(settings, "SUPPORT_EMAIL", "visiofytech@gmail.com")
        name = _single_line(data["name"])
        category = _single_line(data["category"])
        subject = f"[Quilltap Support] {category} from {name}"
        body = "\n".join(
            (
                f"Name: {name}",
                f"Email: {data['email']}",
                f"Topic: {category}",
                "",
                "Question / Message:",
                data["message"],
                "",
                "---",
                "Sent from the Quilltap Direct Assistance form.",
            )
        )

        try:
            _send_support_email(
                subject=subject,
                body=body,
                reply_to=data["email"],
                support_email=support_email,
            )
        except Exception:
            logger.exception("Direct Assistance email delivery failed.")
            return Response(
                {"detail": "We couldn't send your message right now. Please try again later or contact Quilltap support directly."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        return Response(
            {"detail": "Your message was sent successfully."},
            status=status.HTTP_201_CREATED,
        )

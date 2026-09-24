from django.urls import path

from .views import PublishingProviderHealthAPIView, PublishingProviderWebhookAPIView
from .engagement_views import ZernioEngagementWebhookAPIView
from .billing_views import BillingPaymentWebhookAPIView


urlpatterns = [
    path("billing/webhook/", BillingPaymentWebhookAPIView.as_view(), name="social-billing-webhook"),
    path("publishers/health/", PublishingProviderHealthAPIView.as_view(), name="social-publisher-health"),
    path(
        "publishers/<str:provider>/webhook/",
        PublishingProviderWebhookAPIView.as_view(),
        name="social-publisher-webhook",
    ),
    path(
        "engagement/zernio/webhook/",
        ZernioEngagementWebhookAPIView.as_view(),
        name="social-engagement-webhook",
    ),
]

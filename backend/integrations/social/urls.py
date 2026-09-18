from django.urls import path

from .views import PublishingProviderHealthAPIView, PublishingProviderWebhookAPIView
from .engagement_views import ZernioEngagementWebhookAPIView


urlpatterns = [
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

from django.contrib import admin
from .auth_views import session_view, signup_view, signin_view, signout_view
from django.urls import path, include
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings
from django.conf.urls.static import static

def health_check_view(request):
    return JsonResponse({"status": "ok", "service": "django-web-health"})

@csrf_exempt
def wake_view(request):
    return JsonResponse({"status": "ok", "service": "django-web-wake", "message": "Service awakened successfully"})

urlpatterns = [
    path('health', health_check_view, name='health-check-short'),
    path('health/', health_check_view, name='health-check'),
    path('wake', wake_view, name='wake-short'),
    path('wake/', wake_view, name='wake'),

    path('admin/', admin.site.urls),
    
    # OpenAPI Schema & API Documentation
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/schema/swagger-ui/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/schema/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),

    # Session authentication for the Content Studio frontend
    path('api/v3/auth/session/', session_view, name='studio-auth-session'),
    path('api/v3/auth/signup/', signup_view, name='studio-auth-signup'),
    path('api/v3/auth/signin/', signin_view, name='studio-auth-signin'),
    path('api/v3/auth/signout/', signout_view, name='studio-auth-signout'),

    # Content Studio APIs
    path('api/v3/linkedin/', include('integrations.linkedin.urls')),
    path('api/v3/social/', include('integrations.social.public_urls')),
    path('api/internal/social/', include('integrations.social.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)




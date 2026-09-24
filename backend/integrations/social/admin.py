from django import forms
from django.contrib import admin
from unfold.admin import ModelAdmin

from .models import (
    BrandProfile,
    BrandProfileVersion,
    AnalyticsSuggestion,
    ContentStudioOnboarding,
    ContentSource,
    MediaAsset,
    ProviderEvent,
    SocialMetricObservation,
    PublishAttempt,
    PublishJob,
    SocialConnection,
    SocialAuditEvent,
    SocialPost,
    SocialPostVariant,
    SocialPostVersion,
    SocialWorkspaceSettings,
    StoryInterview,
    VoiceRuleSuggestion,
)
from .services.publishing_routing import provider_readiness, selected_provider


PUBLISHER_CHOICES = (
    ("UPLOAD_POST", "Upload Post"),
    ("ZERNIO", "Zernio"),
)


@admin.register(ContentStudioOnboarding)
class ContentStudioOnboardingAdmin(ModelAdmin):
    list_display = ("workspace", "current_step", "draft_only_mode", "started_at", "completed_at", "updated_at")
    readonly_fields = (
        "workspace", "current_step", "completed_steps", "answers", "draft_only_mode",
        "connection_provider", "connection_expires_at", "connection_error",
        "started_at", "completed_at", "created_at", "updated_at",
    )
    exclude = ("connection_state",)
    search_fields = ("workspace__name",)
    list_filter = ("draft_only_mode", "completed_at", "current_step")
    list_select_related = ("workspace",)

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


class SocialWorkspaceSettingsAdminForm(forms.ModelForm):
    disabled_publishing_providers = forms.MultipleChoiceField(
        choices=PUBLISHER_CHOICES,
        required=False,
        widget=forms.CheckboxSelectMultiple,
        help_text="Disabled providers cannot receive new connections or publish jobs.",
    )

    class Meta:
        model = SocialWorkspaceSettings
        fields = "__all__"


@admin.register(SocialWorkspaceSettings)
class SocialWorkspaceSettingsAdmin(ModelAdmin):
    form = SocialWorkspaceSettingsAdminForm
    list_display = (
        "brand_name",
        "workspace",
        "effective_publisher",
        "provider_readiness_summary",
        "approval_mode",
        "is_active",
        "updated_at",
    )
    readonly_fields = ("effective_publisher", "provider_readiness_summary")
    search_fields = ("brand_name", "workspace__name")
    list_filter = ("approval_mode", "is_active", "publishing_provider_override")
    autocomplete_fields = ("workspace",)
    list_select_related = ("workspace",)

    @admin.display(description="Effective publisher")
    def effective_publisher(self, obj):
        return selected_provider(obj.workspace).value if obj and obj.workspace_id else "-"

    @admin.display(description="Provider readiness")
    def provider_readiness_summary(self, obj):
        if not obj or not obj.workspace_id:
            return "Save the workspace settings to view readiness."
        return "; ".join(
            f"{row.provider.value}: "
            f"{'disabled' if not row.enabled else 'ready' if row.configured and row.healthy else 'not ready'}"
            for row in provider_readiness(obj.workspace)
        )

    def get_readonly_fields(self, request, obj=None):
        fields = list(super().get_readonly_fields(request, obj))
        if not (
            request.user.is_superuser
            or obj and obj.workspace.memberships.filter(
                user=request.user,
                is_active=True,
                role__in=["OWNER", "ADMIN"],
            ).exists()
        ):
            fields.extend(["publishing_provider_override", "disabled_publishing_providers"])
        return tuple(fields)


@admin.register(BrandProfile)
class BrandProfileAdmin(ModelAdmin):
    list_display = ("business_name", "workspace_name", "audience_summary", "voice", "updated_at")
    search_fields = ("settings__brand_name", "settings__workspace__name", "audience", "business_description", "voice")
    autocomplete_fields = ("settings",)
    list_select_related = ("settings", "settings__workspace")

    @admin.display(description="Business", ordering="settings__brand_name")
    def business_name(self, obj):
        return obj.settings.brand_name

    @admin.display(description="Workspace", ordering="settings__workspace__name")
    def workspace_name(self, obj):
        return obj.settings.workspace.name

    @admin.display(description="Audience")
    def audience_summary(self, obj):
        return obj.audience[:80] or "Not configured"


@admin.register(ContentSource)
class ContentSourceAdmin(ModelAdmin):
    list_display = ("label", "workspace", "owner", "source_type", "processing_status", "is_reusable", "is_active", "updated_at")
    list_filter = ("source_type", "processing_status", "is_reusable", "is_active")
    search_fields = ("label", "workspace__name", "owner__email")
    autocomplete_fields = ("workspace", "owner")
    list_select_related = ("workspace", "owner")


@admin.register(BrandProfileVersion)
class BrandProfileVersionAdmin(ModelAdmin):
    list_display = ("brand_profile", "version", "created_by", "created_at")
    search_fields = ("brand_profile__settings__brand_name", "brand_profile__settings__workspace__name")
    readonly_fields = ("brand_profile", "version", "snapshot", "created_by", "created_at")

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(VoiceRuleSuggestion)
class VoiceRuleSuggestionAdmin(ModelAdmin):
    list_display = ("suggested_rule", "brand_profile", "evidence_count", "status", "updated_at")
    list_filter = ("status",)
    readonly_fields = ("brand_profile", "signal_key", "suggested_rule", "evidence_count", "evidence", "status", "confirmed_by", "confirmed_at", "created_at", "updated_at")


@admin.register(StoryInterview)
class StoryInterviewAdmin(ModelAdmin):
    list_display = ("workspace", "week_of", "owner", "status", "approved_at")
    list_filter = ("status", "week_of")


@admin.register(SocialConnection)
class SocialConnectionAdmin(ModelAdmin):
    list_display = ("display_name", "workspace", "network", "provider", "status", "updated_at")
    list_filter = ("network", "provider", "status")
    search_fields = ("display_name", "provider_account_id", "provider_profile_id", "workspace__name")
    autocomplete_fields = ("workspace",)
    list_select_related = ("workspace",)
    readonly_fields = ("connected_at", "disconnected_at", "created_at", "updated_at")


@admin.register(SocialPost)
class SocialPostAdmin(ModelAdmin):
    list_display = ("idea_title", "workspace", "state", "created_at")
    list_filter = ("state",)
    search_fields = ("idea_title", "idea_text", "workspace__name")
    autocomplete_fields = ("workspace", "source", "brand_profile_version")
    list_select_related = ("workspace",)


@admin.register(SocialPostVariant)
class SocialPostVariantAdmin(ModelAdmin):
    list_display = ("post", "network", "status", "scheduled_for")
    list_filter = ("network", "status")


@admin.register(SocialPostVersion)
class SocialPostVersionAdmin(ModelAdmin):
    list_display = ("variant", "version", "approved_at", "created_at")


@admin.register(MediaAsset)
class MediaAssetAdmin(ModelAdmin):
    list_display = ("post", "workspace", "asset_type", "sort_order", "updated_at")
    list_filter = ("asset_type",)


@admin.register(PublishJob)
class PublishJobAdmin(ModelAdmin):
    list_display = (
        "variant", "provider", "status", "scheduled_for", "attempt_count", "external_id", "updated_at",
    )
    list_filter = ("provider", "status")


@admin.register(PublishAttempt)
class PublishAttemptAdmin(ModelAdmin):
    list_display = ("job", "attempt_number", "status", "external_id", "started_at", "completed_at")
    list_filter = ("status",)


@admin.register(ProviderEvent)
class ProviderEventAdmin(ModelAdmin):
    list_display = ("event_type", "workspace", "provider", "normalized_status", "received_at")
    list_filter = ("provider", "normalized_status")


@admin.register(SocialMetricObservation)
class SocialMetricObservationAdmin(ModelAdmin):
    list_display = ("metric_name", "value", "workspace", "provider", "measured_at")
    list_filter = ("metric_name", "provider")
    readonly_fields = tuple(field.name for field in SocialMetricObservation._meta.fields)


@admin.register(AnalyticsSuggestion)
class AnalyticsSuggestionAdmin(ModelAdmin):
    list_display = ("segment", "dimension", "workspace", "status", "created_at")
    list_filter = ("dimension", "status")
    readonly_fields = ("fingerprint", "evidence", "decided_by", "decided_at", "applied_brand_version")


@admin.register(SocialAuditEvent)
class SocialAuditEventAdmin(ModelAdmin):
    list_display = ("event_type", "workspace", "actor", "target_type", "target_id", "created_at")
    list_filter = ("event_type", "created_at")
    readonly_fields = tuple(field.name for field in SocialAuditEvent._meta.fields)

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

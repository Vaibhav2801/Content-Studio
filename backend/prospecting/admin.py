from django.contrib import admin
from django.db.models import Count
from unfold.admin import ModelAdmin

from integrations.social.models import ContentStudioOnboarding, SocialWorkspaceSettings
from .models import Workspace, WorkspaceMembership


class WorkspaceMembershipInline(admin.TabularInline):
    model = WorkspaceMembership
    extra = 0
    fields = ("user", "role", "is_active", "created_at")
    readonly_fields = ("created_at",)
    autocomplete_fields = ("user",)


class SocialWorkspaceSettingsInline(admin.StackedInline):
    model = SocialWorkspaceSettings
    extra = 0
    max_num = 1
    can_delete = False
    fields = (
        "brand_name", "language", "timezone", "approval_mode", "schedule_days",
        "post_time", "posts_per_week", "is_active", "publishing_provider_override",
    )


class ContentStudioOnboardingInline(admin.StackedInline):
    model = ContentStudioOnboarding
    extra = 0
    max_num = 1
    can_delete = False
    fields = ("current_step", "completed_steps", "draft_only_mode", "started_at", "completed_at", "updated_at")
    readonly_fields = fields


@admin.register(Workspace)
class WorkspaceAdmin(ModelAdmin):
    list_display = ("name", "business_profile", "member_count", "connection_count", "post_count", "timezone", "updated_at")
    search_fields = ("name", "social_content_settings__brand_name", "memberships__user__email")
    list_filter = ("timezone", "created_at")
    readonly_fields = ("created_at", "updated_at")
    inlines = (WorkspaceMembershipInline, SocialWorkspaceSettingsInline, ContentStudioOnboardingInline)

    def get_queryset(self, request):
        return super().get_queryset(request).select_related("social_content_settings").annotate(
            _member_count=Count("memberships", distinct=True),
            _connection_count=Count("social_connections", distinct=True),
            _post_count=Count("social_posts", distinct=True),
        )

    @admin.display(description="Business", ordering="social_content_settings__brand_name")
    def business_profile(self, obj):
        settings = getattr(obj, "social_content_settings", None)
        return settings.brand_name if settings else "Not configured"

    @admin.display(description="Members", ordering="_member_count")
    def member_count(self, obj):
        return obj._member_count

    @admin.display(description="Connections", ordering="_connection_count")
    def connection_count(self, obj):
        return obj._connection_count

    @admin.display(description="Posts", ordering="_post_count")
    def post_count(self, obj):
        return obj._post_count


@admin.register(WorkspaceMembership)
class WorkspaceMembershipAdmin(ModelAdmin):
    list_display = ('user', 'workspace', 'role', 'is_active', 'updated_at')
    list_filter = ('role', 'is_active')
    search_fields = ('user__username', 'user__email', 'workspace__name')
    autocomplete_fields = ("user", "workspace")
    list_select_related = ("user", "workspace")
    readonly_fields = ("created_at", "updated_at")

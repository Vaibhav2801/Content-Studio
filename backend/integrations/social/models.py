import datetime
import re
import uuid

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from prospecting.models import Workspace


class SocialNetwork(models.TextChoices):
    LINKEDIN = "LINKEDIN", "LinkedIn"
    X = "X", "X"
    INSTAGRAM = "INSTAGRAM", "Instagram"


class SocialProvider(models.TextChoices):
    MANUAL = "MANUAL", "Manual"
    BUFFER = "BUFFER", "Buffer (legacy)"
    N8N = "N8N", "n8n (legacy)"
    WEBHOOK = "WEBHOOK", "Webhook (legacy)"
    UPLOAD_POST = "UPLOAD_POST", "Upload Post"
    ZERNIO = "ZERNIO", "Zernio"


class ConnectionState(models.TextChoices):
    DISCONNECTED = "DISCONNECTED", "Disconnected"
    CONNECTING = "CONNECTING", "Connecting"
    CONNECTED = "CONNECTED", "Connected"
    ERROR = "ERROR", "Error"
    REVOKED = "REVOKED", "Revoked"


class SocialPostState(models.TextChoices):
    DRAFT = "DRAFT", "Draft"
    NEEDS_REVIEW = "NEEDS_REVIEW", "Needs review"
    APPROVED = "APPROVED", "Approved"
    SCHEDULED = "SCHEDULED", "Scheduled"
    PUBLISHING = "PUBLISHING", "Publishing"
    SUBMITTED = "SUBMITTED", "Submitted"
    PUBLISHED = "PUBLISHED", "Published"
    FAILED = "FAILED", "Failed"
    CANCELLED = "CANCELLED", "Cancelled"
    CONNECTION_REQUIRED = "CONNECTION_REQUIRED", "Connection required"


class PublishJobState(models.TextChoices):
    DRAFT = "DRAFT", "Draft"
    NEEDS_REVIEW = "NEEDS_REVIEW", "Needs review"
    APPROVED = "APPROVED", "Approved"
    SCHEDULED = "SCHEDULED", "Scheduled"
    PUBLISHING = "PUBLISHING", "Publishing"
    SUBMITTED = "SUBMITTED", "Submitted"
    PUBLISHED = "PUBLISHED", "Published"
    FAILED = "FAILED", "Failed"
    CANCELLED = "CANCELLED", "Cancelled"
    CONNECTION_REQUIRED = "CONNECTION_REQUIRED", "Connection required"
    UNKNOWN = "UNKNOWN", "Unknown outcome"


class ApprovalMode(models.TextChoices):
    REQUIRE_APPROVAL = "REQUIRE_APPROVAL", "Require approval"
    AUTO_PUBLISH = "AUTO_PUBLISH", "Publish automatically"


class ContentSourceType(models.TextChoices):
    TEXT = "TEXT", "Text"
    URL = "URL", "URL"
    PDF = "PDF", "PDF"
    DOCUMENT = "DOCUMENT", "Document"
    TRANSCRIPT = "TRANSCRIPT", "Transcript"
    VOICE_NOTE = "VOICE_NOTE", "Voice note"


class ContentSourceProcessingState(models.TextChoices):
    PENDING = "PENDING", "Pending"
    PROCESSING = "PROCESSING", "Processing"
    READY = "READY", "Ready"
    FAILED = "FAILED", "Failed"


class VoiceRuleSuggestionState(models.TextChoices):
    PENDING = "PENDING", "Pending"
    CONFIRMED = "CONFIRMED", "Confirmed"
    DISMISSED = "DISMISSED", "Dismissed"


class StoryInterviewState(models.TextChoices):
    IN_PROGRESS = "IN_PROGRESS", "In progress"
    APPROVED = "APPROVED", "Approved"


class SocialMetricName(models.TextChoices):
    IMPRESSIONS = "IMPRESSIONS", "Impressions"
    VIEWS = "VIEWS", "Views"
    REACTIONS = "REACTIONS", "Reactions"
    LIKES = "LIKES", "Likes"
    COMMENTS = "COMMENTS", "Comments"
    SHARES = "SHARES", "Shares"
    REPOSTS = "REPOSTS", "Reposts"
    CLICKS = "CLICKS", "Clicks"
    FOLLOWER_GROWTH = "FOLLOWER_GROWTH", "Follower growth"


class AnalyticsSuggestionState(models.TextChoices):
    PENDING = "PENDING", "Pending"
    ACCEPTED = "ACCEPTED", "Accepted"
    DISMISSED = "DISMISSED", "Dismissed"


class EngagementItemKind(models.TextChoices):
    COMMENT_REPLY = "COMMENT_REPLY", "Comment reply"
    DIRECT_MESSAGE = "DIRECT_MESSAGE", "Direct message"
    STORY_REPLY = "STORY_REPLY", "Story reply"


class EngagementReviewStatus(models.TextChoices):
    PENDING = "PENDING", "Needs review"
    SENDING = "SENDING", "Sending"
    SENT = "SENT", "Sent"
    DISMISSED = "DISMISSED", "Dismissed"
    FAILED = "FAILED", "Failed"


class EngagementAutomationKind(models.TextChoices):
    COMMENT_TO_DM = "COMMENT_TO_DM", "Comment to DM"
    STORY_REPLY = "STORY_REPLY", "Story reply"
    DM_KEYWORD = "DM_KEYWORD", "DM keyword"
    CLICK_TO_DM = "CLICK_TO_DM", "Click-to-DM"


class EngagementAutomationStatus(models.TextChoices):
    DRAFT = "DRAFT", "Needs approval"
    ACTIVE = "ACTIVE", "Active"
    PAUSED = "PAUSED", "Paused"
    FAILED = "FAILED", "Failed"


class EngagementCampaignStatus(models.TextChoices):
    DRAFT = "DRAFT", "Needs approval"
    APPROVED = "APPROVED", "Approved"
    ACTIVE = "ACTIVE", "Running"
    PAUSED = "PAUSED", "Paused"
    COMPLETED = "COMPLETED", "Completed"
    FAILED = "FAILED", "Failed"


class SocialAuditEventType(models.TextChoices):
    CONNECTION_STARTED = "CONNECTION_STARTED", "Connection started"
    CONNECTION_COMPLETED = "CONNECTION_COMPLETED", "Connection completed"
    CONNECTION_DISCONNECTED = "CONNECTION_DISCONNECTED", "Connection disconnected"
    APPROVAL_GRANTED = "APPROVAL_GRANTED", "Approval granted"
    CHANGES_REQUESTED = "CHANGES_REQUESTED", "Changes requested"
    APPROVAL_REJECTED = "APPROVAL_REJECTED", "Approval rejected"
    SCHEDULE_CHANGED = "SCHEDULE_CHANGED", "Schedule changed"
    PUBLISH_JOB_CREATED = "PUBLISH_JOB_CREATED", "Publish job created"
    PUBLISH_STARTED = "PUBLISH_STARTED", "Publish started"
    PUBLISH_SUBMITTED = "PUBLISH_SUBMITTED", "Publish submitted"
    PUBLISH_COMPLETED = "PUBLISH_COMPLETED", "Publish completed"
    PUBLISH_FAILED = "PUBLISH_FAILED", "Publish failed"
    PUBLISH_CANCELLED = "PUBLISH_CANCELLED", "Publish cancelled"
    PROVIDER_POLICY_CHANGED = "PROVIDER_POLICY_CHANGED", "Provider policy changed"
    DATA_EXPORTED = "DATA_EXPORTED", "Data exported"
    DATA_DELETED = "DATA_DELETED", "Data deleted"


class SocialAccountType(models.TextChoices):
    PERSON = "PERSON", "Person"
    ORGANIZATION = "ORGANIZATION", "Organization"
    CREATOR = "CREATOR", "Creator"
    BUSINESS = "BUSINESS", "Business"


class MediaAssetType(models.TextChoices):
    IMAGE = "IMAGE", "Image"
    MULTI_IMAGE = "MULTI_IMAGE", "Multiple images"
    VIDEO = "VIDEO", "Video"
    DOCUMENT = "DOCUMENT", "Document"


class MediaAssetSource(models.TextChoices):
    UPLOAD = "UPLOAD", "User upload"
    AI = "AI", "AI generated"
    LEGACY = "LEGACY", "Legacy import"


class SocialWorkspaceSettings(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.OneToOneField(
        Workspace,
        on_delete=models.CASCADE,
        related_name="social_content_settings",
    )
    brand_name = models.CharField(max_length=255, default="Your business")
    language = models.CharField(max_length=50, default="English")
    timezone = models.CharField(max_length=100, default="UTC")
    approval_mode = models.CharField(
        max_length=30,
        choices=ApprovalMode.choices,
        default=ApprovalMode.REQUIRE_APPROVAL,
    )
    schedule_days = models.JSONField(default=list, blank=True)
    post_time = models.TimeField(default=datetime.time(10, 0))
    posts_per_week = models.PositiveSmallIntegerField(default=5)
    queue_horizon_days = models.PositiveSmallIntegerField(default=14)
    is_active = models.BooleanField(default=False, db_index=True)
    publishing_provider_override = models.CharField(
        max_length=20,
        choices=(
            (SocialProvider.UPLOAD_POST, "Upload Post"),
            (SocialProvider.ZERNIO, "Zernio"),
        ),
        blank=True,
        default="",
        help_text="Administrator-only override for new connections and publish jobs.",
    )
    disabled_publishing_providers = models.JSONField(
        default=list,
        blank=True,
        help_text="Publishing providers disabled for this workspace.",
    )
    legacy_linkedin_settings_id = models.UUIDField(null=True, blank=True, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.brand_name} social settings"

    def clean(self):
        super().clean()
        supported = {SocialProvider.UPLOAD_POST, SocialProvider.ZERNIO}
        disabled = self.disabled_publishing_providers
        if not isinstance(disabled, list) or any(value not in supported for value in disabled):
            raise ValidationError({
                "disabled_publishing_providers": "Select only supported publishing providers."
            })
        self.disabled_publishing_providers = list(dict.fromkeys(disabled))


class ContentStudioOnboarding(models.Model):
    """Resumable, workspace-scoped first-run progress for Content Studio."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.OneToOneField(
        Workspace,
        on_delete=models.CASCADE,
        related_name="content_studio_onboarding",
    )
    current_step = models.PositiveSmallIntegerField(default=1)
    completed_steps = models.JSONField(default=list, blank=True)
    answers = models.JSONField(default=dict, blank=True)
    draft_only_mode = models.BooleanField(default=False)
    connection_provider = models.CharField(max_length=20, blank=True, default="")
    connection_state = models.CharField(max_length=500, blank=True, default="")
    connection_expires_at = models.DateTimeField(null=True, blank=True)
    connection_error = models.TextField(blank=True, default="")
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Content Studio onboarding"

    def clean(self):
        super().clean()
        if self.current_step not in {1, 2, 3, 4}:
            raise ValidationError({"current_step": "Choose an onboarding step from 1 to 4."})
        if not isinstance(self.completed_steps, list) or any(
            not isinstance(step, int) or step not in {1, 2, 3, 4}
            for step in self.completed_steps
        ):
            raise ValidationError({"completed_steps": "Completed steps must contain step numbers 1 to 4."})
        self.completed_steps = sorted(set(self.completed_steps))


class BrandProfile(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    settings = models.OneToOneField(
        SocialWorkspaceSettings,
        on_delete=models.CASCADE,
        related_name="brand_profile",
    )
    audience = models.TextField(blank=True, default="")
    business_description = models.TextField(blank=True, default="")
    goals = models.JSONField(default=list, blank=True)
    voice = models.CharField(max_length=255, default="Clear, credible and human")
    voice_rules = models.JSONField(default=list, blank=True)
    example_posts = models.JSONField(default=list, blank=True)
    content_pillars = models.JSONField(default=list, blank=True)
    calls_to_action = models.JSONField(default=list, blank=True)
    visual_direction = models.TextField(blank=True, default="")
    forbidden_topics = models.JSONField(default=list, blank=True)
    performance_rules = models.JSONField(
        default=list,
        blank=True,
        help_text="Evidence-backed content rules explicitly accepted by a workspace member.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


class BrandProfileVersion(models.Model):
    """Immutable Brand Brain snapshot used to reproduce generated content."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    brand_profile = models.ForeignKey(BrandProfile, on_delete=models.CASCADE, related_name="versions")
    version = models.PositiveIntegerField()
    snapshot = models.JSONField(default=dict)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="created_brand_profile_versions",
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-version"]
        constraints = [models.UniqueConstraint(fields=["brand_profile", "version"], name="unique_brand_profile_version")]

    def save(self, *args, **kwargs):
        if self.pk and type(self).objects.filter(pk=self.pk).exists():
            raise ValidationError("Brand Brain versions are immutable.")
        return super().save(*args, **kwargs)


class VoiceRuleSuggestion(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    brand_profile = models.ForeignKey(BrandProfile, on_delete=models.CASCADE, related_name="voice_rule_suggestions")
    signal_key = models.CharField(max_length=100)
    suggested_rule = models.CharField(max_length=500)
    evidence_count = models.PositiveSmallIntegerField(default=1)
    evidence = models.JSONField(default=list, blank=True)
    status = models.CharField(max_length=20, choices=VoiceRuleSuggestionState.choices, default=VoiceRuleSuggestionState.PENDING)
    confirmed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="confirmed_voice_rule_suggestions",
        null=True,
        blank=True,
    )
    confirmed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["brand_profile", "signal_key"], name="unique_brand_voice_signal")]


class ContentSource(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="social_content_sources")
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="owned_social_content_sources",
        null=True,
        blank=True,
    )
    source_type = models.CharField(max_length=20, choices=ContentSourceType.choices, default=ContentSourceType.TEXT)
    label = models.CharField(max_length=255, blank=True, default="")
    text_content = models.TextField(blank=True, default="")
    extracted_text = models.TextField(blank=True, default="")
    source_url = models.URLField(max_length=2000, blank=True, default="")
    original_filename = models.CharField(max_length=255, blank=True, default="")
    processing_status = models.CharField(
        max_length=20,
        choices=ContentSourceProcessingState.choices,
        default=ContentSourceProcessingState.PENDING,
        db_index=True,
    )
    processing_error = models.TextField(blank=True, default="")
    metadata = models.JSONField(default=dict, blank=True)
    is_reusable = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True, db_index=True)
    legacy_linkedin_brief_id = models.UUIDField(null=True, blank=True, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["workspace", "source_type", "is_active"], name="social_src_workspace_type_idx")]

    def save(self, *args, **kwargs):
        if self.source_type in {ContentSourceType.TEXT, ContentSourceType.TRANSCRIPT, ContentSourceType.VOICE_NOTE} and self.text_content:
            self.text_content = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", " ", self.text_content).strip()
            self.extracted_text = self.text_content
            self.processing_status = ContentSourceProcessingState.READY
        return super().save(*args, **kwargs)


class SocialConnection(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="social_connections")
    network = models.CharField(max_length=20, choices=SocialNetwork.choices)
    provider = models.CharField(max_length=20, choices=SocialProvider.choices)
    provider_profile_id = models.CharField(max_length=500, blank=True, default="")
    provider_account_id = models.CharField(max_length=500, blank=True, default="")
    display_name = models.CharField(max_length=255)
    account_type = models.CharField(max_length=20, choices=SocialAccountType.choices, default=SocialAccountType.ORGANIZATION)
    status = models.CharField(max_length=20, choices=ConnectionState.choices, default=ConnectionState.DISCONNECTED, db_index=True)
    capabilities = models.JSONField(default=dict, blank=True)
    legacy_linkedin_settings_id = models.UUIDField(null=True, blank=True, unique=True)
    connected_at = models.DateTimeField(null=True, blank=True)
    disconnected_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["workspace", "network", "provider", "provider_account_id"],
                condition=~models.Q(provider_account_id=""),
                name="unique_social_provider_account",
            ),
        ]
        indexes = [models.Index(fields=["workspace", "network", "status"], name="social_conn_workspace_idx")]


class SocialPost(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="social_posts")
    source = models.ForeignKey(ContentSource, on_delete=models.SET_NULL, related_name="posts", null=True, blank=True)
    brand_profile_version = models.ForeignKey(
        BrandProfileVersion,
        on_delete=models.PROTECT,
        related_name="generated_posts",
        null=True,
        blank=True,
    )
    idea_title = models.CharField(max_length=255)
    idea_text = models.TextField(blank=True, default="")
    state = models.CharField(max_length=20, choices=SocialPostState.choices, default=SocialPostState.DRAFT, db_index=True)
    metadata = models.JSONField(default=dict, blank=True)
    legacy_linkedin_post_id = models.UUIDField(null=True, blank=True, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["created_at"]
        indexes = [models.Index(fields=["workspace", "state", "created_at"], name="social_post_workspace_idx")]


class SocialPostSource(models.Model):
    post = models.ForeignKey(SocialPost, on_delete=models.CASCADE, related_name="source_references")
    source = models.ForeignKey(ContentSource, on_delete=models.PROTECT, related_name="post_references")
    sort_order = models.PositiveSmallIntegerField(default=0)
    used_in_generation = models.BooleanField(default=False)

    class Meta:
        ordering = ["sort_order", "id"]
        constraints = [
            models.UniqueConstraint(fields=["post", "source"], name="unique_social_post_source"),
            models.UniqueConstraint(fields=["post", "sort_order"], name="unique_social_post_source_order"),
        ]


class StoryInterview(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="story_interviews")
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="story_interviews",
        null=True,
        blank=True,
    )
    week_of = models.DateField(db_index=True)
    questions = models.JSONField(default=list)
    answers = models.JSONField(default=dict, blank=True)
    status = models.CharField(max_length=20, choices=StoryInterviewState.choices, default=StoryInterviewState.IN_PROGRESS)
    approved_source = models.OneToOneField(
        ContentSource,
        on_delete=models.SET_NULL,
        related_name="story_interview",
        null=True,
        blank=True,
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["workspace", "week_of"], name="unique_story_interview_week")]


class SocialPostVariant(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    post = models.ForeignKey(SocialPost, on_delete=models.CASCADE, related_name="variants")
    connection = models.ForeignKey(SocialConnection, on_delete=models.SET_NULL, related_name="variants", null=True, blank=True)
    network = models.CharField(max_length=20, choices=SocialNetwork.choices)
    copy = models.TextField()
    hashtags = models.JSONField(default=list, blank=True)
    metadata = models.JSONField(
        default=dict,
        blank=True,
        help_text="Platform-specific presentation data such as thread segments or carousel copy.",
    )
    scheduled_for = models.DateTimeField(db_index=True)
    approved_version = models.ForeignKey(
        "SocialPostVersion",
        on_delete=models.SET_NULL,
        related_name="approved_variants",
        null=True,
        blank=True,
    )
    status = models.CharField(max_length=20, choices=SocialPostState.choices, default=SocialPostState.DRAFT, db_index=True)
    failure_reason = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["scheduled_for", "created_at"]
        constraints = [models.UniqueConstraint(fields=["post", "network"], name="unique_social_post_network")]
        indexes = [models.Index(fields=["network", "status", "scheduled_for"], name="social_variant_due_idx")]


class SocialPostVersion(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    variant = models.ForeignKey(SocialPostVariant, on_delete=models.CASCADE, related_name="versions")
    version = models.PositiveIntegerField()
    copy = models.TextField()
    hashtags = models.JSONField(default=list, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    media_snapshot = models.JSONField(default=list, blank=True)
    quality_check = models.JSONField(
        default=dict,
        blank=True,
        help_text="Pre-approval checks captured for this exact immutable version.",
    )
    scheduled_for = models.DateTimeField()
    approved_at = models.DateTimeField(null=True, blank=True)
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="approved_social_post_versions",
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["version"]
        constraints = [models.UniqueConstraint(fields=["variant", "version"], name="unique_social_variant_version")]

    def save(self, *args, **kwargs):
        if self.pk and type(self).objects.filter(pk=self.pk).exists():
            raise ValidationError("Social post versions are immutable.")
        if self.scheduled_for is None:
            self.scheduled_for = self.variant.scheduled_for
        return super().save(*args, **kwargs)


class MediaAsset(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="social_media_assets")
    variant = models.ForeignKey(SocialPostVariant, on_delete=models.CASCADE, related_name="media_assets")
    post = models.ForeignKey(
        SocialPost,
        on_delete=models.CASCADE,
        related_name="legacy_media_assets",
        null=True,
        blank=True,
        editable=False,
        help_text="Nullable compatibility pointer; variant is the authoritative owner.",
    )
    asset_type = models.CharField(max_length=20, choices=MediaAssetType.choices)
    source = models.CharField(
        max_length=20,
        choices=MediaAssetSource.choices,
        default=MediaAssetSource.UPLOAD,
    )
    original_filename = models.CharField(max_length=255, blank=True, default="")
    original_storage_key = models.CharField(max_length=1000, blank=True, default="")
    publish_storage_key = models.CharField(max_length=1000, blank=True, default="")
    storage_url = models.URLField(
        max_length=2000,
        blank=True,
        default="",
        help_text="Legacy compatibility only. New assets use owned storage keys.",
    )
    content_type = models.CharField(max_length=100, blank=True, default="")
    byte_size = models.PositiveBigIntegerField(default=0)
    checksum_sha256 = models.CharField(max_length=64, blank=True, default="", db_index=True)
    width = models.PositiveIntegerField(null=True, blank=True)
    height = models.PositiveIntegerField(null=True, blank=True)
    duration_ms = models.PositiveIntegerField(null=True, blank=True)
    alt_text = models.CharField(max_length=500, blank=True, default="")
    metadata = models.JSONField(default=dict, blank=True)
    sort_order = models.PositiveSmallIntegerField(default=0)
    legacy_linkedin_post_id = models.UUIDField(null=True, blank=True, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["sort_order", "created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["variant", "sort_order"],
                name="unique_social_variant_media_order",
            ),
        ]
        indexes = [
            models.Index(fields=["workspace", "asset_type"], name="social_asset_workspace_idx"),
            models.Index(fields=["variant", "sort_order"], name="social_asset_variant_order_idx"),
        ]

    @property
    def publish_url(self):
        from integrations.social.media import publish_url_for_asset

        return publish_url_for_asset(self)


class PublishJob(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    variant = models.ForeignKey(SocialPostVariant, on_delete=models.CASCADE, related_name="publish_jobs")
    connection = models.ForeignKey(
        SocialConnection,
        on_delete=models.PROTECT,
        related_name="publish_jobs",
    )
    approved_version = models.ForeignKey(SocialPostVersion, on_delete=models.PROTECT, related_name="publish_jobs")
    provider = models.CharField(max_length=20, choices=SocialProvider.choices)
    idempotency_key = models.CharField(max_length=255, unique=True)
    attempt_count = models.PositiveIntegerField(default=0)
    external_id = models.CharField(max_length=500, blank=True, default="")
    status = models.CharField(
        max_length=25,
        choices=PublishJobState.choices,
        default=PublishJobState.SCHEDULED,
        db_index=True,
    )
    scheduled_for = models.DateTimeField(db_index=True)
    next_attempt_at = models.DateTimeField(null=True, blank=True, db_index=True)
    claim_token = models.UUIDField(null=True, blank=True, editable=False)
    claimed_at = models.DateTimeField(null=True, blank=True)
    unknown_since = models.DateTimeField(null=True, blank=True)
    failure_message = models.TextField(blank=True, default="")
    diagnostic_details = models.JSONField(default=dict, blank=True)
    submitted_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["provider", "status", "created_at"], name="social_job_provider_idx"),
            models.Index(fields=["status", "scheduled_for", "next_attempt_at"], name="social_job_due_idx"),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["variant", "approved_version"],
                name="unique_social_job_approval",
            ),
        ]


class PublishAttempt(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    job = models.ForeignKey(PublishJob, on_delete=models.CASCADE, related_name="attempts")
    attempt_number = models.PositiveSmallIntegerField()
    idempotency_key = models.UUIDField(unique=True, default=uuid.uuid4, editable=False)
    status = models.CharField(
        max_length=25,
        choices=PublishJobState.choices,
        default=PublishJobState.PUBLISHING,
        db_index=True,
    )
    external_id = models.CharField(max_length=500, blank=True, default="")
    failure_message = models.TextField(blank=True, default="")
    diagnostic_details = models.JSONField(default=dict, blank=True)
    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["attempt_number"]
        constraints = [
            models.UniqueConstraint(
                fields=["job", "attempt_number"],
                name="unique_social_publish_attempt",
            ),
        ]


class ProviderEvent(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="social_provider_events")
    connection = models.ForeignKey(SocialConnection, on_delete=models.SET_NULL, related_name="events", null=True, blank=True)
    publish_job = models.ForeignKey(PublishJob, on_delete=models.SET_NULL, related_name="events", null=True, blank=True)
    provider = models.CharField(max_length=20, choices=SocialProvider.choices)
    external_event_id = models.CharField(max_length=500, blank=True, default="")
    event_type = models.CharField(max_length=100)
    normalized_status = models.CharField(max_length=20, choices=PublishJobState.choices, null=True, blank=True)
    payload = models.JSONField(default=dict, blank=True)
    occurred_at = models.DateTimeField(null=True, blank=True)
    received_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-received_at"]
        indexes = [models.Index(fields=["workspace", "provider", "received_at"], name="social_event_workspace_idx")]
        constraints = [
            models.UniqueConstraint(
                fields=["provider", "external_event_id"],
                condition=~models.Q(external_event_id=""),
                name="unique_social_provider_event",
            ),
        ]


class SocialAuditEvent(models.Model):
    """Append-only, secret-free audit trail for Content Studio operations."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="social_audit_events")
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="social_audit_events",
        null=True,
        blank=True,
    )
    event_type = models.CharField(max_length=40, choices=SocialAuditEventType.choices, db_index=True)
    target_type = models.CharField(max_length=50, blank=True, default="")
    target_id = models.CharField(max_length=100, blank=True, default="")
    details = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["workspace", "event_type", "created_at"], name="social_audit_workspace_idx"),
        ]

    def save(self, *args, **kwargs):
        if self.pk and type(self).objects.filter(pk=self.pk).exists():
            raise ValidationError("Social audit events are immutable.")
        return super().save(*args, **kwargs)


class SocialMetricObservation(models.Model):
    """An immutable, normalized metric snapshot returned by a publishing provider."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="social_metric_observations")
    variant = models.ForeignKey(
        SocialPostVariant,
        on_delete=models.CASCADE,
        related_name="metric_observations",
        null=True,
        blank=True,
    )
    connection = models.ForeignKey(
        SocialConnection,
        on_delete=models.SET_NULL,
        related_name="metric_observations",
        null=True,
        blank=True,
    )
    publish_job = models.ForeignKey(
        PublishJob,
        on_delete=models.SET_NULL,
        related_name="metric_observations",
        null=True,
        blank=True,
    )
    provider = models.CharField(max_length=20, choices=SocialProvider.choices)
    metric_name = models.CharField(max_length=30, choices=SocialMetricName.choices, db_index=True)
    value = models.BigIntegerField()
    measured_at = models.DateTimeField(db_index=True)
    raw_reference = models.JSONField(default=dict, blank=True)
    ingestion_key = models.CharField(max_length=64, unique=True, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-measured_at", "metric_name"]
        indexes = [
            models.Index(fields=["workspace", "metric_name", "measured_at"], name="social_metric_workspace_idx"),
            models.Index(fields=["variant", "metric_name", "measured_at"], name="social_metric_variant_idx"),
        ]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(variant__isnull=False) | models.Q(connection__isnull=False),
                name="social_metric_has_subject",
            ),
        ]

    def save(self, *args, **kwargs):
        if self.pk and type(self).objects.filter(pk=self.pk).exists():
            raise ValidationError("Social metric observations are immutable.")
        return super().save(*args, **kwargs)


class AnalyticsSuggestion(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="social_analytics_suggestions")
    fingerprint = models.CharField(max_length=64)
    dimension = models.CharField(max_length=30)
    segment = models.CharField(max_length=255)
    suggested_rule = models.CharField(max_length=500)
    rationale = models.TextField()
    evidence = models.JSONField(default=dict)
    status = models.CharField(
        max_length=20,
        choices=AnalyticsSuggestionState.choices,
        default=AnalyticsSuggestionState.PENDING,
        db_index=True,
    )
    decided_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="decided_social_analytics_suggestions",
        null=True,
        blank=True,
    )
    decided_at = models.DateTimeField(null=True, blank=True)
    applied_brand_version = models.ForeignKey(
        BrandProfileVersion,
        on_delete=models.SET_NULL,
        related_name="analytics_suggestions",
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["status", "-created_at"]
        constraints = [
            models.UniqueConstraint(fields=["workspace", "fingerprint"], name="unique_workspace_analytics_suggestion"),
        ]


class EngagementContact(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="engagement_contacts")
    platform = models.CharField(max_length=20, choices=SocialNetwork.choices, db_index=True)
    provider_contact_id = models.CharField(max_length=500)
    handle = models.CharField(max_length=255, blank=True, default="")
    display_name = models.CharField(max_length=255, blank=True, default="")
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["workspace", "platform", "provider_contact_id"],
                name="unique_workspace_engagement_contact",
            ),
        ]


class EngagementReviewItem(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="engagement_review_items")
    connection = models.ForeignKey(
        SocialConnection,
        on_delete=models.SET_NULL,
        related_name="engagement_review_items",
        null=True,
        blank=True,
    )
    contact = models.ForeignKey(
        EngagementContact,
        on_delete=models.SET_NULL,
        related_name="review_items",
        null=True,
        blank=True,
    )
    kind = models.CharField(max_length=30, choices=EngagementItemKind.choices)
    status = models.CharField(
        max_length=20,
        choices=EngagementReviewStatus.choices,
        default=EngagementReviewStatus.PENDING,
        db_index=True,
    )
    source_label = models.CharField(max_length=255, blank=True, default="")
    incoming_text = models.TextField(blank=True, default="")
    suggested_text = models.TextField(blank=True, default="")
    final_text = models.TextField(blank=True, default="")
    conversation_id = models.CharField(max_length=500, blank=True, default="")
    provider_post_id = models.CharField(max_length=500, blank=True, default="")
    provider_comment_id = models.CharField(max_length=500, blank=True, default="")
    provider_event_id = models.CharField(max_length=500, blank=True, default="", db_index=True)
    provider_message_id = models.CharField(max_length=500, blank=True, default="")
    assignee = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="assigned_engagement_reviews",
        null=True,
        blank=True,
    )
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="approved_engagement_reviews",
        null=True,
        blank=True,
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    error_message = models.CharField(max_length=500, blank=True, default="")
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["workspace", "status", "created_at"], name="engage_review_workspace_idx"),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["provider_event_id"],
                condition=~models.Q(provider_event_id=""),
                name="unique_engagement_provider_event",
            ),
        ]


class EngagementAutomation(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="engagement_automations")
    connection = models.ForeignKey(
        SocialConnection,
        on_delete=models.CASCADE,
        related_name="engagement_automations",
    )
    kind = models.CharField(max_length=30, choices=EngagementAutomationKind.choices)
    name = models.CharField(max_length=255)
    status = models.CharField(
        max_length=20,
        choices=EngagementAutomationStatus.choices,
        default=EngagementAutomationStatus.DRAFT,
        db_index=True,
    )
    keywords = models.JSONField(default=list, blank=True)
    match_mode = models.CharField(max_length=20, default="contains")
    approved_dm_message = models.TextField(blank=True, default="")
    approved_comment_reply = models.TextField(blank=True, default="")
    configuration = models.JSONField(default=dict, blank=True)
    provider_automation_id = models.CharField(max_length=500, blank=True, default="")
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="owned_engagement_automations",
        null=True,
        blank=True,
    )
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="approved_engagement_automations",
        null=True,
        blank=True,
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    stats = models.JSONField(default=dict, blank=True)
    last_error = models.CharField(max_length=500, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["workspace", "status"], name="engage_auto_workspace_idx")]


class EngagementCampaign(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="engagement_campaigns")
    connection = models.ForeignKey(
        SocialConnection,
        on_delete=models.CASCADE,
        related_name="engagement_campaigns",
    )
    name = models.CharField(max_length=255)
    status = models.CharField(
        max_length=20,
        choices=EngagementCampaignStatus.choices,
        default=EngagementCampaignStatus.DRAFT,
        db_index=True,
    )
    audience = models.JSONField(default=dict, blank=True)
    steps = models.JSONField(default=list, blank=True)
    provider_sequence_id = models.CharField(max_length=500, blank=True, default="")
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="owned_engagement_campaigns",
        null=True,
        blank=True,
    )
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="approved_engagement_campaigns",
        null=True,
        blank=True,
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    stats = models.JSONField(default=dict, blank=True)
    last_error = models.CharField(max_length=500, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["workspace", "status"], name="engage_campaign_ws_idx")]


class EngagementWebhookEvent(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    provider_event_id = models.CharField(max_length=500, unique=True)
    event_type = models.CharField(max_length=100)
    account_id = models.CharField(max_length=500, blank=True, default="")
    payload_fingerprint = models.CharField(max_length=64)
    processed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-processed_at"]


class WorkspaceTier(models.TextChoices):
    FREE = "FREE", "Free"
    STARTER = "STARTER", "Starter"
    ADVANCE = "ADVANCE", "Advance"
    ADMIN = "ADMIN", "Admin"


class WorkspaceSubscription(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.OneToOneField(
        Workspace,
        on_delete=models.CASCADE,
        related_name="subscription",
    )
    tier = models.CharField(
        max_length=20,
        choices=WorkspaceTier.choices,
        default=WorkspaceTier.FREE,
        db_index=True,
    )
    extra_connections = models.PositiveIntegerField(default=0)
    has_engage_addon = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    billing_name = models.CharField(max_length=255, blank=True, default="")
    billing_email = models.CharField(max_length=255, blank=True, default="")
    billing_provider = models.CharField(max_length=30, blank=True, default="")
    provider_customer_id = models.CharField(max_length=255, blank=True, default="")
    provider_subscription_id = models.CharField(max_length=255, blank=True, default="")
    current_period_start = models.DateTimeField(null=True, blank=True)
    current_period_end = models.DateTimeField(null=True, blank=True)
    cancel_at_period_end = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.workspace.name} ({self.tier})"

    @property
    def connections_quota(self) -> int:
        if self.tier == WorkspaceTier.ADMIN:
            return 999999
        if self.tier == WorkspaceTier.FREE:
            return 0
        # Starter and Advance both include 1 connection base + extra
        return 1 + self.extra_connections

    @property
    def engage_entitled(self) -> bool:
        if self.tier in (WorkspaceTier.ADMIN, WorkspaceTier.ADVANCE):
            return True
        return self.has_engage_addon


class CreditAccount(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.OneToOneField(
        Workspace,
        on_delete=models.CASCADE,
        related_name="credit_account",
    )
    total_allocated = models.PositiveIntegerField(default=50)
    total_used = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.workspace.name} ({self.balance} remaining)"

    @property
    def balance(self) -> int:
        return max(0, self.total_allocated - self.total_used)


class CreditReservationStatus(models.TextChoices):
    RESERVED = "RESERVED", "Reserved"
    CONSUMED = "CONSUMED", "Consumed"
    REFUNDED = "REFUNDED", "Refunded"


class CreditReservation(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(
        Workspace,
        on_delete=models.CASCADE,
        related_name="credit_reservations",
    )
    post = models.ForeignKey(
        SocialPost,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="credit_reservations",
    )
    idempotency_key = models.CharField(max_length=255, unique=True)
    amount = models.PositiveIntegerField()
    action_type = models.CharField(max_length=50)
    description = models.CharField(max_length=255)
    expected_operations = models.PositiveIntegerField(default=1)
    completed_operations = models.PositiveIntegerField(default=0)
    status = models.CharField(
        max_length=20,
        choices=CreditReservationStatus.choices,
        default=CreditReservationStatus.RESERVED,
        db_index=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["workspace", "status"], name="credit_reservation_ws_idx"),
        ]


class CreditTransaction(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(
        Workspace,
        on_delete=models.CASCADE,
        related_name="credit_transactions",
    )
    amount = models.IntegerField()  # Negative for usage, positive for refill
    action_type = models.CharField(max_length=50)
    description = models.CharField(max_length=255)
    balance_after = models.IntegerField(default=0)
    post = models.ForeignKey(
        SocialPost,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="credit_transactions",
    )
    reservation = models.ForeignKey(
        CreditReservation,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="transactions",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class BillingInvoice(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    invoice_number = models.CharField(max_length=50, unique=True, db_index=True)
    workspace = models.ForeignKey(
        Workspace,
        on_delete=models.CASCADE,
        related_name="invoices",
    )
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    currency = models.CharField(max_length=10, default="USD")
    status = models.CharField(max_length=20, default="PAID")
    title = models.CharField(max_length=255)
    line_items = models.JSONField(default=list, blank=True)
    payment_method = models.CharField(max_length=100, default="Credit Card (Simulated Checkout)")
    payment_reference = models.CharField(max_length=255, blank=True, default="")
    billing_name = models.CharField(max_length=255, blank=True, default="")
    billing_email = models.CharField(max_length=255, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    paid_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.invoice_number} - {self.workspace.name} (${self.amount})"


class BillingWebhookEvent(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    provider = models.CharField(max_length=30)
    provider_event_id = models.CharField(max_length=255)
    event_type = models.CharField(max_length=100)
    payload_fingerprint = models.CharField(max_length=64)
    invoice = models.ForeignKey(
        BillingInvoice,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="webhook_events",
    )
    processed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-processed_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["provider", "provider_event_id"],
                name="unique_billing_provider_event",
            ),
        ]

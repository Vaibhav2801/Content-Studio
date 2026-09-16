from datetime import datetime, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone

from integrations.linkedin.services.images import LinkedInImageGenerator
from integrations.social.media import normalize_generated_image, store_uploaded_media
from integrations.social.models import (
    ApprovalMode,
    BrandProfile,
    ConnectionState,
    ContentSource,
    ContentSourceProcessingState,
    MediaAssetSource,
    SocialConnection,
    SocialNetwork,
    SocialPostState,
    SocialPostVariant,
)
from integrations.social.services.composer import (
    create_draft,
    generate_variants,
    save_variant_draft,
    schedule_post,
    submit_for_review,
)
from integrations.social.services.publishing_routing import selected_provider


ACTIVE_QUEUE_STATES = {
    SocialPostState.DRAFT,
    SocialPostState.NEEDS_REVIEW,
    SocialPostState.APPROVED,
    SocialPostState.SCHEDULED,
    SocialPostState.PUBLISHING,
    SocialPostState.SUBMITTED,
}


def _zone(name):
    try:
        return ZoneInfo(name)
    except ZoneInfoNotFoundError:
        return ZoneInfo("UTC")


def upcoming_slots(settings, connection, *, now=None, limit=1):
    if limit <= 0:
        return []
    now = now or timezone.now()
    zone = _zone(settings.timezone)
    local_now = now.astimezone(zone)
    days = settings.schedule_days or list(range(7))
    slots = []
    for offset in range(settings.queue_horizon_days + 1):
        day = local_now.date() + timedelta(days=offset)
        if day.weekday() not in days:
            continue
        candidate = datetime.combine(day, settings.post_time, tzinfo=zone).replace(fold=0)
        round_trip = candidate.astimezone(ZoneInfo("UTC")).astimezone(zone)
        if round_trip.date() != day or round_trip.time().replace(tzinfo=None) != settings.post_time:
            continue
        slot = candidate.astimezone(ZoneInfo("UTC"))
        if slot <= now + timedelta(minutes=5):
            continue
        if SocialPostVariant.objects.filter(
            connection=connection,
            scheduled_for__gt=slot - timedelta(minutes=5),
            scheduled_for__lt=slot + timedelta(minutes=5),
        ).exclude(status=SocialPostState.CANCELLED).exists():
            continue
        slots.append(slot)
        if len(slots) >= limit:
            break
    return slots


def _ideas(settings):
    sources = list(ContentSource.objects.filter(
        workspace=settings.workspace,
        is_active=True,
        processing_status=ContentSourceProcessingState.READY,
    ).order_by("created_at"))
    if sources:
        return [(source.label or "Saved source", "Turn this approved source into a useful social post.", [source]) for source in sources]
    brand = BrandProfile.objects.filter(settings=settings).first()
    pillars = list(brand.content_pillars) if brand and brand.content_pillars else []
    if pillars:
        return [(str(pillar), f"Create a useful post about {pillar} for this business and its audience.", []) for pillar in pillars]
    description = brand.business_description if brand else ""
    return [(settings.brand_name, description or f"Share one useful insight from {settings.brand_name}.", [])]


def _add_generated_image(variant, image_generator):
    prompt = str(variant.metadata.get("image_prompt") or variant.post.idea_title).strip()
    _, metadata, image_data = image_generator.generate(variant.id, prompt)
    if not image_data:
        raise ValueError("Image generation returned no image data.")
    image_data, content_type, extension = normalize_generated_image(
        variant.network,
        image_data,
        metadata.get("content_type"),
    )
    uploaded = SimpleUploadedFile(f"automated-{variant.id}{extension}", image_data, content_type=content_type)
    store_uploaded_media(
        variant,
        uploaded,
        alt_text=str(variant.metadata.get("alt_text") or "")[:500],
        source=MediaAssetSource.AI,
    )


def fill_workspace_queue(settings, *, generator=None, image_generator=None, now=None):
    """Fill each connected account''s queue using the generic multi-network pipeline."""
    if not settings.is_active:
        return []
    now = now or timezone.now()
    connections = SocialConnection.objects.filter(
        workspace=settings.workspace,
        provider=selected_provider(settings.workspace).value,
        status=ConnectionState.CONNECTED,
    ).order_by("network", "created_at")
    ideas = _ideas(settings)
    created = []
    for connection in connections:
        queued = SocialPostVariant.objects.filter(
            post__workspace=settings.workspace,
            connection=connection,
            scheduled_for__gt=now,
            status__in=ACTIVE_QUEUE_STATES,
        ).count()
        needed = max(0, settings.posts_per_week - queued)
        for index, slot in enumerate(upcoming_slots(settings, connection, now=now, limit=needed)):
            title, direction, sources = ideas[(queued + index) % len(ideas)]
            post = create_draft(
                workspace=settings.workspace,
                idea_title=title,
                idea_text=direction,
                sources=sources,
                networks=[connection.network],
                connection_ids=[str(connection.id)],
                controls={
                    "tone": "Professional",
                    "goal": "Awareness",
                    "length": "Medium",
                    "include_image": connection.network == SocialNetwork.INSTAGRAM,
                },
            )
            post.metadata = {
                **post.metadata,
                "creation_mode": "AUTOMATION",
                "automation_connection_id": str(connection.id),
            }
            post.save(update_fields=["metadata", "updated_at"])
            post = generate_variants(
                post=post,
                networks=[connection.network],
                connection_ids=[str(connection.id)],
                controls=post.metadata["generation_controls"],
                generator=generator,
            )
            variant = post.variants.get()
            save_variant_draft(variant=variant, scheduled_for=slot)
            variant.refresh_from_db()
            if connection.network == SocialNetwork.INSTAGRAM and not variant.media_assets.exists():
                _add_generated_image(variant, image_generator or LinkedInImageGenerator())
                variant.refresh_from_db()
            if settings.approval_mode == ApprovalMode.AUTO_PUBLISH:
                schedule_post(post)
            else:
                submit_for_review(post)
            created.append(post)
    return created

import logging
import json

from celery import shared_task
from django.conf import settings
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone

from integrations.social.services.lifecycle import (
    claim_due_jobs,
    execute_claimed_job,
    reconcile_pending_jobs,
)
from integrations.social.services.analytics import refresh_published_metrics
from integrations.social.models import SocialWorkspaceSettings
from integrations.social.services.automation import fill_workspace_queue


logger = logging.getLogger(__name__)


def _fail_video_generation(job, message):
    from integrations.social.models import VideoGenerationState
    from integrations.social.services.billing import finalize_credit_reservation

    job.refresh_from_db()
    if job.status in {VideoGenerationState.COMPLETED, VideoGenerationState.FAILED}:
        return job
    job.status = VideoGenerationState.FAILED
    job.error_message = str(message or "The video could not be generated.")[:500]
    job.completed_at = timezone.now()
    job.save(update_fields=["status", "error_message", "completed_at", "updated_at"])
    finalize_credit_reservation(job.credit_reservation_id, success=False)
    return job


def process_video_generation_step(job_id):
    """Advance one provider step; returns PENDING, COMPLETED, FAILED, or NOT_FOUND."""
    from integrations.social.media import MediaValidationError, store_uploaded_media
    from integrations.social.models import (
        MediaAssetSource,
        VideoGenerationJob,
        VideoGenerationState,
    )
    from integrations.social.services.billing import finalize_credit_reservation
    from integrations.social.services.videos import GeminiVideoGenerator, VideoGenerationError

    try:
        job = VideoGenerationJob.objects.select_related("variant__post").get(pk=job_id)
    except VideoGenerationJob.DoesNotExist:
        logger.error("VideoGenerationJob %s does not exist.", job_id)
        return {"status": "NOT_FOUND", "job_id": str(job_id)}

    if job.status == VideoGenerationState.COMPLETED:
        return {"status": "COMPLETED", "job_id": str(job.id)}
    if job.status == VideoGenerationState.FAILED:
        return {"status": "FAILED", "job_id": str(job.id), "error": job.error_message}

    generator = GeminiVideoGenerator()
    try:
        if not job.provider_operation_id:
            operation_id, key_index = generator.start(
                job.prompt,
                aspect_ratio=job.aspect_ratio,
                duration_seconds=job.duration_seconds,
                resolution=job.resolution,
            )
            job.provider_operation_id = operation_id
            job.provider_metadata = {"key_index": key_index}
            job.status = VideoGenerationState.SUBMITTED
            job.error_message = ""
            job.save(update_fields=[
                "provider_operation_id", "provider_metadata", "status", "error_message", "updated_at"
            ])
            return {"status": "PENDING", "job_id": str(job.id)}

        key_index = int((job.provider_metadata or {}).get("key_index", 0))
        operation = generator.poll(job.provider_operation_id, key_index=key_index)
        if not operation.done:
            if job.status != VideoGenerationState.PROCESSING:
                job.status = VideoGenerationState.PROCESSING
                job.save(update_fields=["status", "updated_at"])
            return {"status": "PENDING", "job_id": str(job.id)}
        if operation.error:
            _fail_video_generation(job, operation.error)
            return {"status": "FAILED", "job_id": str(job.id), "error": job.error_message}

        video_data = generator.download(operation.video_uri, key_index=key_index)
        uploaded = SimpleUploadedFile(
            "ai-video.mp4",
            video_data,
            content_type="video/mp4",
        )
        asset = store_uploaded_media(
            job.variant,
            uploaded,
            alt_text=job.prompt[:500],
            source=MediaAssetSource.AI,
        )
    except MediaValidationError as exc:
        _fail_video_generation(job, "; ".join(exc.issues))
        return {"status": "FAILED", "job_id": str(job.id), "error": job.error_message}
    except VideoGenerationError:
        raise
    except Exception as exc:
        logger.exception("Unexpected video generation failure for job %s", job.id)
        _fail_video_generation(job, str(exc))
        return {"status": "FAILED", "job_id": str(job.id), "error": job.error_message}

    job.output_asset = asset
    job.status = VideoGenerationState.COMPLETED
    job.error_message = ""
    job.completed_at = timezone.now()
    job.save(update_fields=["output_asset", "status", "error_message", "completed_at", "updated_at"])
    finalize_credit_reservation(job.credit_reservation_id, success=True)
    return {"status": "COMPLETED", "job_id": str(job.id), "asset_id": str(asset.id)}


@shared_task(bind=True, max_retries=90, name="social.process_video_generation")
def process_video_generation(self, job_id):
    from integrations.social.models import VideoGenerationJob
    from integrations.social.services.videos import VideoGenerationError, VideoProviderUnavailableError

    try:
        result = process_video_generation_step(job_id)
    except VideoProviderUnavailableError as exc:
        if self.request.retries >= self.max_retries:
            job = VideoGenerationJob.objects.filter(pk=job_id).first()
            if job:
                _fail_video_generation(job, "The video provider remained unavailable. Your credits were refunded.")
            return {"status": "FAILED", "job_id": str(job_id)}
        raise self.retry(exc=exc, countdown=settings.SOCIAL_VIDEO_POLL_INTERVAL_SECONDS)
    except VideoGenerationError as exc:
        job = VideoGenerationJob.objects.filter(pk=job_id).first()
        if job:
            _fail_video_generation(job, str(exc))
        return {"status": "FAILED", "job_id": str(job_id), "error": str(exc)}

    if result["status"] == "PENDING":
        raise self.retry(countdown=settings.SOCIAL_VIDEO_POLL_INTERVAL_SECONDS)
    return result


@shared_task(name="social.fill_content_queues")
def fill_content_queues():
    counts = {"generated": 0, "workspaces": 0, "failed": 0}
    for settings in SocialWorkspaceSettings.objects.filter(is_active=True).select_related("workspace"):
        counts["workspaces"] += 1
        try:
            counts["generated"] += len(fill_workspace_queue(settings))
        except Exception:
            counts["failed"] += 1
            logger.exception("Could not fill social queue for workspace settings %s", settings.id)
    return counts


@shared_task(name="social.publish_due_jobs")
def publish_due_jobs():
    counts = {
        "claimed": 0,
        "published": 0,
        "submitted": 0,
        "failed": 0,
        "connection_required": 0,
        "unknown": 0,
        "rescheduled": 0,
    }
    claims = claim_due_jobs()
    counts["claimed"] = len(claims)
    for claim in claims:
        try:
            job = execute_claimed_job(claim)
        except Exception:
            logger.exception("Could not execute social publish job %s", claim.job_id)
            continue
        if job is None:
            continue
        key = {
            "PUBLISHED": "published",
            "SUBMITTED": "submitted",
            "FAILED": "failed",
            "CONNECTION_REQUIRED": "connection_required",
            "UNKNOWN": "unknown",
            "SCHEDULED": "rescheduled",
        }.get(job.status)
        if key:
            counts[key] += 1
    logger.info("social_publish_batch %s", json.dumps(counts, sort_keys=True))
    if counts["failed"] or counts["unknown"]:
        logger.warning("social_publish_batch_needs_attention %s", json.dumps(counts, sort_keys=True))
    return counts


@shared_task(name="social.reconcile_publish_jobs")
def reconcile_publish_jobs():
    counts = reconcile_pending_jobs()
    logger.info("social_reconcile_batch %s", json.dumps(counts, sort_keys=True))
    return counts


@shared_task(name="social.refresh_post_metrics")
def refresh_post_metrics():
    counts = refresh_published_metrics()
    logger.info("social_metrics_batch %s", json.dumps(counts, sort_keys=True))
    return counts


@shared_task(name="social.generate_post_variants")
def generate_post_variants(post_id, networks=None, controls=None, connection_ids=None, reservation_id=None):
    from integrations.social.models import SocialPost
    from integrations.social.services.billing import finalize_credit_reservation
    from integrations.social.services.composer import generate_variants

    try:
        post = SocialPost.objects.get(pk=post_id)
    except SocialPost.DoesNotExist:
        logger.error("SocialPost %s does not exist for generation task.", post_id)
        if reservation_id:
            finalize_credit_reservation(reservation_id, success=False)
        return {"status": "NOT_FOUND", "post_id": post_id}

    metadata = dict(post.metadata or {})
    metadata["generation_status"] = "GENERATING"
    metadata["generation_error"] = ""
    post.metadata = metadata
    post.save(update_fields=["metadata", "updated_at"])

    try:
        post = generate_variants(
            post=post,
            networks=networks,
            controls=controls,
            connection_ids=connection_ids,
        )
        post.refresh_from_db()

        # Generate images if requested or required for the platform
        should_gen_image = bool(controls.get("include_image")) if controls else False
        image_gen = None
        image_errors = []
        for variant in post.variants.all():
            if (should_gen_image or variant.network == "INSTAGRAM") and not variant.media_assets.exists():
                try:
                    if image_gen is None:
                        from integrations.linkedin.services.images import LinkedInImageGenerator
                        image_gen = LinkedInImageGenerator()
                    from integrations.social.services.composer import compose_image_generation_prompt
                    from integrations.social.media import normalize_generated_image, store_uploaded_media
                    from integrations.social.models import MediaAssetSource
                    from django.core.files.uploadedfile import SimpleUploadedFile

                    prompt = str(
                        variant.metadata.get("image_prompt")
                        or post.metadata.get("image_prompt")
                        or post.idea_title
                    ).strip()
                    directed_prompt = compose_image_generation_prompt(variant, prompt)
                    _, img_meta, image_data = image_gen.generate(
                        variant.id, directed_prompt, network=variant.network
                    )
                    if not image_data:
                        raise RuntimeError("Image provider returned no image data.")
                    image_data, content_type, extension = normalize_generated_image(
                        variant.network, image_data, img_meta.get("content_type")
                    )
                    uploaded = SimpleUploadedFile(
                        f"generated-{variant.id}{extension}",
                        image_data,
                        content_type=content_type,
                    )
                    store_uploaded_media(
                        variant,
                        uploaded,
                        alt_text=str(variant.metadata.get("alt_text") or post.idea_title)[:500],
                        source=MediaAssetSource.AI,
                    )
                    logger.info("Successfully generated image for variant %s", variant.id)
                except Exception as image_exc:
                    logger.exception("Required image generation failed for variant %s", variant.id)
                    image_errors.append(f"{variant.network}: {image_exc}")
                    variant.refresh_from_db()
                    variant_metadata = dict(variant.metadata or {})
                    variant_metadata["image_generation_status"] = "FAILED"
                    variant_metadata["image_generation_error"] = str(image_exc)[:1000]
                    variant.metadata = variant_metadata
                    variant.save(update_fields=["metadata", "updated_at"])

        post.refresh_from_db()
        metadata = dict(post.metadata or {})
        metadata["generation_status"] = "READY"
        metadata["generation_error"] = ""
        if image_errors:
            metadata["generation_warning"] = "Text was generated, but the image provider could not create the requested media."
        else:
            metadata.pop("generation_warning", None)
        post.metadata = metadata
        post.save(update_fields=["metadata", "updated_at"])
        if reservation_id:
            # The reservation includes both copy and media. Refund it when the
            # requested image was not delivered instead of charging for a
            # partially completed generation.
            finalize_credit_reservation(reservation_id, success=not image_errors)
        logger.info("Successfully generated post variants for post %s", post_id)
        return {
            "status": "READY",
            "post_id": post_id,
            **({"warning": metadata["generation_warning"]} if image_errors else {}),
        }
    except Exception as exc:
        logger.exception("Failed to generate post variants for post %s: %s", post_id, exc)
        post.refresh_from_db()
        metadata = dict(post.metadata or {})
        metadata["generation_status"] = "FAILED"
        metadata["generation_error"] = str(exc)
        post.metadata = metadata
        post.save(update_fields=["metadata", "updated_at"])
        if reservation_id:
            finalize_credit_reservation(reservation_id, success=False)
        return {"status": "FAILED", "post_id": post_id, "error": str(exc)}


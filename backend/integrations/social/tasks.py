import logging
import json

from celery import shared_task

from integrations.social.services.lifecycle import (
    claim_due_jobs,
    execute_claimed_job,
    reconcile_pending_jobs,
)
from integrations.social.services.analytics import refresh_published_metrics
from integrations.social.models import SocialWorkspaceSettings
from integrations.social.services.automation import fill_workspace_queue


logger = logging.getLogger(__name__)


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
def generate_post_variants(post_id, networks=None, controls=None, connection_ids=None):
    from integrations.social.models import SocialPost
    from integrations.social.services.composer import generate_variants

    try:
        post = SocialPost.objects.get(pk=post_id)
    except SocialPost.DoesNotExist:
        logger.error("SocialPost %s does not exist for generation task.", post_id)
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
        metadata = dict(post.metadata or {})
        metadata["generation_status"] = "READY"
        metadata["generation_error"] = ""
        post.metadata = metadata
        post.save(update_fields=["metadata", "updated_at"])
        logger.info("Successfully generated post variants for post %s", post_id)
        return {"status": "READY", "post_id": post_id}
    except Exception as exc:
        logger.exception("Failed to generate post variants for post %s: %s", post_id, exc)
        post.refresh_from_db()
        metadata = dict(post.metadata or {})
        metadata["generation_status"] = "FAILED"
        metadata["generation_error"] = str(exc)
        post.metadata = metadata
        post.save(update_fields=["metadata", "updated_at"])
        return {"status": "FAILED", "post_id": post_id, "error": str(exc)}


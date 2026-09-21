import hashlib
import hmac
import json
import logging
import re
from urllib.parse import quote

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import IntegrityError, models, transaction
from django.utils import timezone

logger = logging.getLogger(__name__)

from integrations.social.models import (
    ConnectionState,
    EngagementAutomation,
    EngagementAutomationKind,
    EngagementAutomationStatus,
    EngagementCampaign,
    EngagementCampaignStatus,
    EngagementContact,
    EngagementItemKind,
    EngagementReviewItem,
    EngagementReviewStatus,
    EngagementWebhookEvent,
    SocialConnection,
    SocialNetwork,
    SocialProvider,
)
from integrations.social.publishing.errors import (
    ProviderAuthenticationError,
    ProviderConfigurationError,
    ProviderValidationError,
    PublishingProviderError,
)
from integrations.social.publishing.zernio import ZernioProvider, zernio_platform_slug


def _member_name(user):
    if user is None:
        return "Unassigned"
    return user.get_full_name() or user.get_username()


def _provider_id(payload, *keys):
    for key in keys:
        value = payload.get(key)
        if value not in (None, ""):
            return str(value)
    return ""


def _provider_object_id(payload):
    if not isinstance(payload, dict):
        return ""
    return _provider_id(payload, "id", "_id", "messageId", "commentId", "contactId")


def _extract_provider_result(payload, key):
    item = payload.get(key) if isinstance(payload, dict) else None
    if isinstance(item, dict):
        return _provider_object_id(item)
    data = payload.get("data") if isinstance(payload, dict) else None
    if isinstance(data, dict):
        return _provider_id(data, f"{key}Id", "id", "_id", "messageId", "commentId")
    return ""


def _safe_error(error):
    if isinstance(error, PublishingProviderError):
        return str(error)[:500]
    return "The provider could not complete this action. Try again."


def serialize_review(item):
    connection = item.connection
    contact = item.contact
    return {
        "id": str(item.id),
        "connection_id": str(item.connection_id) if item.connection_id else "",
        "account_name": connection.display_name if connection else "Account unavailable",
        "account_type": connection.account_type if connection else "",
        "platform": connection.network.lower() if connection else "instagram",
        "kind": item.get_kind_display(),
        "status": item.status,
        "person": (contact.display_name or contact.handle) if contact else "Social contact",
        "handle": contact.handle if contact else "",
        "source": item.source_label,
        "received_at": item.created_at.isoformat(),
        "incoming": item.incoming_text,
        "draft": item.final_text or item.suggested_text,
        "assignee_id": str(item.assignee_id) if item.assignee_id else "",
        "assignee": _member_name(item.assignee),
        "error": item.error_message,
        "can_send": not (
            connection
            and connection.network == SocialNetwork.LINKEDIN
            and item.kind in {EngagementItemKind.DIRECT_MESSAGE, EngagementItemKind.STORY_REPLY}
        ),
    }


def serialize_automation(item):
    return {
        "id": str(item.id),
        "connection_id": str(item.connection_id),
        "platform": item.connection.network.lower(),
        "name": item.name,
        "kind": item.kind,
        "type": item.get_kind_display(),
        "status": item.status,
        "state": item.get_status_display(),
        "keywords": item.keywords,
        "match_mode": item.match_mode,
        "dm_message": item.approved_dm_message,
        "comment_reply": item.approved_comment_reply,
        "configuration": item.configuration,
        "runs": int(item.stats.get("runs", 0)),
        "owner_id": str(item.owner_id) if item.owner_id else "",
        "owner": _member_name(item.owner),
        "error": item.last_error,
    }


def serialize_campaign(item):
    audience = item.audience if isinstance(item.audience, dict) else {}
    return {
        "id": str(item.id),
        "connection_id": str(item.connection_id),
        "platform": item.connection.network.lower(),
        "name": item.name,
        "status": item.status,
        "state": item.get_status_display(),
        "audience": {
            "contact_ids": audience.get("contact_ids", []),
            "label": audience.get("label", ""),
        },
        "steps": item.steps,
        "provider_sequence_id": item.provider_sequence_id,
        "owner_id": str(item.owner_id) if item.owner_id else "",
        "owner": _member_name(item.owner),
        "stats": item.stats,
        "error": item.last_error,
    }


def serialize_connection(connection):
    return {
        "id": str(connection.id),
        "platform": connection.network.lower(),
        "name": connection.display_name,
        "account_type": connection.account_type,
        "connected": connection.status == ConnectionState.CONNECTED,
        "engagement_supported": (
            connection.provider == SocialProvider.ZERNIO
            and connection.status == ConnectionState.CONNECTED
            and connection.network in {SocialNetwork.INSTAGRAM, SocialNetwork.LINKEDIN}
        ),
    }


def engagement_analytics(workspace):
    reviews = EngagementReviewItem.objects.filter(workspace=workspace)
    campaigns = EngagementCampaign.objects.filter(workspace=workspace)
    automations = EngagementAutomation.objects.filter(workspace=workspace)
    sent = reviews.filter(status=EngagementReviewStatus.SENT).count()
    pending = reviews.filter(status__in=[EngagementReviewStatus.PENDING, EngagementReviewStatus.FAILED]).count()
    conversations = EngagementContact.objects.filter(workspace=workspace).count()
    campaign_runs = sum(int(row.stats.get("enrolled", 0)) for row in campaigns.only("stats"))
    automation_runs = sum(int(row.stats.get("runs", 0)) for row in automations.only("stats"))
    reply_rate = round((sent / conversations) * 100) if conversations else 0
    sources = []
    for kind, label in EngagementAutomationKind.choices:
        count = sum(
            int(row.stats.get("runs", 0))
            for row in automations.filter(kind=kind).only("stats")
        )
        sources.append({"label": label, "value": count})
    return {
        "conversations_started": conversations + campaign_runs,
        "replies_approved": sent,
        "pending_reviews": pending,
        "reply_rate": reply_rate,
        "link_clicks": sum(int(row.stats.get("clicks", 0)) for row in automations.only("stats")),
        "automation_runs": automation_runs,
        "sources": sources,
    }


class EngagementProvider:
    def __init__(self, provider=None):
        self.provider = provider or ZernioProvider()

    @staticmethod
    def _require_connection(connection, *, instagram_only=False):
        if connection.provider != SocialProvider.ZERNIO or connection.status != ConnectionState.CONNECTED:
            raise ValidationError("Connect this account with Zernio before using engagement actions.")
        if not connection.provider_profile_id or not connection.provider_account_id:
            raise ValidationError("Reconnect this account before using engagement actions.")
        if instagram_only and connection.network != SocialNetwork.INSTAGRAM:
            raise ValidationError("This action is available for Instagram accounts only.")

    def send_review(self, item):
        connection = item.connection
        if connection is None:
            raise ValidationError("The connected account is no longer available.")
        self._require_connection(connection)
        text = (item.final_text or item.suggested_text).strip()
        if not text:
            raise ValidationError("Add a reply before approving it.")
        if connection.network == SocialNetwork.LINKEDIN and item.kind != EngagementItemKind.COMMENT_REPLY:
            raise ValidationError("LinkedIn personal messages must be copied and sent manually.")
        headers = {"Idempotency-Key": str(item.id)}
        if item.metadata.get("private_reply"):
            self._require_connection(connection, instagram_only=True)
            if not item.provider_post_id or not item.provider_comment_id:
                raise ValidationError("This private reply no longer has a valid comment target.")
            _, payload = self.provider._request(
                "POST",
                f"/v1/inbox/comments/{quote(item.provider_post_id, safe='')}/{quote(item.provider_comment_id, safe='')}/private-reply",
                json={"accountId": connection.provider_account_id, "message": text},
                headers=headers,
                allowed_statuses={200},
            )
            return _extract_provider_result(payload, "message")
        if item.kind == EngagementItemKind.COMMENT_REPLY:
            if not item.provider_post_id:
                raise ValidationError("This reply no longer has a valid post target.")
            body = {"accountId": connection.provider_account_id, "message": text}
            if item.provider_comment_id:
                body["commentId"] = item.provider_comment_id
            _, payload = self.provider._request(
                "POST",
                f"/v1/inbox/comments/{quote(item.provider_post_id, safe='')}",
                json=body,
                headers=headers,
                allowed_statuses={200},
            )
            return _extract_provider_result(payload, "comment")
        if not item.conversation_id:
            raise ValidationError("This conversation is no longer available.")
        _, payload = self.provider._request(
            "POST",
            f"/v1/inbox/conversations/{quote(item.conversation_id, safe='')}/messages",
            json={"accountId": connection.provider_account_id, "message": text},
            headers=headers,
            allowed_statuses={200},
        )
        return _extract_provider_result(payload, "message")

    def create_sequence(self, campaign):
        connection = campaign.connection
        self._require_connection(connection, instagram_only=True)
        provider_steps = []
        for index, step in enumerate(campaign.steps):
            text = str(step.get("message") or step.get("text") or "").strip()
            if not text:
                raise ValidationError(f"Campaign step {index + 1} needs a message.")
            delay_minutes = int(step.get("delay_minutes", step.get("delayMinutes", 0)))
            if delay_minutes < 0:
                raise ValidationError("Campaign delays cannot be negative.")
            provider_steps.append({"order": index, "delayMinutes": delay_minutes, "message": {"text": text}})
        if not provider_steps:
            raise ValidationError("Add at least one campaign message.")
        _, payload = self.provider._request(
            "POST",
            "/v1/sequences",
            json={
                "profileId": connection.provider_profile_id,
                "accountId": connection.provider_account_id,
                "platform": zernio_platform_slug(SocialNetwork.INSTAGRAM),
                "name": campaign.name,
                "description": "Human-approved engagement campaign",
                "steps": provider_steps,
                "exitOnReply": True,
                "exitOnUnsubscribe": True,
            },
            headers={"Idempotency-Key": str(campaign.id)},
            allowed_statuses={200, 201},
        )
        sequence = payload.get("sequence") if isinstance(payload.get("sequence"), dict) else {}
        sequence_id = _provider_object_id(sequence)
        if not sequence_id:
            raise ProviderValidationError("The campaign provider did not return a sequence identifier.")
        return sequence_id

    def start_sequence(self, campaign):
        contact_ids = campaign.audience.get("provider_contact_ids") if isinstance(campaign.audience, dict) else []
        contact_ids = [str(value) for value in contact_ids if str(value).strip()]
        if not contact_ids:
            raise ValidationError("Select at least one eligible Instagram contact before starting.")
        sequence_id = quote(campaign.provider_sequence_id, safe="")
        self.provider._request(
            "POST",
            f"/v1/sequences/{sequence_id}/enroll",
            json={"contactIds": contact_ids},
            allowed_statuses={200},
        )
        self.provider._request("POST", f"/v1/sequences/{sequence_id}/activate", json={}, allowed_statuses={200})
        return len(contact_ids)

    def pause_sequence(self, campaign):
        self.provider._request(
            "POST",
            f"/v1/sequences/{quote(campaign.provider_sequence_id, safe='')}/pause",
            json={},
            allowed_statuses={200},
        )


def approve_and_send(item, actor, provider=None):
    if item.status not in {EngagementReviewStatus.PENDING, EngagementReviewStatus.FAILED}:
        raise ValidationError("This item is no longer waiting for approval.")
    item.status = EngagementReviewStatus.SENDING
    item.final_text = (item.final_text or item.suggested_text).strip()
    item.approved_by = actor
    item.approved_at = timezone.now()
    item.error_message = ""
    item.save(update_fields=["status", "final_text", "approved_by", "approved_at", "error_message", "updated_at"])
    try:
        item.provider_message_id = EngagementProvider(provider).send_review(item)
    except (ValidationError, PublishingProviderError) as error:
        item.status = EngagementReviewStatus.FAILED
        item.error_message = _safe_error(error)
        item.save(update_fields=["status", "error_message", "updated_at"])
        raise
    item.status = EngagementReviewStatus.SENT
    item.sent_at = timezone.now()
    item.save(update_fields=["status", "provider_message_id", "sent_at", "updated_at"])
    return item


def approve_automation(automation, actor):
    if not automation.approved_dm_message.strip():
        raise ValidationError("Add the exact approved DM before activating this automation.")
    if automation.kind in {
        EngagementAutomationKind.COMMENT_TO_DM,
        EngagementAutomationKind.DM_KEYWORD,
    } and not automation.keywords:
        raise ValidationError("Add at least one trigger keyword.")
    if automation.connection.network != SocialNetwork.INSTAGRAM:
        raise ValidationError("Engagement automations are available for Instagram accounts only.")
    EngagementProvider._require_connection(automation.connection, instagram_only=True)
    automation.status = EngagementAutomationStatus.ACTIVE
    automation.approved_by = actor
    automation.approved_at = timezone.now()
    automation.last_error = ""
    automation.save(update_fields=["status", "approved_by", "approved_at", "last_error", "updated_at"])
    return automation


def approve_campaign(campaign, actor, provider=None):
    sequence_id = EngagementProvider(provider).create_sequence(campaign)
    campaign.provider_sequence_id = sequence_id
    campaign.status = EngagementCampaignStatus.APPROVED
    campaign.approved_by = actor
    campaign.approved_at = timezone.now()
    campaign.last_error = ""
    campaign.save(update_fields=[
        "provider_sequence_id", "status", "approved_by", "approved_at", "last_error", "updated_at"
    ])
    return campaign


def _keyword_matches(automation, text):
    candidate = (text or "").casefold().strip()
    if not automation.keywords:
        # If no keywords are configured, match any response for STORY_REPLY
        return automation.kind == EngagementAutomationKind.STORY_REPLY
    for keyword in automation.keywords:
        keyword = str(keyword).casefold().strip()
        if not keyword:
            continue
        if keyword in {"*", "all", "any"}:
            return True
        if automation.match_mode == "exact" and candidate == keyword:
            return True
        if automation.match_mode == "word" and re.search(rf"(?<!\w){re.escape(keyword)}(?!\w)", candidate):
            return True
        if automation.match_mode == "contains" and keyword in candidate:
            return True
    return False


def _automation_for(connection, kind, text):
    candidates = EngagementAutomation.objects.filter(
        connection=connection,
        kind=kind,
        status=EngagementAutomationStatus.ACTIVE,
    ).order_by("created_at")
    matched = next((row for row in candidates if _keyword_matches(row, text)), None)
    if matched:
        return matched
    # Fallback 1: If searching for STORY_REPLY and none matched, check DM_KEYWORD on the same account
    if kind == EngagementAutomationKind.STORY_REPLY:
        dm_candidates = EngagementAutomation.objects.filter(
            connection=connection,
            kind=EngagementAutomationKind.DM_KEYWORD,
            status=EngagementAutomationStatus.ACTIVE,
        ).order_by("created_at")
        matched = next((row for row in dm_candidates if _keyword_matches(row, text)), None)
        if matched:
            return matched
    # Fallback 2: If searching for DM_KEYWORD and none matched, check STORY_REPLY with matching keyword
    elif kind == EngagementAutomationKind.DM_KEYWORD:
        story_candidates = EngagementAutomation.objects.filter(
            connection=connection,
            kind=EngagementAutomationKind.STORY_REPLY,
            status=EngagementAutomationStatus.ACTIVE,
        ).order_by("created_at")
        matched = next((row for row in story_candidates if _keyword_matches(row, text)), None)
        if matched:
            return matched
    return None


def _generic_suggestion(kind, name):
    first_name = (name or "there").split()[0]
    if kind == EngagementItemKind.COMMENT_REPLY:
        return f"Thanks for the question, {first_name}. We’d be happy to help — we’ll share the details shortly."
    return f"Hi {first_name}! Thanks for reaching out. I can help with that — what would you like to know first?"


def generate_reply_suggestion(item, router=None):
    """Generate editable reply copy; provider delivery remains a separate approval action."""
    fallback = _generic_suggestion(item.kind, item.contact.display_name if item.contact else "")
    connection = item.connection
    if connection is None:
        return fallback
    try:
        if router is None:
            from llm.router import IntelligentRouter
            router = IntelligentRouter()
        result = router.generate(
            system_prompt=(
                "You write concise social-media customer replies for a human reviewer. Return only the reply text. "
                "Never claim an action was completed, never invent product facts, and do not use markdown. "
                "Ask one useful clarifying question when context is missing."
            ),
            prompt=(
                f"Platform: {connection.get_network_display()}\n"
                f"Reply type: {item.get_kind_display()}\n"
                f"Person: {(item.contact.display_name or item.contact.handle) if item.contact else 'Customer'}\n"
                f"Incoming message: {item.incoming_text}\n"
                "Write one warm, natural reply under 700 characters."
            ),
        )
        text = str(result.get("text") or "").strip().strip('"') if result.get("type") == "text" else ""
        if text:
            return text[:4000]
    except Exception:
        pass
    return fallback


def _nested(payload, key):
    value = payload.get(key)
    return value if isinstance(value, dict) else {}


def _network_for(connection):
    return connection.network


def _resolve_automation_actor(automation, connection):
    actor = automation.owner or automation.approved_by
    if not actor:
        membership = connection.workspace.memberships.filter(is_active=True).first()
        if membership:
            actor = membership.user
    return actor


def _dispatch_automation_reply(item, actor, provider=None):
    if item is None:
        return
    try:
        approve_and_send(item, actor, provider=provider)
    except Exception as exc:
        logger.warning("Auto-send failed for review item %s: %s", getattr(item, "id", None), exc)


@transaction.atomic
def process_engagement_webhook(headers, body, provider=None):
    secret = settings.ZERNIO_WEBHOOK_SECRET
    if not secret:
        raise ProviderConfigurationError("Webhook verification is not configured.")
    normalized_headers = {str(key).lower(): str(value) for key, value in headers.items()}
    supplied = normalized_headers.get("x-zernio-signature") or normalized_headers.get("x-late-signature") or ""
    expected = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    if not supplied or not hmac.compare_digest(supplied.lower(), expected):
        raise ProviderAuthenticationError("The webhook signature is invalid.")
    try:
        payload = json.loads(body)
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ProviderValidationError("The webhook body is invalid.") from exc
    if not isinstance(payload, dict):
        raise ProviderValidationError("The webhook body is invalid.")

    raw_event_type = str(payload.get("event") or normalized_headers.get("x-zernio-event") or "")
    event_id = str(payload.get("id") or normalized_headers.get("x-zernio-event-id") or "")
    normalized_event = raw_event_type.lower().strip()
    is_explicit_story_event = False
    if normalized_event in {"comment.received", "comment_received", "comments", "comment"}:
        event_type = "comment.received"
    elif normalized_event in {
        "message.received", "message_received", "messages", "message",
        "story_reply.received", "story.reply", "story_reply", "story"
    }:
        if normalized_event in {"story_reply.received", "story.reply", "story_reply", "story"}:
            is_explicit_story_event = True
        event_type = "message.received"
    else:
        return []

    if not event_id:
        raise ProviderValidationError("The webhook event identifier is missing.")

    account = _nested(payload, "account")
    message = _nested(payload, "message")
    comment = _nested(payload, "comment")
    conversation = _nested(payload, "conversation")
    account_id = (
        _provider_id(account, "accountId", "account_id", "id", "_id")
        or (str(payload["account"]).strip() if isinstance(payload.get("account"), (str, int)) and str(payload["account"]).strip() else "")
        or _provider_id(message, "accountId", "account_id")
        or _provider_id(comment, "accountId", "account_id")
        or _provider_id(payload, "accountId", "account_id")
    )
    connection = SocialConnection.objects.filter(
        provider=SocialProvider.ZERNIO,
        status=ConnectionState.CONNECTED,
    ).filter(
        models.Q(provider_account_id=account_id) | models.Q(provider_profile_id=account_id)
    ).select_related("workspace").first()
    if connection is None:
        raise ProviderAuthenticationError("The webhook account is not connected to a workspace.")

    try:
        EngagementWebhookEvent.objects.create(
            provider_event_id=event_id,
            event_type=event_type,
            account_id=account_id,
            payload_fingerprint=hashlib.sha256(body).hexdigest(),
        )
    except IntegrityError:
        return []

    author = _nested(message or comment, "author")
    contact_payload = _nested(payload, "contact") or author
    contact_id = (
        _provider_object_id(contact_payload)
        or _provider_id(contact_payload, "id", "_id", "senderId", "sender_id", "fromId", "from_id", "authorId", "author_id", "contactId", "contact_id")
        or _provider_id(message, "senderId", "sender_id", "fromId", "from_id", "authorId", "author_id", "contactId", "contact_id")
        or _provider_id(comment, "authorId", "author_id", "senderId", "sender_id", "contactId", "contact_id")
        or _provider_id(payload, "senderId", "sender_id", "fromId", "from_id", "contactId", "contact_id")
        or f"event:{event_id}"
    )
    display_name = _provider_id(contact_payload, "name", "displayName", "fullName", "username") or "Social contact"
    handle = _provider_id(contact_payload, "username", "handle")
    if handle and not handle.startswith("@") and connection.network == SocialNetwork.INSTAGRAM:
        handle = f"@{handle}"
    contact, _ = EngagementContact.objects.update_or_create(
        workspace=connection.workspace,
        platform=_network_for(connection),
        provider_contact_id=contact_id,
        defaults={"display_name": display_name, "handle": handle},
    )

    created = []
    if event_type == "comment.received":
        text = (
            _provider_id(comment, "message", "text", "content")
            or (str(payload.get("comment")).strip() if isinstance(payload.get("comment"), str) else "")
            or _provider_id(payload, "message", "text", "content")
        )
        post = _nested(payload, "post")
        post_id = (
            _provider_object_id(post)
            or _provider_id(post, "id", "_id", "postId", "post_id")
            or _provider_id(comment, "postId", "post_id")
            or _provider_id(payload, "postId", "post_id")
        )
        comment_id = (
            _provider_object_id(comment)
            or _provider_id(comment, "id", "_id", "commentId", "comment_id")
            or _provider_id(payload, "commentId", "comment_id")
        )
        automation = _automation_for(connection, EngagementAutomationKind.COMMENT_TO_DM, text)
        public_suggestion = (
            automation.approved_comment_reply.strip()
            if automation and automation.approved_comment_reply.strip()
            else _generic_suggestion(EngagementItemKind.COMMENT_REPLY, display_name)
        )
        public_item = EngagementReviewItem.objects.create(
            workspace=connection.workspace,
            connection=connection,
            contact=contact,
            kind=EngagementItemKind.COMMENT_REPLY,
            source_label="Comment keyword" if automation else "Social comment",
            incoming_text=text,
            suggested_text=public_suggestion,
            provider_post_id=post_id,
            provider_comment_id=comment_id,
            provider_event_id=event_id,
            assignee=automation.owner if automation else None,
            metadata={"automation_id": str(automation.id)} if automation else {},
        )
        created.append(public_item)
        if automation:
            private_item = EngagementReviewItem.objects.create(
                workspace=connection.workspace,
                connection=connection,
                contact=contact,
                kind=EngagementItemKind.DIRECT_MESSAGE,
                source_label=f"{automation.name} · private reply",
                incoming_text=text,
                suggested_text=automation.approved_dm_message,
                provider_post_id=post_id,
                provider_comment_id=comment_id,
                provider_event_id=f"{event_id}:private",
                assignee=automation.owner,
                metadata={"automation_id": str(automation.id), "private_reply": True},
            )
            automation.stats = {**automation.stats, "runs": int(automation.stats.get("runs", 0)) + 1}
            automation.save(update_fields=["stats", "updated_at"])
            created.append(private_item)

            actor = _resolve_automation_actor(automation, connection)
            if automation.approved_comment_reply.strip():
                public_item.final_text = automation.approved_comment_reply.strip()
                public_item.save(update_fields=["final_text", "updated_at"])
                _dispatch_automation_reply(public_item, actor, provider=provider)
            if automation.approved_dm_message.strip():
                private_item.final_text = automation.approved_dm_message.strip()
                private_item.save(update_fields=["final_text", "updated_at"])
                _dispatch_automation_reply(private_item, actor, provider=provider)
        return created

    # Zernio and Meta send Instagram story/referral context in various locations:
    # 1. payload/message metadata dict
    # 2. Meta Graph API: message.reply_to.story or message.replyTo.story
    # 3. Zernio top-level or message-level story/storyReply/story_reply object
    metadata = {
        **_nested(message, "metadata"),
        **_nested(payload, "metadata"),
    }
    reply_to = (
        _nested(message, "reply_to")
        or _nested(message, "replyTo")
        or _nested(payload, "reply_to")
        or _nested(payload, "replyTo")
        or _nested(metadata, "reply_to")
        or _nested(metadata, "replyTo")
    )
    story_context = (
        _nested(payload, "story")
        or _nested(message, "story")
        or _nested(payload, "storyReply")
        or _nested(message, "storyReply")
        or _nested(payload, "story_reply")
        or _nested(message, "story_reply")
        or _nested(reply_to, "story")
        or _nested(metadata, "story")
        or _nested(metadata, "storyReply")
        or _nested(metadata, "story_reply")
    )
    story_id = (
        _provider_id(story_context, "id", "_id", "storyId", "story_id")
        or _provider_id(metadata, "storyId", "story_id")
        or _provider_id(message, "storyId", "story_id")
        or _provider_id(payload, "storyId", "story_id")
        or _provider_id(reply_to, "storyId", "story_id")
    )
    text = (
        _provider_id(message, "message", "text", "content")
        or (str(payload.get("message")).strip() if isinstance(payload.get("message"), str) else "")
        or _provider_id(payload, "message", "text", "content")
    )
    conversation_id = (
        _provider_object_id(conversation)
        or _provider_id(conversation, "id", "_id", "conversationId", "conversation_id")
        or (str(payload.get("conversation")).strip() if isinstance(payload.get("conversation"), str) else "")
        or _provider_id(message, "conversationId", "conversation_id", "threadId", "thread_id")
        or _provider_id(payload, "conversationId", "conversation_id", "threadId", "thread_id")
    )
    is_story = bool(
        is_explicit_story_event
        or story_id
        or story_context
        or metadata.get("storyReply")
        or metadata.get("story_reply")
        or metadata.get("isStoryReply")
        or metadata.get("is_story_reply")
        or message.get("storyReply")
        or message.get("story_reply")
        or payload.get("storyReply")
        or payload.get("story_reply")
        or bool(reply_to.get("story"))
        or str(metadata.get("source") or "").lower() in {"story", "story_reply", "storyreply"}
        or str(message.get("source") or "").lower() in {"story", "story_reply", "storyreply"}
        or str(payload.get("source") or "").lower() in {"story", "story_reply", "storyreply"}
        or str(metadata.get("type") or "").lower() in {"story", "story_reply", "storyreply"}
        or str(message.get("type") or "").lower() in {"story", "story_reply", "storyreply"}
        or str(payload.get("type") or "").lower() in {"story", "story_reply", "storyreply"}
    )
    is_ad = bool(
        metadata.get("adId")
        or metadata.get("referral")
        or metadata.get("ad")
        or payload.get("adId")
        or message.get("adId")
    )
    automation_kind = (
        EngagementAutomationKind.STORY_REPLY
        if is_story
        else EngagementAutomationKind.CLICK_TO_DM
        if is_ad
        else EngagementAutomationKind.DM_KEYWORD
    )
    automation = _automation_for(connection, automation_kind, text)
    kind = EngagementItemKind.STORY_REPLY if (is_story or (automation and automation.kind == EngagementAutomationKind.STORY_REPLY)) else EngagementItemKind.DIRECT_MESSAGE
    source_title = (
        automation.name
        if automation
        else ("Story reply" if kind == EngagementItemKind.STORY_REPLY else "Direct message")
    )
    item = EngagementReviewItem.objects.create(
        workspace=connection.workspace,
        connection=connection,
        contact=contact,
        kind=kind,
        source_label=source_title,
        incoming_text=text,
        suggested_text=automation.approved_dm_message if automation else _generic_suggestion(kind, display_name),
        conversation_id=conversation_id,
        provider_event_id=event_id,
        assignee=automation.owner if automation else None,
        metadata={"automation_id": str(automation.id)} if automation else {},
    )
    if automation:
        automation.stats = {**automation.stats, "runs": int(automation.stats.get("runs", 0)) + 1}
        automation.save(update_fields=["stats", "updated_at"])
        actor = _resolve_automation_actor(automation, connection)
        if automation.approved_dm_message.strip():
            item.final_text = automation.approved_dm_message.strip()
            item.save(update_fields=["final_text", "updated_at"])
            _dispatch_automation_reply(item, actor, provider=provider)
    return [item]

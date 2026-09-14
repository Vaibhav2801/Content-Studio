import hashlib
import hmac
import secrets
from datetime import timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from django.conf import settings as django_settings
from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone
from django.utils.dateparse import parse_time

from integrations.linkedin.models import LinkedInAutomationSettings, LinkedInPost
from integrations.social.models import (
    ConnectionState,
    ContentStudioOnboarding,
    SocialAccountType,
    SocialConnection,
    SocialNetwork,
    SocialPost,
)
from integrations.social.publishing.errors import PublishingProviderError
from integrations.social.publishing.registry import publishing_provider_registry
from integrations.social.publishing.types import (
    CompleteConnectionRequest,
    ConnectionUrlRequest,
    ListSocialAccountsRequest,
    ProviderName,
    PublishingNetwork,
)
from integrations.social.services.linkedin_compat import sync_settings
from integrations.social.services.publishing_routing import provider_readiness, selected_provider


STEP_COUNT = 4


def connection_start_error_message(error):
    if error.safe_details.get("error_code") in {"PROFILE_LIMIT_REACHED", "PROFILE_BLOCKED"}:
        return "The social connection service has reached its account limit. Ask the administrator to free a profile slot or increase the plan limit."
    return {
        "CONFIGURATION": "Social account connection is not configured. Ask the workspace administrator to check the connection settings.",
        "AUTHENTICATION": "The connection service could not authenticate. Ask the workspace administrator to check its credentials.",
        "VALIDATION": "The connection request was rejected. Check the social account settings and return URL.",
        "RATE_LIMIT": "The connection service is busy. Wait a few minutes and try again.",
    }.get(error.category.value, "The social account connection step could not start. Try again.")
ACCOUNT_TYPE_LABELS = {
    SocialAccountType.ORGANIZATION: "Company Page",
    SocialAccountType.PERSON: "Profile",
    SocialAccountType.CREATOR: "Creator account",
    SocialAccountType.BUSINESS: "Business account",
}


def onboarding_for(workspace):
    onboarding, created = ContentStudioOnboarding.objects.get_or_create(workspace=workspace)
    if created:
        legacy = LinkedInAutomationSettings.objects.filter(workspace=workspace).first()
        established = bool(legacy and (
            legacy.page_name not in {"", "Your business"}
            or legacy.company_description
            or legacy.audience
            or legacy.content_pillars
            or legacy.briefs.exists()
            or legacy.posts.exists()
        ))
        if established:
            now = timezone.now()
            onboarding.current_step = STEP_COUNT
            onboarding.completed_steps = [1, 2, 3, 4]
            onboarding.draft_only_mode = not SocialConnection.objects.filter(
                workspace=workspace,
                network=SocialNetwork.LINKEDIN,
                provider=selected_provider(workspace).value,
                status=ConnectionState.CONNECTED,
            ).exists()
            onboarding.started_at = now
            onboarding.completed_at = now
            onboarding.save()
    return onboarding


def _legacy_settings(workspace):
    settings, _ = LinkedInAutomationSettings.objects.get_or_create(
        workspace=workspace,
        defaults={
            "page_name": "Your business",
            "company_description": "",
            "audience": "",
            "content_pillars": [],
            "calls_to_action": [],
            "schedule_days": [0, 1, 2, 3, 4],
        },
    )
    return settings


def _connection_for(workspace):
    return SocialConnection.objects.filter(
        workspace=workspace,
        network__in=[SocialNetwork.LINKEDIN, SocialNetwork.INSTAGRAM],
        provider=selected_provider(workspace).value,
    ).order_by(
        models_connection_priority(), "-updated_at"
    ).first()


def models_connection_priority():
    from django.db.models import Case, IntegerField, Value, When

    return Case(
        When(status=ConnectionState.CONNECTED, then=Value(0)),
        When(status=ConnectionState.CONNECTING, then=Value(1)),
        default=Value(2),
        output_field=IntegerField(),
    )


def _connection_data(connection, onboarding):
    if connection is None:
        pending_expired = bool(
            onboarding.connection_expires_at
            and onboarding.connection_expires_at <= timezone.now()
        )
        return {
            "connected": False,
            "network": "",
            "status": "",
            "display_name": "",
            "account_type": "",
            "health": "NEEDS_ATTENTION" if onboarding.connection_error or pending_expired else "NOT_CONNECTED",
            "message": (
                "The connection step expired. Choose Reconnect to try again."
                if pending_expired
                else onboarding.connection_error
            ),
        }
    health = "HEALTHY" if connection.status == ConnectionState.CONNECTED else "NEEDS_ATTENTION"
    messages = {
        ConnectionState.ERROR: "The social account connection needs attention. Reconnect to continue.",
        ConnectionState.REVOKED: "Access to this social account has expired. Reconnect to continue.",
        ConnectionState.DISCONNECTED: "This social account is disconnected. Reconnect to continue.",
        ConnectionState.CONNECTING: "The social account connection is still being completed.",
    }
    return {
        "connected": connection.status == ConnectionState.CONNECTED,
        "network": connection.network,
        "status": connection.status,
        "display_name": connection.display_name,
        "account_type": ACCOUNT_TYPE_LABELS.get(connection.account_type, "Social account"),
        "health": health,
        "message": "Connection healthy" if health == "HEALTHY" else messages.get(connection.status, "Reconnect this social account."),
        "last_checked_at": connection.updated_at.isoformat(),
    }


def _network_options(workspace):
    rows = provider_readiness(workspace)
    selected = next((row for row in rows if row.selected), None)
    supported = selected.capabilities.networks if selected and selected.enabled and selected.configured and selected.healthy else frozenset()
    return [
        {"network": network.value, "label": label, "enabled": network in supported}
        for network, label in (
            (PublishingNetwork.LINKEDIN, "LinkedIn"),
            (PublishingNetwork.X, "X"),
            (PublishingNetwork.INSTAGRAM, "Instagram"),
        )
    ]


def serialize_onboarding(onboarding):
    workspace = onboarding.workspace
    legacy = _legacy_settings(workspace)
    return {
        "status": "COMPLETE" if onboarding.completed_at else "NOT_STARTED" if onboarding.started_at is None else "IN_PROGRESS",
        "current_step": onboarding.current_step,
        "completed_steps": onboarding.completed_steps,
        "steps_total": STEP_COUNT,
        "can_skip_connection": bool(django_settings.CONTENT_STUDIO_DRAFT_ONLY_ALLOWED),
        "draft_only_mode": onboarding.draft_only_mode,
        "connection": _connection_data(_connection_for(workspace), onboarding),
        "networks": _network_options(workspace),
        "business": {
            "name": legacy.page_name,
            "description": legacy.company_description,
            "audience": legacy.audience,
            "language": legacy.language,
        },
        "schedule": {
            "topics": legacy.content_pillars,
            "posting_days": legacy.schedule_days,
            "time": legacy.post_time.strftime("%H:%M"),
            "timezone": legacy.timezone,
        },
        "first_post_id": str(onboarding.answers.get("first_post_id") or ""),
        "updated_at": onboarding.updated_at.isoformat(),
    }


@transaction.atomic
def start_onboarding(workspace):
    onboarding = onboarding_for(workspace)
    if onboarding.started_at is None:
        onboarding.started_at = timezone.now()
        onboarding.save(update_fields=["started_at", "updated_at"])
    return onboarding


@transaction.atomic
def set_current_step(workspace, step):
    onboarding = start_onboarding(workspace)
    if step not in {1, 2, 3, 4}:
        raise ValidationError({"current_step": "Choose a step from 1 to 4."})
    onboarding.current_step = step
    onboarding.save(update_fields=["current_step", "updated_at"])
    return onboarding


def _mark_step(onboarding, step):
    onboarding.completed_steps = sorted(set(onboarding.completed_steps) | {step})
    onboarding.current_step = min(STEP_COUNT, step + 1)
    if step == STEP_COUNT:
        onboarding.completed_at = timezone.now()
    onboarding.full_clean()
    onboarding.save()


@transaction.atomic
def complete_step(workspace, step, payload):
    onboarding = start_onboarding(workspace)
    if step not in {1, 2, 3, 4}:
        raise ValidationError({"step": "Choose a step from 1 to 4."})

    legacy = _legacy_settings(workspace)
    if step == 1:
        connected = SocialConnection.objects.filter(
            workspace=workspace,
            network__in=[SocialNetwork.LINKEDIN, SocialNetwork.INSTAGRAM],
            provider=selected_provider(workspace).value,
            status=ConnectionState.CONNECTED,
        ).exists()
        skip = payload.get("skip") is True
        if skip and not django_settings.CONTENT_STUDIO_DRAFT_ONLY_ALLOWED:
            raise ValidationError({"skip": "Connect a social account to continue."})
        if not connected and not skip:
            raise ValidationError({"connection": "Connect a social account or choose draft-only mode to continue."})
        onboarding.draft_only_mode = not connected and skip
    elif step == 2:
        name = str(payload.get("name") or "").strip()
        description = str(payload.get("description") or "").strip()
        audience = str(payload.get("audience") or "").strip()
        language = str(payload.get("language") or "English").strip()
        errors = {}
        if not name:
            errors["name"] = "Enter the business name."
        if not description:
            errors["description"] = "Tell us what the business does."
        if not audience:
            errors["audience"] = "Describe the audience."
        if errors:
            raise ValidationError(errors)
        legacy.page_name = name[:255]
        legacy.company_description = description
        legacy.audience = audience
        legacy.language = language[:50]
        legacy.save(update_fields=["page_name", "company_description", "audience", "language", "updated_at"])
        sync_settings(legacy)
    elif step == 3:
        topics_supplied = "topics" in payload
        topics = payload.get("topics")
        days = payload.get("posting_days")
        post_time = parse_time(str(payload.get("time") or ""))
        timezone_name = str(payload.get("timezone") or "").strip()
        errors = {}
        if topics_supplied and not isinstance(topics, list):
            errors["topics"] = "Content topics must be a list."
        if not isinstance(days, list) or not days or any(not isinstance(day, int) or day < 0 or day > 6 for day in days):
            errors["posting_days"] = "Choose at least one posting day."
        if post_time is None:
            errors["time"] = "Choose a valid posting time."
        if not timezone_name:
            errors["timezone"] = "Choose a timezone."
        else:
            try:
                ZoneInfo(timezone_name)
            except ZoneInfoNotFoundError:
                errors["timezone"] = "Choose a recognized timezone."
        if errors:
            raise ValidationError(errors)
        if topics_supplied:
            legacy.content_pillars = list(dict.fromkeys(str(item).strip() for item in topics if str(item).strip()))
        legacy.schedule_days = sorted(set(days))
        legacy.post_time = post_time
        legacy.timezone = timezone_name[:100]
        legacy.posts_per_week = min(7, max(1, len(legacy.schedule_days)))
        update_fields = ["schedule_days", "post_time", "timezone", "posts_per_week", "updated_at"]
        if topics_supplied:
            update_fields.append("content_pillars")
        legacy.save(update_fields=update_fields)
        sync_settings(legacy)
    else:
        post_id = str(payload.get("post_id") or "").strip()
        post = SocialPost.objects.filter(pk=post_id, workspace=workspace).first()
        if post is None:
            post = LinkedInPost.objects.filter(pk=post_id, settings__workspace=workspace).first()
        if post is None:
            raise ValidationError({"post_id": "Create and review a first post before finishing setup."})
        onboarding.answers = {**onboarding.answers, "first_post_id": str(post.id)}

    _mark_step(onboarding, step)
    return onboarding


@transaction.atomic
def start_connection(workspace, redirect_uri, network=PublishingNetwork.LINKEDIN):
    start_onboarding(workspace)
    onboarding = ContentStudioOnboarding.objects.select_for_update().get(workspace=workspace)
    provider = selected_provider(workspace)
    readiness = next((row for row in provider_readiness(workspace) if row.provider == provider), None)
    if not readiness or not readiness.enabled or not readiness.configured or not readiness.healthy:
        onboarding.connection_error = "Social account connection is not available right now. Try again later."
        onboarding.save(update_fields=["connection_error", "updated_at"])
        raise ValidationError({"connection": onboarding.connection_error})
    try:
        network = PublishingNetwork(network)
    except ValueError as exc:
        raise ValidationError({"network": "Choose a supported social network."}) from exc
    if network not in readiness.capabilities.networks:
        raise ValidationError({"connection": f"{network.value.title()} connection is not available right now."})

    state = secrets.token_urlsafe(32)
    adapter = publishing_provider_registry.create(provider)
    try:
        result = adapter.get_connection_url(ConnectionUrlRequest(
            workspace_id=workspace.id,
            redirect_uri=redirect_uri,
            state=state,
            requested_networks=(network,),
        ))
    except PublishingProviderError as exc:
        onboarding.connection_error = connection_start_error_message(exc)
        onboarding.save(update_fields=["connection_error", "updated_at"])
        raise ValidationError({"connection": onboarding.connection_error}) from exc
    onboarding.connection_provider = provider.value
    onboarding.answers = {**onboarding.answers, "pending_connection_network": network.value, "pending_selection_required": provider == ProviderName.ZERNIO and network == PublishingNetwork.LINKEDIN}
    onboarding.connection_state = hashlib.sha256(state.encode("utf-8")).hexdigest()
    onboarding.connection_expires_at = result.expires_at or timezone.now() + timedelta(minutes=30)
    onboarding.connection_error = ""
    onboarding.save(update_fields=[
        "connection_provider", "answers", "connection_state", "connection_expires_at", "connection_error", "updated_at",
    ])
    return onboarding, result.url


def _pending_connection(workspace, state):
    onboarding_for(workspace)
    onboarding = ContentStudioOnboarding.objects.select_for_update().get(workspace=workspace)
    expired = onboarding.connection_expires_at and onboarding.connection_expires_at <= timezone.now()
    supplied_state = str(state)
    supplied_hash = hashlib.sha256(supplied_state.encode("utf-8")).hexdigest()
    state_matches = bool(onboarding.connection_state) and (
        hmac.compare_digest(onboarding.connection_state, supplied_hash)
        # Allow connection attempts started immediately before this hardening deploy.
        or hmac.compare_digest(onboarding.connection_state, supplied_state)
    )
    if not state_matches or expired:
        onboarding.connection_error = "The connection step expired. Choose Reconnect to try again."
        onboarding.save(update_fields=["connection_error", "updated_at"])
        raise ValidationError({"connection": onboarding.connection_error})
    try:
        provider = ProviderName(onboarding.connection_provider)
    except ValueError as exc:
        raise ValidationError({"connection": "The connection step could not be verified. Start again."}) from exc
    try:
        network = PublishingNetwork(onboarding.answers.get("pending_connection_network", PublishingNetwork.LINKEDIN.value))
    except ValueError as exc:
        raise ValidationError({"connection": "The selected social network is invalid. Start again."}) from exc
    return onboarding, provider, network

@transaction.atomic
def complete_connection(workspace, *, state, authorization_code="", selection_completed=False, expected_account_id=""):
    onboarding, provider, network = _pending_connection(workspace, state)
    if onboarding.answers.get("pending_selection_required") and not selection_completed:
        raise ValidationError({"connection": "Choose a LinkedIn Company Page to finish connecting."})
    adapter = publishing_provider_registry.create(provider)
    try:
        completed = adapter.complete_connection(CompleteConnectionRequest(
            workspace_id=workspace.id,
            redirect_uri="",
            state=state,
            authorization_code=authorization_code,
            network=network,
        ))
        accounts = adapter.list_social_accounts(ListSocialAccountsRequest(
            workspace_id=workspace.id,
            provider_connection_id=completed.provider_connection_id,
            network=network,
        )).accounts
    except PublishingProviderError as exc:
        onboarding.connection_error = f"{network.value.title()} could not be connected. Check access and choose Reconnect."
        onboarding.save(update_fields=["connection_error", "updated_at"])
        raise ValidationError({"connection": onboarding.connection_error}) from exc

    matching_accounts = [account for account in accounts if account.network == network and (not expected_account_id or account.provider_account_id == expected_account_id)]
    if not completed.connected or not matching_accounts:
        onboarding.connection_error = f"No {network.value.title()} account was found. Choose Reconnect and check your access."
        onboarding.save(update_fields=["connection_error", "updated_at"])
        raise ValidationError({"connection": onboarding.connection_error})

    now = timezone.now()
    for account in matching_accounts:
        capabilities = {
            "networks": sorted(item.value for item in account.capabilities.networks),
            "media_types": sorted(item.value for item in account.capabilities.media_types),
            "publish_text": True,
        }
        SocialConnection.objects.update_or_create(
            workspace=workspace,
            network=SocialNetwork(network.value),
            provider=provider.value,
            provider_account_id=account.provider_account_id,
            defaults={
                "provider_profile_id": account.provider_profile_id,
                "display_name": account.display_name,
                "account_type": account.account_type,
                "status": ConnectionState.CONNECTED,
                "capabilities": capabilities,
                "connected_at": now,
                "disconnected_at": None,
            },
        )
    onboarding.draft_only_mode = False
    onboarding.answers = {**{key: value for key, value in onboarding.answers.items() if key not in {"pending_connection_network", "pending_selection_required"}}, "last_connected_network": network.value}
    onboarding.connection_state = ""
    onboarding.connection_expires_at = None
    onboarding.connection_error = ""
    onboarding.save(update_fields=[
        "draft_only_mode", "answers", "connection_state", "connection_expires_at", "connection_error", "updated_at",
    ])
    return onboarding


@transaction.atomic
def pending_linkedin_choices(workspace, *, state, pending_data_token):
    onboarding, provider, network = _pending_connection(workspace, state)
    if provider != ProviderName.ZERNIO or network != PublishingNetwork.LINKEDIN or not onboarding.answers.get("pending_selection_required"):
        raise ValidationError({"connection": "Start a LinkedIn connection to choose a Company Page."})
    adapter = publishing_provider_registry.create(provider)
    try:
        pending = adapter.pending_linkedin_selection(workspace.id, pending_data_token)
    except PublishingProviderError as exc:
        raise ValidationError({"connection": "Could not load LinkedIn Company Pages. Choose Reconnect and try again."}) from exc
    organizations = [
        {"id": str(item.get("id") or ""), "name": str(item.get("name") or item.get("localizedName") or "Company Page"), "vanity_name": str(item.get("vanityName") or "")}
        for item in pending["organizations"] if isinstance(item, dict) and item.get("id")
    ]
    if not organizations:
        raise ValidationError({"connection": "No LinkedIn Company Pages were found. Check Page admin access and reconnect."})
    return organizations


@transaction.atomic
def select_linkedin_choice(workspace, *, state, pending_data_token, organization_id, connect_token=""):
    onboarding, provider, network = _pending_connection(workspace, state)
    if provider != ProviderName.ZERNIO or network != PublishingNetwork.LINKEDIN or not onboarding.answers.get("pending_selection_required"):
        raise ValidationError({"connection": "Start a LinkedIn connection to choose a Company Page."})
    adapter = publishing_provider_registry.create(provider)
    try:
        selected = adapter.select_linkedin_organization(workspace.id, pending_data_token, organization_id, connect_token)
    except PublishingProviderError as exc:
        raise ValidationError({"connection": "Could not connect that Company Page. Check Page admin access and try again."}) from exc
    account = selected.get("account") if isinstance(selected, dict) and isinstance(selected.get("account"), dict) else {}
    account_id = str(account.get("accountId") or account.get("_id") or "")
    if not account_id:
        raise ValidationError({"connection": "The selected Company Page could not be verified. Choose Reconnect and try again."})
    return complete_connection(workspace, state=state, selection_completed=True, expected_account_id=account_id)


@transaction.atomic
def cancel_connection(workspace):
    onboarding = start_onboarding(workspace)
    onboarding.connection_provider = ""
    onboarding.connection_state = ""
    onboarding.connection_expires_at = None
    onboarding.connection_error = "The connection was cancelled. You can reconnect when you are ready."
    onboarding.save(update_fields=[
        "connection_provider", "connection_state", "connection_expires_at", "connection_error", "updated_at",
    ])
    return onboarding

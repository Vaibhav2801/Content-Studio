from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import serializers
from rest_framework.authentication import BasicAuthentication, SessionAuthentication
from rest_framework.generics import GenericAPIView
from rest_framework.response import Response

from integrations.linkedin.workspaces import resolve_active_workspace
from integrations.social.models import (
    ConnectionState,
    EngagementAutomation,
    EngagementAutomationKind,
    EngagementAutomationStatus,
    EngagementCampaign,
    EngagementCampaignStatus,
    EngagementContact,
    EngagementReviewItem,
    EngagementReviewStatus,
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
from integrations.social.services.engagement import (
    EngagementProvider,
    approve_and_send,
    approve_automation,
    approve_campaign,
    engagement_analytics,
    generate_reply_suggestion,
    process_engagement_webhook,
    serialize_automation,
    serialize_campaign,
    serialize_connection,
    serialize_review,
)
from prospecting.models import WorkspaceMembership


class EngagementEnvelopeSerializer(serializers.Serializer):
    pass


def _validation_response(error, status=400):
    if isinstance(error, DjangoValidationError):
        if hasattr(error, "message_dict"):
            return Response(error.message_dict, status=status)
        return Response({"detail": error.messages}, status=status)
    return Response({"detail": str(error)}, status=status)


def _provider_response(error):
    if isinstance(error, ProviderAuthenticationError):
        return Response({"detail": "The connected social account rejected this action. Reconnect it and try again."}, status=401)
    if isinstance(error, ProviderConfigurationError):
        return Response({"detail": "Engagement delivery is not configured."}, status=503)
    if isinstance(error, ProviderValidationError):
        return Response({"detail": str(error)}, status=400)
    return Response({"detail": "The social provider could not complete this action. Try again."}, status=502)


class EngagementWorkspaceAPIView(GenericAPIView):
    authentication_classes = [BasicAuthentication, SessionAuthentication]
    serializer_class = EngagementEnvelopeSerializer

    def workspace(self, request):
        return resolve_active_workspace(request)

    def connected_account(self, request, connection_id, *, instagram_only=False):
        workspace = self.workspace(request)
        connection = get_object_or_404(
            SocialConnection.objects.filter(
                workspace=workspace,
                provider=SocialProvider.ZERNIO,
                status=ConnectionState.CONNECTED,
            ),
            pk=connection_id,
        )
        if instagram_only and connection.network != SocialNetwork.INSTAGRAM:
            raise DjangoValidationError("Choose a connected Instagram account.")
        return connection

    def member_user(self, request, user_id, *, allow_blank=True):
        if not user_id and allow_blank:
            return None
        membership = WorkspaceMembership.objects.select_related("user").filter(
            workspace=self.workspace(request),
            user_id=user_id,
        ).first()
        if membership is None:
            raise DjangoValidationError("Choose a member of this workspace.")
        return membership.user


class EngagementOverviewAPIView(EngagementWorkspaceAPIView):
    def get(self, request):
        workspace = self.workspace(request)
        reviews = EngagementReviewItem.objects.filter(
            workspace=workspace,
            status__in=[EngagementReviewStatus.PENDING, EngagementReviewStatus.FAILED],
        ).select_related("connection", "contact", "assignee")
        automations = EngagementAutomation.objects.filter(workspace=workspace).select_related("connection", "owner")
        campaigns = EngagementCampaign.objects.filter(workspace=workspace).select_related("connection", "owner")
        memberships = WorkspaceMembership.objects.filter(workspace=workspace).select_related("user").order_by("created_at")
        connections = SocialConnection.objects.filter(
            workspace=workspace,
            network__in=[SocialNetwork.INSTAGRAM, SocialNetwork.LINKEDIN],
        ).order_by("network", "display_name")
        return Response({
            "reviews": [serialize_review(item) for item in reviews],
            "automations": [serialize_automation(item) for item in automations],
            "campaigns": [serialize_campaign(item) for item in campaigns],
            "analytics": engagement_analytics(workspace),
            "team": [
                {
                    "id": str(membership.user_id),
                    "name": membership.user.get_full_name() or membership.user.get_username(),
                    "role": membership.role,
                    "is_current_user": membership.user_id == request.user.id,
                }
                for membership in memberships
            ],
            "connections": [serialize_connection(connection) for connection in connections],
            "contacts": [
                {
                    "id": str(contact.id),
                    "platform": contact.platform.lower(),
                    "name": contact.display_name or contact.handle or "Instagram contact",
                    "handle": contact.handle,
                }
                for contact in EngagementContact.objects.filter(
                    workspace=workspace,
                    platform=SocialNetwork.INSTAGRAM,
                ).order_by("display_name", "handle")
            ],
            "policy": {
                "human_approval_required": True,
                "linkedin_personal_messages_manual": True,
            },
        })


class EngagementReviewDetailAPIView(EngagementWorkspaceAPIView):
    def item(self, request, review_id):
        return get_object_or_404(
            EngagementReviewItem.objects.filter(workspace=self.workspace(request)).select_related(
                "connection", "contact", "assignee"
            ),
            pk=review_id,
        )

    def patch(self, request, review_id):
        item = self.item(request, review_id)
        if item.status not in {EngagementReviewStatus.PENDING, EngagementReviewStatus.FAILED}:
            return Response({"detail": "Only items waiting for review can be edited."}, status=409)
        draft = request.data.get("draft")
        if draft is not None:
            draft = str(draft).strip()
            if len(draft) > 4000:
                return Response({"draft": ["Keep the reply under 4,000 characters."]}, status=400)
            item.final_text = draft
        if "assignee_id" in request.data:
            try:
                item.assignee = self.member_user(request, request.data.get("assignee_id"))
            except DjangoValidationError as error:
                return _validation_response(error)
        item.save(update_fields=["final_text", "assignee", "updated_at"])
        return Response(serialize_review(item))

    def post(self, request, review_id):
        action = str(request.data.get("action") or "").upper()
        with transaction.atomic():
            # Lock only the review row. The related fields are nullable, so
            # selecting them here creates outer joins that PostgreSQL cannot
            # include in a FOR UPDATE query.
            item = get_object_or_404(
                EngagementReviewItem.objects.select_for_update().filter(workspace=self.workspace(request)),
                pk=review_id,
            )
            if action == "DISMISS":
                if item.status not in {EngagementReviewStatus.PENDING, EngagementReviewStatus.FAILED}:
                    return Response({"detail": "This item is no longer waiting for review."}, status=409)
                item.status = EngagementReviewStatus.DISMISSED
                item.save(update_fields=["status", "updated_at"])
                return Response(serialize_review(item))
            if action == "GENERATE":
                item.suggested_text = generate_reply_suggestion(item)
                item.final_text = item.suggested_text
                item.error_message = ""
                item.save(update_fields=["suggested_text", "final_text", "error_message", "updated_at"])
                return Response(serialize_review(item))
            if action not in {"APPROVE_SEND", "RETRY"}:
                return Response({"action": ["Choose GENERATE, APPROVE_SEND, RETRY, or DISMISS."]}, status=400)
            if "draft" in request.data:
                item.final_text = str(request.data.get("draft") or "").strip()
            try:
                approve_and_send(item, request.user)
            except DjangoValidationError as error:
                return _validation_response(error)
            except PublishingProviderError as error:
                return _provider_response(error)
        return Response(serialize_review(item))


class EngagementAutomationsAPIView(EngagementWorkspaceAPIView):
    def get(self, request):
        items = EngagementAutomation.objects.filter(workspace=self.workspace(request)).select_related("connection", "owner")
        return Response([serialize_automation(item) for item in items])

    def post(self, request):
        try:
            connection = self.connected_account(request, request.data.get("connection_id"), instagram_only=True)
            owner = self.member_user(request, request.data.get("owner_id")) or request.user
        except DjangoValidationError as error:
            return _validation_response(error)
        kind = str(request.data.get("kind") or "")
        if kind not in EngagementAutomationKind.values:
            return Response({"kind": ["Choose a supported automation type."]}, status=400)
        name = str(request.data.get("name") or "").strip()
        if not name or len(name) > 255:
            return Response({"name": ["Enter a name up to 255 characters."]}, status=400)
        keywords = request.data.get("keywords") or []
        if not isinstance(keywords, list):
            return Response({"keywords": ["Send keywords as a list."]}, status=400)
        keywords = list(dict.fromkeys(str(value).strip() for value in keywords if str(value).strip()))[:25]
        match_mode = str(request.data.get("match_mode") or "contains")
        if match_mode not in {"contains", "word", "exact"}:
            return Response({"match_mode": ["Choose contains, word, or exact."]}, status=400)
        dm_message = str(request.data.get("dm_message") or "").strip()
        comment_reply = str(request.data.get("comment_reply") or "").strip()
        if len(dm_message) > 1000 or len(comment_reply) > 1000:
            return Response({"detail": "Keep each approved message under 1,000 characters."}, status=400)
        configuration = request.data.get("configuration") or {}
        if not isinstance(configuration, dict):
            return Response({"configuration": ["Send configuration as an object."]}, status=400)
        item = EngagementAutomation.objects.create(
            workspace=self.workspace(request),
            connection=connection,
            kind=kind,
            name=name,
            keywords=keywords,
            match_mode=match_mode,
            approved_dm_message=dm_message,
            approved_comment_reply=comment_reply,
            configuration=configuration,
            owner=owner,
        )
        return Response(serialize_automation(item), status=201)


class EngagementAutomationDetailAPIView(EngagementWorkspaceAPIView):
    def item(self, request, automation_id, lock=False):
        queryset = EngagementAutomation.objects.filter(workspace=self.workspace(request))
        if lock:
            # Lock only the automation row. ``owner`` is nullable, so joining it
            # in a FOR UPDATE query makes PostgreSQL reject the outer join.
            queryset = queryset.select_for_update()
        else:
            queryset = queryset.select_related("connection", "owner")
        return get_object_or_404(queryset, pk=automation_id)

    def patch(self, request, automation_id):
        item = self.item(request, automation_id)
        if item.status == EngagementAutomationStatus.ACTIVE:
            return Response({"detail": "Pause this automation before editing it."}, status=409)
        if "name" in request.data:
            name = str(request.data.get("name") or "").strip()
            if not name or len(name) > 255:
                return Response({"name": ["Enter a name up to 255 characters."]}, status=400)
            item.name = name
        if "keywords" in request.data:
            keywords = request.data.get("keywords")
            if not isinstance(keywords, list):
                return Response({"keywords": ["Send keywords as a list."]}, status=400)
            item.keywords = list(dict.fromkeys(str(value).strip() for value in keywords if str(value).strip()))[:25]
        if "match_mode" in request.data:
            match_mode = str(request.data.get("match_mode") or "")
            if match_mode not in {"contains", "word", "exact"}:
                return Response({"match_mode": ["Choose contains, word, or exact."]}, status=400)
            item.match_mode = match_mode
        if "dm_message" in request.data:
            item.approved_dm_message = str(request.data.get("dm_message") or "").strip()
        if "comment_reply" in request.data:
            item.approved_comment_reply = str(request.data.get("comment_reply") or "").strip()
        if "owner_id" in request.data:
            try:
                item.owner = self.member_user(request, request.data.get("owner_id")) or request.user
            except DjangoValidationError as error:
                return _validation_response(error)
        item.status = EngagementAutomationStatus.DRAFT
        item.approved_by = None
        item.approved_at = None
        item.save()
        return Response(serialize_automation(item))

    def post(self, request, automation_id):
        action = str(request.data.get("action") or "").upper()
        with transaction.atomic():
            item = self.item(request, automation_id, lock=True)
            if action == "PAUSE":
                if item.status != EngagementAutomationStatus.ACTIVE:
                    return Response({"detail": "Only active automations can be paused."}, status=409)
                item.status = EngagementAutomationStatus.PAUSED
                item.save(update_fields=["status", "updated_at"])
            elif action in {"APPROVE", "ACTIVATE"}:
                try:
                    approve_automation(item, request.user)
                except DjangoValidationError as error:
                    return _validation_response(error)
            else:
                return Response({"action": ["Choose APPROVE, ACTIVATE, or PAUSE."]}, status=400)
        return Response(serialize_automation(item))


class EngagementCampaignsAPIView(EngagementWorkspaceAPIView):
    def get(self, request):
        items = EngagementCampaign.objects.filter(workspace=self.workspace(request)).select_related("connection", "owner")
        return Response([serialize_campaign(item) for item in items])

    def post(self, request):
        try:
            connection = self.connected_account(request, request.data.get("connection_id"), instagram_only=True)
            owner = self.member_user(request, request.data.get("owner_id")) or request.user
        except DjangoValidationError as error:
            return _validation_response(error)
        name = str(request.data.get("name") or "").strip()
        steps = request.data.get("steps") or []
        audience = request.data.get("audience") or {}
        if not name or len(name) > 255:
            return Response({"name": ["Enter a campaign name up to 255 characters."]}, status=400)
        if not isinstance(steps, list) or not 1 <= len(steps) <= 10:
            return Response({"steps": ["Add between 1 and 10 message steps."]}, status=400)
        if not isinstance(audience, dict):
            return Response({"audience": ["Send the audience as an object."]}, status=400)
        local_contact_ids = audience.get("contact_ids") or []
        if not isinstance(local_contact_ids, list):
            return Response({"audience": ["Choose contacts from this workspace."]}, status=400)
        selected_contacts = list(EngagementContact.objects.filter(
            workspace=self.workspace(request),
            platform=SocialNetwork.INSTAGRAM,
            id__in=local_contact_ids,
        ))
        if len(selected_contacts) != len(set(str(value) for value in local_contact_ids)):
            return Response({"audience": ["One or more selected contacts are unavailable."]}, status=400)
        if not selected_contacts:
            return Response({"audience": ["Choose at least one Instagram contact."]}, status=400)
        normalized_steps = []
        for index, step in enumerate(steps):
            if not isinstance(step, dict):
                return Response({"steps": [f"Step {index + 1} is invalid."]}, status=400)
            message = str(step.get("message") or step.get("text") or "").strip()
            try:
                delay = int(step.get("delay_minutes", step.get("delayMinutes", 0)))
            except (TypeError, ValueError):
                return Response({"steps": [f"Step {index + 1} has an invalid delay."]}, status=400)
            if not message or len(message) > 4000 or delay < 0:
                return Response({"steps": [f"Step {index + 1} needs valid message text and delay."]}, status=400)
            normalized_steps.append({"message": message, "delay_minutes": delay})
        item = EngagementCampaign.objects.create(
            workspace=self.workspace(request),
            connection=connection,
            name=name,
            audience={
                "contact_ids": [str(contact.id) for contact in selected_contacts],
                "provider_contact_ids": [contact.provider_contact_id for contact in selected_contacts],
                "label": str(audience.get("label") or "Selected Instagram contacts")[:255],
            },
            steps=normalized_steps,
            owner=owner,
        )
        return Response(serialize_campaign(item), status=201)


class EngagementCampaignDetailAPIView(EngagementWorkspaceAPIView):
    def item(self, request, campaign_id, lock=False):
        queryset = EngagementCampaign.objects.filter(workspace=self.workspace(request))
        if lock:
            # Lock only the campaign row. ``owner`` is nullable, so joining it
            # in a FOR UPDATE query makes PostgreSQL reject the outer join.
            queryset = queryset.select_for_update()
        else:
            queryset = queryset.select_related("connection", "owner")
        return get_object_or_404(queryset, pk=campaign_id)

    def post(self, request, campaign_id):
        action = str(request.data.get("action") or "").upper()
        with transaction.atomic():
            item = self.item(request, campaign_id, lock=True)
            try:
                if action == "APPROVE":
                    if item.status not in {EngagementCampaignStatus.DRAFT, EngagementCampaignStatus.FAILED}:
                        return Response({"detail": "This campaign has already been approved."}, status=409)
                    approve_campaign(item, request.user)
                elif action == "START":
                    if item.status not in {EngagementCampaignStatus.APPROVED, EngagementCampaignStatus.PAUSED}:
                        return Response({"detail": "Approve this campaign before starting it."}, status=409)
                    enrolled = EngagementProvider().start_sequence(item)
                    item.status = EngagementCampaignStatus.ACTIVE
                    item.stats = {**item.stats, "enrolled": enrolled}
                    item.save(update_fields=["status", "stats", "updated_at"])
                elif action == "PAUSE":
                    if item.status != EngagementCampaignStatus.ACTIVE:
                        return Response({"detail": "Only running campaigns can be paused."}, status=409)
                    EngagementProvider().pause_sequence(item)
                    item.status = EngagementCampaignStatus.PAUSED
                    item.save(update_fields=["status", "updated_at"])
                else:
                    return Response({"action": ["Choose APPROVE, START, or PAUSE."]}, status=400)
            except DjangoValidationError as error:
                return _validation_response(error)
            except PublishingProviderError as error:
                item.last_error = str(error)[:500]
                item.status = EngagementCampaignStatus.FAILED
                item.save(update_fields=["last_error", "status", "updated_at"])
                return _provider_response(error)
        return Response(serialize_campaign(item))


class ZernioEngagementWebhookAPIView(GenericAPIView):
    authentication_classes = []
    permission_classes = []
    serializer_class = EngagementEnvelopeSerializer

    def post(self, request):
        try:
            items = process_engagement_webhook(
                {key: value for key, value in request.headers.items()},
                request.body,
            )
        except ProviderAuthenticationError:
            return Response({"detail": "Invalid engagement callback signature or scope."}, status=401)
        except ProviderValidationError:
            return Response({"detail": "Invalid engagement callback."}, status=400)
        except ProviderConfigurationError:
            return Response({"detail": "Engagement callback is not configured."}, status=503)
        return Response({"accepted": len(items)}, status=202)

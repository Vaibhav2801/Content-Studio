from __future__ import annotations

import hashlib
import hmac
import json
import uuid

from django.conf import settings
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from prospecting.models import Workspace
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from integrations.social.models import BillingInvoice, ConnectionState, SocialConnection
from integrations.social.services.billing import (
    PRICING_CATALOG,
    can_manage_billing,
    generate_invoice_html,
    get_or_create_workspace_billing,
    is_workspace_admin,
    process_billing_event,
    process_billing_product,
    public_pricing_catalog,
)
from integrations.social.views import SocialWorkspaceScopedAPIView


class SimulatedCheckoutSerializer(serializers.Serializer):
    product_id = serializers.ChoiceField(choices=tuple(PRICING_CATALOG["products"].keys()))
    billing_name = serializers.CharField(required=False, allow_blank=True, max_length=255)
    billing_email = serializers.EmailField(required=False, allow_blank=True)


class BillingWebhookSerializer(serializers.Serializer):
    provider = serializers.CharField(required=False, max_length=30)
    event_id = serializers.CharField(max_length=255)
    event_type = serializers.ChoiceField(
        choices=("payment.succeeded", "subscription.renewed", "subscription.cancelled")
    )
    workspace_id = serializers.UUIDField()
    product_id = serializers.CharField(required=False, allow_blank=True, max_length=100)
    payment_reference = serializers.CharField(required=False, allow_blank=True, max_length=255)
    payment_method = serializers.CharField(required=False, allow_blank=True, max_length=100)
    customer_id = serializers.CharField(required=False, allow_blank=True, max_length=255)
    subscription_id = serializers.CharField(required=False, allow_blank=True, max_length=255)
    billing_name = serializers.CharField(required=False, allow_blank=True, max_length=255)
    billing_email = serializers.EmailField(required=False, allow_blank=True)
    current_period_start = serializers.DateTimeField(required=False, allow_null=True)
    current_period_end = serializers.DateTimeField(required=False, allow_null=True)
    cancellation_effective = serializers.ChoiceField(
        choices=("period_end", "immediate"), required=False
    )

    def validate(self, attrs):
        if attrs["event_type"] != "subscription.cancelled" and not attrs.get("product_id"):
            raise serializers.ValidationError({"product_id": "This field is required."})
        return attrs


def _require_billing_manager(workspace, user) -> None:
    if not can_manage_billing(workspace, user):
        raise PermissionDenied("Only an active workspace owner or administrator can manage billing.")


class BillingCatalogAPIView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        catalog = public_pricing_catalog()
        catalog["simulated_checkout_enabled"] = bool(settings.BILLING_SIMULATED_CHECKOUT_ENABLED)
        return Response(catalog)


class SubscriptionOverviewAPIView(SocialWorkspaceScopedAPIView):
    def get(self, request):
        workspace = self.workspace(request)
        user = request.user if request.user.is_authenticated else None
        subscription, account = get_or_create_workspace_billing(workspace, user)
        is_admin = is_workspace_admin(workspace, user)
        manages_billing = can_manage_billing(workspace, user)
        connected_count = SocialConnection.objects.filter(
            workspace=workspace, status=ConnectionState.CONNECTED
        ).count()
        recent_txs = []
        recent_invoices = []
        if manages_billing:
            recent_txs = [{
                "id": str(tx.id), "amount": tx.amount, "action_type": tx.action_type,
                "description": tx.description, "balance_after": tx.balance_after,
                "post_id": str(tx.post_id) if tx.post_id else None,
                "created_at": tx.created_at.isoformat(),
            } for tx in workspace.credit_transactions.all().order_by("-created_at")[:10]]
            recent_invoices = [{
                "id": str(inv.id), "invoice_number": inv.invoice_number,
                "amount": str(inv.amount), "currency": inv.currency, "status": inv.status,
                "title": inv.title, "paid_at": (inv.paid_at or inv.created_at).isoformat(),
                "download_url": f"/api/v3/social/billing/invoices/{inv.id}/download/",
            } for inv in workspace.invoices.all().order_by("-created_at")[:10]]
        costs = PRICING_CATALOG["credit_costs"]
        return Response({
            "tier": "ADMIN" if is_admin else subscription.tier,
            "role_label": "Admin" if is_admin else subscription.get_tier_display(),
            "is_admin": is_admin, "can_manage_billing": manages_billing,
            "connections": {"used": connected_count,
                "limit": 999999 if is_admin else subscription.connections_quota,
                "unlimited": is_admin, "extra_purchased": subscription.extra_connections},
            "credits": {"balance": 999999 if is_admin else account.balance,
                "total_allocated": account.total_allocated, "total_used": account.total_used,
                "unlimited": is_admin, "cost_per_draft": costs["draft"],
                "cost_per_image": costs["image"]},
            "engage_entitled": is_admin or subscription.engage_entitled,
            "scheduling_unlimited": True, "transactions": recent_txs, "invoices": recent_invoices,
        })


class BillingCheckoutAPIView(SocialWorkspaceScopedAPIView):
    """Staff-only local checkout simulator; real entitlements arrive by webhook."""

    def post(self, request):
        workspace = self.workspace(request)
        _require_billing_manager(workspace, request.user)
        if not settings.BILLING_SIMULATED_CHECKOUT_ENABLED or not request.user.is_staff:
            raise PermissionDenied("Simulated checkout is disabled.")
        serializer = SimulatedCheckoutSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        invoice, subscription, account = process_billing_product(
            workspace=workspace, product_id=data["product_id"],
            billing_name=data.get("billing_name", ""), billing_email=data.get("billing_email", ""),
            payment_method="Staff checkout simulator", payment_reference=f"sim_{uuid.uuid4().hex}",
            provider="simulator", user=request.user,
        )
        return Response({"success": True,
            "invoice": {"id": str(invoice.id), "invoice_number": invoice.invoice_number,
                "amount": str(invoice.amount), "status": invoice.status, "title": invoice.title,
                "download_url": f"/api/v3/social/billing/invoices/{invoice.id}/download/"},
            "tier": subscription.tier, "credit_balance": account.balance,
            "connections_limit": subscription.connections_quota,
            "engage_entitled": subscription.engage_entitled})


class BillingPaymentWebhookAPIView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        secret = settings.BILLING_WEBHOOK_SECRET
        if not secret:
            return Response({"error": "Billing webhook is not configured."}, status=503)
        raw_body = request.body
        signature = request.headers.get("X-Billing-Signature", "")
        expected = hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(signature.removeprefix("sha256="), expected):
            return Response({"error": "Invalid webhook signature."}, status=401)
        try:
            payload = json.loads(raw_body.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            return Response({"error": "Invalid JSON payload."}, status=400)
        serializer = BillingWebhookSerializer(data=payload)
        serializer.is_valid(raise_exception=True)
        try:
            invoice, processed = process_billing_event(serializer.validated_data, raw_body)
        except Workspace.DoesNotExist:
            return Response({"error": "Workspace not found."}, status=404)
        except ValueError as exc:
            return Response({"error": str(exc)}, status=400)
        return Response({"received": True, "processed": processed,
            "invoice_id": str(invoice.id) if invoice else None})


class BillingInvoiceListAPIView(SocialWorkspaceScopedAPIView):
    def get(self, request):
        workspace = self.workspace(request)
        _require_billing_manager(workspace, request.user)
        results = [{
            "id": str(inv.id), "invoice_number": inv.invoice_number, "amount": str(inv.amount),
            "currency": inv.currency, "status": inv.status, "title": inv.title,
            "line_items": inv.line_items, "payment_method": inv.payment_method,
            "paid_at": (inv.paid_at or inv.created_at).isoformat(),
            "download_url": f"/api/v3/social/billing/invoices/{inv.id}/download/",
        } for inv in workspace.invoices.all().order_by("-created_at")]
        return Response({"invoices": results})


class BillingInvoiceDownloadAPIView(SocialWorkspaceScopedAPIView):
    def get(self, request, invoice_id):
        workspace = self.workspace(request)
        _require_billing_manager(workspace, request.user)
        invoice = get_object_or_404(BillingInvoice, id=invoice_id, workspace=workspace)
        response = HttpResponse(generate_invoice_html(invoice), content_type="text/html; charset=utf-8")
        response["Content-Security-Policy"] = "default-src 'none'; style-src 'unsafe-inline'; img-src data:"
        response["X-Content-Type-Options"] = "nosniff"
        if request.GET.get("download") == "true":
            response["Content-Disposition"] = f'attachment; filename="Invoice-{invoice.invoice_number}.html"'
        return response

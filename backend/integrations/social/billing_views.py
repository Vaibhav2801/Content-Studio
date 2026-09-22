from __future__ import annotations

from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from integrations.social.models import BillingInvoice, ConnectionState, SocialConnection
from integrations.social.services.billing import (
    generate_invoice_html,
    get_or_create_workspace_billing,
    is_workspace_admin,
    process_checkout,
)
from integrations.social.views import SocialWorkspaceScopedAPIView


class SubscriptionOverviewAPIView(SocialWorkspaceScopedAPIView):
    """Return subscription tier, connection limits, and credit balances."""

    def get(self, request):
        workspace = self.workspace(request)
        user = request.user if request.user.is_authenticated else None
        subscription, account = get_or_create_workspace_billing(workspace, user)
        is_admin = is_workspace_admin(workspace, user)

        connected_count = SocialConnection.objects.filter(
            workspace=workspace, status=ConnectionState.CONNECTED
        ).count()

        # Recent credit transactions (last 10)
        recent_txs = [
            {
                "id": str(tx.id),
                "amount": tx.amount,
                "action_type": tx.action_type,
                "description": tx.description,
                "balance_after": tx.balance_after,
                "post_id": str(tx.post_id) if tx.post_id else None,
                "created_at": tx.created_at.isoformat(),
            }
            for tx in workspace.credit_transactions.all().order_by("-created_at")[:10]
        ]

        # Recent invoices (last 10)
        recent_invoices = [
            {
                "id": str(inv.id),
                "invoice_number": inv.invoice_number,
                "amount": str(inv.amount),
                "currency": inv.currency,
                "status": inv.status,
                "title": inv.title,
                "paid_at": inv.paid_at.isoformat() if inv.paid_at else inv.created_at.isoformat(),
                "download_url": f"/api/v3/social/billing/invoices/{inv.id}/download/",
            }
            for inv in workspace.invoices.all().order_by("-created_at")[:10]
        ]

        return Response({
            "tier": "ADMIN" if is_admin else subscription.tier,
            "role_label": "Admin" if is_admin else subscription.get_tier_display(),
            "is_admin": is_admin,
            "connections": {
                "used": connected_count,
                "limit": 999999 if is_admin else subscription.connections_quota,
                "unlimited": is_admin,
                "extra_purchased": subscription.extra_connections,
            },
            "credits": {
                "balance": 999999 if is_admin else account.balance,
                "total_allocated": account.total_allocated,
                "total_used": account.total_used,
                "unlimited": is_admin,
                "cost_per_draft": 2,
                "cost_per_image": 1,
            },
            "engage_entitled": is_admin or subscription.engage_entitled,
            "scheduling_unlimited": True,
            "transactions": recent_txs,
            "invoices": recent_invoices,
        })


class BillingCheckoutAPIView(SocialWorkspaceScopedAPIView):
    """Process plan upgrades, booster pack purchases, or add-ons."""

    def post(self, request):
        workspace = self.workspace(request)
        user = request.user if request.user.is_authenticated else None
        data = request.data

        action = data.get("action", "")
        if action not in ("UPGRADE_PLAN", "BUY_BOOSTER", "ADD_CONNECTIONS", "ADD_ENGAGE"):
            return Response(
                {"error": "Invalid action. Choose UPGRADE_PLAN, BUY_BOOSTER, ADD_CONNECTIONS, or ADD_ENGAGE."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        invoice, subscription, account = process_checkout(
            workspace=workspace,
            action=action,
            tier=data.get("tier"),
            booster_pack_credits=int(data.get("booster_credits", 0)),
            extra_connections=int(data.get("extra_connections", 0)),
            has_engage=bool(data.get("has_engage", False)),
            billing_name=data.get("billing_name", ""),
            billing_email=data.get("billing_email", ""),
            payment_method=data.get("payment_method", "Credit Card (Checkout)"),
            user=user,
        )

        return Response({
            "success": True,
            "message": f"Successfully processed {invoice.title}",
            "invoice": {
                "id": str(invoice.id),
                "invoice_number": invoice.invoice_number,
                "amount": str(invoice.amount),
                "status": invoice.status,
                "title": invoice.title,
                "download_url": f"/api/v3/social/billing/invoices/{invoice.id}/download/",
            },
            "tier": subscription.tier,
            "credit_balance": account.balance,
            "connections_limit": subscription.connections_quota,
            "engage_entitled": subscription.engage_entitled,
        })


class BillingInvoiceListAPIView(SocialWorkspaceScopedAPIView):
    """List all billing invoices for the workspace."""

    def get(self, request):
        workspace = self.workspace(request)
        invoices = workspace.invoices.all().order_by("-created_at")
        results = [
            {
                "id": str(inv.id),
                "invoice_number": inv.invoice_number,
                "amount": str(inv.amount),
                "currency": inv.currency,
                "status": inv.status,
                "title": inv.title,
                "line_items": inv.line_items,
                "payment_method": inv.payment_method,
                "paid_at": inv.paid_at.isoformat() if inv.paid_at else inv.created_at.isoformat(),
                "download_url": f"/api/v3/social/billing/invoices/{inv.id}/download/",
            }
            for inv in invoices
        ]
        return Response({"invoices": results})


class BillingInvoiceDownloadAPIView(SocialWorkspaceScopedAPIView):
    """Download / view printable HTML invoice."""

    def get(self, request, invoice_id):
        workspace = self.workspace(request)
        invoice = get_object_or_404(BillingInvoice, id=invoice_id, workspace=workspace)
        html_content = generate_invoice_html(invoice)

        response = HttpResponse(html_content, content_type="text/html; charset=utf-8")
        # Support download query parameter: ?download=true
        if request.GET.get("download") == "true":
            response["Content-Disposition"] = f'attachment; filename="Invoice-{invoice.invoice_number}.html"'
        return response

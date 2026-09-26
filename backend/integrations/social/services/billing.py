from __future__ import annotations

import hashlib
import uuid
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple
from django.db import transaction
from django.utils.html import escape
from django.utils import timezone

from prospecting.models import Workspace, WorkspaceMembership
from integrations.social.models import (
    BillingInvoice,
    BillingWebhookEvent,
    ConnectionState,
    CreditAccount,
    CreditReservation,
    CreditReservationStatus,
    CreditTransaction,
    SocialConnection,
    SocialPost,
    WorkspaceSubscription,
    WorkspaceTier,
)

PRICING_CATALOG = {
    "currency": "USD",
    "credit_costs": {"draft": 2, "image": 1, "image_regeneration": 1},
    "plans": [
        {
            "id": "free",
            "name": "Free",
            "product_id": None,
            "price": 0,
            "credits": 15,
            "connections": 0,
            "engage": False,
        },
        {
            "id": "starter",
            "name": "Starter",
            "product_id": "plan_starter_monthly",
            "price": 20,
            "credits": 50,
            "connections": 1,
            "engage": False,
        },
        {
            "id": "advance",
            "name": "Advance",
            "product_id": "plan_advance_monthly",
            "price": 39,
            "credits": 150,
            "connections": 1,
            "engage": True,
        },
    ],
    "products": {
        "plan_starter_monthly": {
            "kind": "plan",
            "tier": WorkspaceTier.STARTER,
            "amount": Decimal("20.00"),
            "credits": 50,
            "title": "Starter Plan Subscription",
        },
        "plan_advance_monthly": {
            "kind": "plan",
            "tier": WorkspaceTier.ADVANCE,
            "amount": Decimal("39.00"),
            "credits": 150,
            "title": "Advance Plan Subscription",
        },
        "booster_50": {
            "kind": "booster",
            "amount": Decimal("10.00"),
            "credits": 50,
            "title": "50 AI Credit Booster",
        },
        "booster_150": {
            "kind": "booster",
            "amount": Decimal("25.00"),
            "credits": 150,
            "title": "150 AI Credit Booster",
        },
        "booster_350": {
            "kind": "booster",
            "amount": Decimal("50.00"),
            "credits": 350,
            "title": "350 AI Credit Booster",
        },
        "connection_1_monthly": {
            "kind": "connection",
            "amount": Decimal("5.00"),
            "connections": 1,
            "title": "Additional Social Connection",
        },
        "engage_monthly": {
            "kind": "engage",
            "amount": Decimal("15.00"),
            "title": "Engage Automation Suite Add-On",
        },
    },
}


def public_pricing_catalog() -> Dict[str, Any]:
    return {
        "currency": PRICING_CATALOG["currency"],
        "credit_costs": dict(PRICING_CATALOG["credit_costs"]),
        "plans": [dict(plan) for plan in PRICING_CATALOG["plans"]],
        "addons": [
            {"product_id": key, **{k: (str(v) if isinstance(v, Decimal) else v) for k, v in value.items() if k != "tier"}}
            for key, value in PRICING_CATALOG["products"].items()
            if value["kind"] != "plan"
        ],
    }


def can_manage_billing(workspace: Workspace, user: Optional[Any]) -> bool:
    if user is None or not getattr(user, "is_authenticated", False):
        return False
    if getattr(user, "is_superuser", False) or getattr(user, "is_staff", False):
        return True
    return WorkspaceMembership.objects.filter(
        workspace=workspace,
        user=user,
        is_active=True,
        role__in=(WorkspaceMembership.OWNER, WorkspaceMembership.ADMIN),
    ).exists()


def is_workspace_admin(workspace: Workspace, user: Optional[Any] = None) -> bool:
    """Return whether this user has the internal unrestricted billing tier."""
    if user is not None and getattr(user, "is_authenticated", False):
        if getattr(user, "is_superuser", False) or getattr(user, "is_staff", False):
            return True
        membership = WorkspaceMembership.objects.filter(
            workspace=workspace, user=user, is_active=True
        ).first()
        if membership is None:
            return False
        sub = WorkspaceSubscription.objects.filter(workspace=workspace).first()
        return bool(sub and sub.tier == WorkspaceTier.ADMIN)
    return False


def get_or_create_workspace_billing(
    workspace: Workspace, user: Optional[Any] = None
) -> Tuple[WorkspaceSubscription, CreditAccount]:
    """Ensure workspace has an active subscription and credit account."""
    with transaction.atomic():
        subscription, sub_created = WorkspaceSubscription.objects.select_for_update().get_or_create(
            workspace=workspace,
            defaults={
                "tier": WorkspaceTier.FREE,
                "extra_connections": 0,
                "has_engage_addon": False,
                "is_active": True,
            },
        )

        initial_credits = (
            999999 if subscription.tier == WorkspaceTier.ADMIN
            else 15 if subscription.tier == WorkspaceTier.FREE
            else 150 if subscription.tier == WorkspaceTier.ADVANCE
            else 50
        )

        account, acc_created = CreditAccount.objects.select_for_update().get_or_create(
            workspace=workspace,
            defaults={
                "total_allocated": initial_credits,
                "total_used": 0,
            },
        )

        if acc_created:
            CreditTransaction.objects.create(
                workspace=workspace,
                amount=initial_credits,
                action_type="TIER_ALLOCATION",
                description=f"Initial credits for {subscription.tier} plan",
                balance_after=initial_credits,
            )

    return subscription, account


def check_connection_quota(
    workspace: Workspace, user: Optional[Any] = None
) -> Tuple[bool, str, int, int]:
    """
    Check if workspace can connect another social account.
    Returns (can_connect, reason, quota, used_count).
    """
    subscription, _ = get_or_create_workspace_billing(workspace, user)
    if is_workspace_admin(workspace, user) or subscription.tier == WorkspaceTier.ADMIN:
        used = SocialConnection.objects.filter(
            workspace=workspace, status=ConnectionState.CONNECTED
        ).count()
        return True, "", 999999, used

    quota = subscription.connections_quota
    used = SocialConnection.objects.filter(
        workspace=workspace, status=ConnectionState.CONNECTED
    ).count()

    if subscription.tier == WorkspaceTier.FREE:
        return (
            False,
            "Free accounts cannot connect social channels. Please upgrade to the Starter or Advance plan to publish directly.",
            0,
            used,
        )

    if used >= quota:
        return (
            False,
            f"You have reached your limit of {quota} connected {('account' if quota == 1 else 'accounts')}. "
            "Please upgrade your plan or add an additional connection for $5/month.",
            quota,
            used,
        )

    return True, "", quota, used


def check_credit_quota(
    workspace: Workspace, required_credits: int = 1, user: Optional[Any] = None
) -> Tuple[bool, int]:
    """
    Check if workspace has sufficient credits for an operation.
    Returns (has_sufficient_credits, current_balance).
    """
    if is_workspace_admin(workspace, user):
        return True, 999999

    _, account = get_or_create_workspace_billing(workspace, user)
    return account.balance >= required_credits, account.balance


def deduct_credits(
    workspace: Workspace,
    amount: int,
    action_type: str = "USAGE",
    description: str = "",
    post: Optional[SocialPost] = None,
    user: Optional[Any] = None,
    category: Optional[str] = None,
) -> bool:
    reservation, _ = reserve_credits(
        workspace=workspace,
        amount=amount,
        action_type=category or action_type,
        description=description,
        post=post,
        user=user,
    )
    if reservation is None:
        return False
    finalize_credit_reservation(reservation.id, success=True)
    return True


def reserve_credits(
    *,
    workspace: Workspace,
    amount: int,
    action_type: str,
    description: str,
    post: Optional[SocialPost] = None,
    user: Optional[Any] = None,
    idempotency_key: Optional[str] = None,
    expected_operations: int = 1,
) -> Tuple[Optional[CreditReservation], int]:
    """Atomically reserve credits before dispatching paid work."""
    if amount <= 0 or expected_operations <= 0:
        raise ValueError("Credit reservations require positive amounts and operation counts.")
    key = idempotency_key or f"{action_type}:{uuid.uuid4()}"
    with transaction.atomic():
        existing = CreditReservation.objects.select_for_update().filter(idempotency_key=key).first()
        if existing is not None:
            if (
                existing.workspace_id != workspace.id
                or existing.amount != amount
                or existing.action_type != action_type
                or existing.expected_operations != expected_operations
            ):
                raise ValueError("Credit idempotency key was reused for a different operation.")
            account = CreditAccount.objects.select_for_update().get(workspace=workspace)
            return existing, account.balance

        _, _ = get_or_create_workspace_billing(workspace, user)
        account = CreditAccount.objects.select_for_update().get(workspace=workspace)
        admin_bypass = is_workspace_admin(workspace, user)
        if not admin_bypass and account.balance < amount:
            return None, account.balance

        reserved_amount = 0 if admin_bypass else amount
        if reserved_amount:
            account.total_used += reserved_amount
            account.save(update_fields=["total_used", "updated_at"])
        reservation = CreditReservation.objects.create(
            workspace=workspace,
            post=post,
            idempotency_key=key,
            amount=reserved_amount,
            action_type=action_type,
            description=description[:255],
            expected_operations=expected_operations,
            status=(
                CreditReservationStatus.CONSUMED
                if admin_bypass
                else CreditReservationStatus.RESERVED
            ),
        )
        CreditTransaction.objects.create(
            workspace=workspace,
            amount=-reserved_amount,
            action_type=action_type,
            description=(
                f"[ADMIN BYPASS] {description}" if admin_bypass else f"[RESERVED] {description}"
            )[:255],
            balance_after=account.balance,
            post=post,
            reservation=reservation,
        )
        return reservation, account.balance


def finalize_credit_reservation(reservation_id, *, success: bool) -> Optional[CreditReservation]:
    """Consume a successful reservation or refund it after any failed operation."""
    with transaction.atomic():
        reservation = (
            CreditReservation.objects.select_for_update()
            .select_related("workspace")
            .filter(pk=reservation_id)
            .first()
        )
        if reservation is None or reservation.status != CreditReservationStatus.RESERVED:
            return reservation
        account = CreditAccount.objects.select_for_update().get(workspace=reservation.workspace)
        if not success:
            account.total_used = max(0, account.total_used - reservation.amount)
            account.save(update_fields=["total_used", "updated_at"])
            reservation.status = CreditReservationStatus.REFUNDED
            reservation.save(update_fields=["status", "updated_at"])
            CreditTransaction.objects.create(
                workspace=reservation.workspace,
                amount=reservation.amount,
                action_type="CREDIT_REFUND",
                description=f"Refunded failed operation: {reservation.description}"[:255],
                balance_after=account.balance,
                post=reservation.post,
                reservation=reservation,
            )
            return reservation

        reservation.completed_operations += 1
        if reservation.completed_operations >= reservation.expected_operations:
            reservation.status = CreditReservationStatus.CONSUMED
        reservation.save(update_fields=["completed_operations", "status", "updated_at"])
        return reservation


def check_engage_entitlement(
    workspace: Workspace, user: Optional[Any] = None
) -> Tuple[bool, str]:
    """Check if workspace is entitled to use the Engage Suite."""
    if is_workspace_admin(workspace, user):
        return True, ""

    subscription, _ = get_or_create_workspace_billing(workspace, user)
    if subscription.engage_entitled:
        return True, ""

    return (
        False,
        "The Engage Automation Suite requires the Advance plan ($39/mo) or the Engage add-on ($15/mo). "
        "Please upgrade your plan in Settings > Billing to activate.",
    )


def next_invoice_number() -> str:
    """Generate a concurrency-safe, human-readable invoice number."""
    return f"INV-{timezone.now().year}-{uuid.uuid4().hex[:10].upper()}"


def _unsafe_legacy_process_checkout(
    workspace: Workspace,
    action: str,
    tier: Optional[str] = None,
    booster_pack_credits: int = 0,
    extra_connections: int = 0,
    has_engage: bool = False,
    billing_name: str = "",
    billing_email: str = "",
    payment_method: str = "Credit Card (Simulated Payment)",
    user: Optional[Any] = None,
) -> Tuple[BillingInvoice, WorkspaceSubscription, CreditAccount]:
    """
    Retained temporarily for migration archaeology; this path is permanently disabled.
    """
    raise RuntimeError("Legacy arbitrary checkout is disabled; use fixed billing products.")

    # Unreachable legacy implementation retained until downstream migrations no longer
    # need to compare historical invoice behavior.
    with transaction.atomic():
        subscription, account = get_or_create_workspace_billing(workspace, user)
        line_items: List[Dict[str, Any]] = []
        total_amount = Decimal("0.00")
        invoice_title = ""

        if action == "UPGRADE_PLAN" and tier:
            old_tier = subscription.tier
            new_tier = tier.upper()
            if new_tier == WorkspaceTier.FREE:
                subscription.tier = WorkspaceTier.FREE
                subscription.extra_connections = 0
                subscription.has_engage_addon = False
                total_amount += Decimal("0.00")
                invoice_title = "Plan Change: Free Plan"
                line_items.append({"description": "Free Plan Subscription", "amount": "0.00"})
            elif new_tier == WorkspaceTier.STARTER:
                subscription.tier = WorkspaceTier.STARTER
                total_amount += Decimal("20.00")
                invoice_title = "Starter Plan Subscription ($20/mo)"
                line_items.append({"description": "Starter Plan - 1 Connection, 50 AI Credits", "amount": "20.00"})
                # Allocate 50 credits
                account.total_allocated += 50
                account.save(update_fields=["total_allocated", "updated_at"])
                CreditTransaction.objects.create(
                    workspace=workspace,
                    amount=50,
                    action_type="PLAN_UPGRADE",
                    description=f"Credits granted for upgrading to Starter plan",
                    balance_after=account.balance,
                )
            elif new_tier == WorkspaceTier.ADVANCE:
                subscription.tier = WorkspaceTier.ADVANCE
                total_amount += Decimal("39.00")
                invoice_title = "Advance Plan Subscription ($39/mo)"
                line_items.append({"description": "Advance Plan - 1 Connection, 150 AI Credits, Engage Suite", "amount": "39.00"})
                # Allocate 150 credits
                account.total_allocated += 150
                account.save(update_fields=["total_allocated", "updated_at"])
                CreditTransaction.objects.create(
                    workspace=workspace,
                    amount=150,
                    action_type="PLAN_UPGRADE",
                    description=f"Credits granted for upgrading to Advance plan",
                    balance_after=account.balance,
                )
            elif new_tier == WorkspaceTier.ADMIN and is_workspace_admin(workspace, user):
                subscription.tier = WorkspaceTier.ADMIN
                total_amount += Decimal("0.00")
                invoice_title = "Administrator Entitlement Grant"
                line_items.append({"description": "Admin Tier (Unrestricted Quotas)", "amount": "0.00"})

        elif action == "BUY_BOOSTER":
            # Booster packs: 50 for $10, 150 for $25, 350 for $50
            pack_map = {
                50: Decimal("10.00"),
                150: Decimal("25.00"),
                350: Decimal("50.00"),
            }
            cost = pack_map.get(booster_pack_credits, Decimal("10.00") if booster_pack_credits <= 50 else Decimal("25.00"))
            total_amount += cost
            invoice_title = f"Credit Top-Up: {booster_pack_credits} AI Credits"
            line_items.append({
                "description": f"On-Demand AI Post Credits Booster ({booster_pack_credits} credits - never expire)",
                "amount": str(cost),
            })
            account.total_allocated += booster_pack_credits
            account.save(update_fields=["total_allocated", "updated_at"])
            CreditTransaction.objects.create(
                workspace=workspace,
                amount=booster_pack_credits,
                action_type="TOPUP_PURCHASE",
                description=f"Purchased {booster_pack_credits} credit booster pack",
                balance_after=account.balance,
            )

        elif action == "ADD_CONNECTIONS":
            cost = Decimal(str(extra_connections * 5))
            total_amount += cost
            subscription.extra_connections += extra_connections
            invoice_title = f"Additional Social Connections (+{extra_connections})"
            line_items.append({
                "description": f"{extra_connections} Additional Social Connection(s) @ $5/mo",
                "amount": str(cost),
            })

        elif action == "ADD_ENGAGE":
            cost = Decimal("15.00")
            total_amount += cost
            subscription.has_engage_addon = True
            invoice_title = "Engage Automation Suite Add-On ($15/mo)"
            line_items.append({
                "description": "Engage Suite Add-on (Comment-to-DM, Story triggers, DM flows)",
                "amount": "15.00",
            })

        if billing_name:
            subscription.billing_name = billing_name
        if billing_email:
            subscription.billing_email = billing_email
        subscription.save()

        # Create paid invoice
        invoice = BillingInvoice.objects.create(
            invoice_number=next_invoice_number(),
            workspace=workspace,
            amount=total_amount,
            currency="USD",
            status="PAID",
            title=invoice_title or "Visiofy Studio Service Checkout",
            line_items=line_items,
            payment_method=payment_method,
            billing_name=billing_name or subscription.billing_name or workspace.name,
            billing_email=billing_email or subscription.billing_email or (user.email if user else ""),
            paid_at=timezone.now(),
        )

    return invoice, subscription, account


def process_billing_product(
    *,
    workspace: Workspace,
    product_id: str,
    billing_name: str = "",
    billing_email: str = "",
    payment_method: str,
    payment_reference: str,
    provider: str,
    provider_customer_id: str = "",
    provider_subscription_id: str = "",
    current_period_start=None,
    current_period_end=None,
    user: Optional[Any] = None,
) -> Tuple[BillingInvoice, WorkspaceSubscription, CreditAccount]:
    product = PRICING_CATALOG["products"].get(product_id)
    if product is None:
        raise ValueError("Unknown billing product.")
    with transaction.atomic():
        subscription, _ = get_or_create_workspace_billing(workspace, user)
        subscription = WorkspaceSubscription.objects.select_for_update().get(pk=subscription.pk)
        account = CreditAccount.objects.select_for_update().get(workspace=workspace)
        kind = product["kind"]
        credits = int(product.get("credits", 0))
        if kind == "plan":
            subscription.tier = product["tier"]
            subscription.is_active = True
            subscription.cancel_at_period_end = False
        elif kind == "booster":
            pass
        elif kind == "connection":
            subscription.extra_connections += int(product["connections"])
        elif kind == "engage":
            subscription.has_engage_addon = True
        else:
            raise ValueError("Unsupported billing product.")

        if credits:
            account.total_allocated += credits
            account.save(update_fields=["total_allocated", "updated_at"])
            CreditTransaction.objects.create(
                workspace=workspace,
                amount=credits,
                action_type="PLAN_RENEWAL" if kind == "plan" else "TOPUP_PURCHASE",
                description=f"Credits granted for {product['title']}"[:255],
                balance_after=account.balance,
            )

        subscription.billing_provider = provider[:30]
        subscription.provider_customer_id = provider_customer_id[:255]
        subscription.provider_subscription_id = provider_subscription_id[:255]
        subscription.current_period_start = current_period_start
        subscription.current_period_end = current_period_end
        if billing_name:
            subscription.billing_name = billing_name[:255]
        if billing_email:
            subscription.billing_email = billing_email[:255]
        subscription.save()

        amount = product["amount"]
        invoice = BillingInvoice.objects.create(
            invoice_number=next_invoice_number(),
            workspace=workspace,
            amount=amount,
            currency=PRICING_CATALOG["currency"],
            status="PAID",
            title=product["title"],
            line_items=[
                {
                    "product_id": product_id,
                    "description": product["title"],
                    "quantity": 1,
                    "unit_price": str(amount),
                    "total": str(amount),
                }
            ],
            payment_method=payment_method[:100],
            payment_reference=payment_reference[:255],
            billing_name=(billing_name or subscription.billing_name or workspace.name)[:255],
            billing_email=(billing_email or subscription.billing_email or getattr(user, "email", ""))[:255],
            paid_at=timezone.now(),
        )
        return invoice, subscription, account


def process_billing_event(payload: Dict[str, Any], raw_body: bytes):
    """Apply a signed payment event exactly once."""
    provider = str(payload.get("provider") or "generic").strip().lower()[:30]
    event_id = str(payload.get("event_id") or "").strip()
    event_type = str(payload.get("event_type") or "").strip().lower()
    workspace_id = payload.get("workspace_id")
    if not event_id or not event_type or not workspace_id:
        raise ValueError("Billing event_id, event_type, and workspace_id are required.")
    if event_type not in {"payment.succeeded", "subscription.renewed", "subscription.cancelled"}:
        raise ValueError("Unsupported billing event type.")

    fingerprint = hashlib.sha256(raw_body).hexdigest()
    with transaction.atomic():
        # Serialize billing events per workspace before checking event identity so
        # two simultaneous deliveries cannot both pass the not-yet-seen check.
        workspace = Workspace.objects.select_for_update().get(pk=workspace_id)
        existing = (
            BillingWebhookEvent.objects.select_for_update()
            .select_related("invoice")
            .filter(provider=provider, provider_event_id=event_id)
            .first()
        )
        if existing is not None:
            if existing.payload_fingerprint != fingerprint:
                raise ValueError("Billing event identifier was reused with a different payload.")
            return existing.invoice, False

        event = BillingWebhookEvent.objects.create(
            provider=provider,
            provider_event_id=event_id,
            event_type=event_type,
            payload_fingerprint=fingerprint,
        )
        if event_type == "subscription.cancelled":
            subscription, _ = get_or_create_workspace_billing(workspace)
            subscription = WorkspaceSubscription.objects.select_for_update().get(pk=subscription.pk)
            immediate = str(payload.get("cancellation_effective") or "period_end") == "immediate"
            subscription.cancel_at_period_end = not immediate
            if immediate:
                subscription.tier = WorkspaceTier.FREE
                subscription.extra_connections = 0
                subscription.has_engage_addon = False
                subscription.is_active = False
            subscription.save()
            return None, True

        invoice, _, _ = process_billing_product(
            workspace=workspace,
            product_id=str(payload.get("product_id") or ""),
            billing_name=str(payload.get("billing_name") or ""),
            billing_email=str(payload.get("billing_email") or ""),
            payment_method=str(payload.get("payment_method") or provider),
            payment_reference=str(payload.get("payment_reference") or event_id),
            provider=provider,
            provider_customer_id=str(payload.get("customer_id") or ""),
            provider_subscription_id=str(payload.get("subscription_id") or ""),
            current_period_start=payload.get("current_period_start"),
            current_period_end=payload.get("current_period_end"),
        )
        event.invoice = invoice
        event.save(update_fields=["invoice"])
        return invoice, True


def generate_invoice_html(invoice: BillingInvoice) -> str:
    """Generate a clean, printable HTML invoice for download/viewing."""
    line_items_html = ""
    for item in invoice.line_items:
        desc = escape(str(item.get("description", "Service")))
        amt = escape(str(item.get("amount", item.get("total", "0.00"))))
        line_items_html += f"""
        <tr>
          <td style="padding: 12px 16px; border-bottom: 1px solid #f0ecf6; font-size: 14px; color: #25243b;">{desc}</td>
          <td style="padding: 12px 16px; border-bottom: 1px solid #f0ecf6; font-size: 14px; color: #25243b; text-align: right; font-weight: 700;">${amt}</td>
        </tr>
        """

    formatted_date = invoice.paid_at.strftime("%B %d, %Y") if invoice.paid_at else invoice.created_at.strftime("%B %d, %Y")
    invoice_number = escape(str(invoice.invoice_number))
    billing_name = escape(str(invoice.billing_name or invoice.workspace.name))
    billing_email = escape(str(invoice.billing_email or "Customer Account"))
    workspace_name = escape(str(invoice.workspace.name))
    payment_method = escape(str(invoice.payment_method))
    currency = escape(str(invoice.currency))
    amount = escape(str(invoice.amount))

    return f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Invoice {invoice_number}</title>
  <style>
    body {{
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #25243b;
      margin: 0;
      padding: 40px;
      background: #fbfaf8;
    }}
    .invoice-card {{
      max-width: 760px;
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid #e8e4f2;
      border-radius: 16px;
      padding: 48px;
      box-shadow: 0 10px 30px rgba(45, 36, 80, 0.05);
    }}
    .header {{
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 40px;
      padding-bottom: 24px;
      border-bottom: 2px solid #f1edf8;
    }}
    .brand {{
      font-size: 22px;
      font-weight: 900;
      letter-spacing: -0.04em;
      color: #6352de;
    }}
    .badge {{
      display: inline-block;
      padding: 4px 12px;
      border-radius: 9999px;
      background: #ecfdf5;
      color: #047857;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }}
    .meta-grid {{
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 32px;
      margin-bottom: 36px;
    }}
    .meta-box h4 {{
      font-size: 11px;
      font-weight: 800;
      color: #8c889f;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin: 0 0 6px;
    }}
    .meta-box p {{
      margin: 0;
      font-size: 14px;
      color: #3b374e;
      line-height: 1.5;
    }}
    table {{
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 32px;
    }}
    th {{
      background: #faf9fd;
      padding: 12px 16px;
      text-align: left;
      font-size: 12px;
      font-weight: 800;
      color: #6a667e;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border-bottom: 1.5px solid #ece7f5;
    }}
    .total-box {{
      display: flex;
      justify-content: flex-end;
      padding-top: 16px;
      border-top: 2px solid #25243b;
    }}
    .total-row {{
      text-align: right;
    }}
    .total-row span {{
      font-size: 14px;
      color: #726e85;
      font-weight: 700;
      margin-right: 18px;
    }}
    .total-row strong {{
      font-size: 26px;
      font-weight: 900;
      color: #25243b;
    }}
    .footer-note {{
      margin-top: 48px;
      text-align: center;
      font-size: 12px;
      color: #9c97af;
      border-top: 1px solid #f1edf8;
      padding-top: 20px;
    }}
    @media print {{
      body {{ background: #fff; padding: 0; }}
      .invoice-card {{ box-shadow: none; border: none; padding: 20px; }}
      .no-print {{ display: none; }}
    }}
  </style>
</head>
<body>
  <div class="no-print" style="max-width: 760px; margin: 0 auto 20px; text-align: right;">
    <button onclick="window.print()" style="padding: 10px 20px; border-radius: 10px; background: #6352de; color: white; border: none; font-weight: 800; font-size: 13px; cursor: pointer;">
      🖨️ Print / Save as PDF
    </button>
  </div>
  <div class="invoice-card">
    <div class="header">
      <div>
        <div class="brand">✦ Visiofy Studio</div>
        <div style="font-size: 13px; color: #726e85; margin-top: 4px;">Visiofy Studio Platform Inc.</div>
      </div>
      <div style="text-align: right;">
        <div class="badge">PAID</div>
        <div style="font-size: 18px; font-weight: 850; margin-top: 8px;">{invoice_number}</div>
      </div>
    </div>

    <div class="meta-grid">
      <div class="meta-box">
        <h4>Billed To</h4>
        <p><strong>{billing_name}</strong></p>
        <p>{billing_email}</p>
        <p>Workspace: {workspace_name}</p>
      </div>
      <div class="meta-box" style="text-align: right;">
        <h4>Payment Info</h4>
        <p>Date: {formatted_date}</p>
        <p>Method: {payment_method}</p>
        <p>Currency: {currency}</p>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th style="text-align: right;">Amount</th>
        </tr>
      </thead>
      <tbody>
        {line_items_html}
      </tbody>
    </table>

    <div class="total-box">
      <div class="total-row">
        <span>Total Paid ({currency}):</span>
        <strong>${amount}</strong>
      </div>
    </div>

    <div class="footer-note">
      Thank you for building your audience with Visiofy Studio. For support or enterprise billing questions, contact support@contentstudio.com.
    </div>
  </div>
</body>
</html>"""

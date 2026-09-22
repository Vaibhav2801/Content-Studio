from __future__ import annotations

import datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple
from django.db import transaction
from django.utils import timezone

from prospecting.models import Workspace, WorkspaceMembership
from integrations.social.models import (
    BillingInvoice,
    ConnectionState,
    CreditAccount,
    CreditTransaction,
    SocialConnection,
    SocialPost,
    WorkspaceSubscription,
    WorkspaceTier,
)


def is_workspace_admin(workspace: Workspace, user: Optional[Any] = None) -> bool:
    """Return True if user is a Django superuser, staff, or marked with ADMIN tier."""
    if user is not None and getattr(user, "is_authenticated", False):
        if getattr(user, "is_superuser", False) or getattr(user, "is_staff", False):
            return True
        membership = WorkspaceMembership.objects.filter(
            workspace=workspace, user=user, is_active=True
        ).first()
        if membership and membership.role in (WorkspaceMembership.OWNER, WorkspaceMembership.ADMIN):
            # Check if subscription is explicitly set to ADMIN
            sub = WorkspaceSubscription.objects.filter(workspace=workspace).first()
            if sub and sub.tier == WorkspaceTier.ADMIN:
                return True
    sub = WorkspaceSubscription.objects.filter(workspace=workspace).first()
    return bool(sub and sub.tier == WorkspaceTier.ADMIN)


def get_or_create_workspace_billing(
    workspace: Workspace, user: Optional[Any] = None
) -> Tuple[WorkspaceSubscription, CreditAccount]:
    """Ensure workspace has an active subscription and credit account."""
    with transaction.atomic():
        subscription, sub_created = WorkspaceSubscription.objects.select_for_update().get_or_create(
            workspace=workspace,
            defaults={
                "tier": WorkspaceTier.ADMIN if (user and (getattr(user, "is_superuser", False) or getattr(user, "is_staff", False))) else WorkspaceTier.STARTER,
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
            workspace=workspace, state=ConnectionState.CONNECTED
        ).count()
        return True, "", 999999, used

    quota = subscription.connections_quota
    used = SocialConnection.objects.filter(
        workspace=workspace, state=ConnectionState.CONNECTED
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
    """
    Atomically deduct credits and log transaction.
    Returns True if successfully deducted or Admin, False if insufficient credits.
    """
    effective_action = category or action_type
    if is_workspace_admin(workspace, user):
        # Admin action: log zero deduction or high balance
        _, account = get_or_create_workspace_billing(workspace, user)
        CreditTransaction.objects.create(
            workspace=workspace,
            amount=0,
            action_type=effective_action,
            description=f"[ADMIN BYPASS] {description}",
            balance_after=account.balance,
            post=post,
        )
        return True

    with transaction.atomic():
        try:
            account = CreditAccount.objects.select_for_update().get(workspace=workspace)
        except CreditAccount.DoesNotExist:
            _, account = get_or_create_workspace_billing(workspace, user)
            account = CreditAccount.objects.select_for_update().get(workspace=workspace)

        if account.balance < amount:
            return False

        account.total_used += amount
        account.save(update_fields=["total_used", "updated_at"])

        CreditTransaction.objects.create(
            workspace=workspace,
            amount=-amount,
            action_type=effective_action,
            description=description,
            balance_after=account.balance,
            post=post,
        )
        return True


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
    """Generate sequential invoice number: INV-YYYY-XXXX."""
    year = timezone.now().year
    prefix = f"INV-{year}-"
    last_inv = (
        BillingInvoice.objects.filter(invoice_number__startswith=prefix)
        .order_by("-invoice_number")
        .first()
    )
    if not last_inv:
        return f"{prefix}0001"
    try:
        current_seq = int(last_inv.invoice_number.split("-")[-1])
        return f"{prefix}{current_seq + 1:04d}"
    except (ValueError, IndexError):
        import uuid
        return f"{prefix}{uuid.uuid4().hex[:4].upper()}"


def process_checkout(
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
    Process subscription upgrade, credit top-up, or add-ons.
    Creates an immutable BillingInvoice and updates balances immediately.
    """
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
            title=invoice_title or "Content Studio Service Checkout",
            line_items=line_items,
            payment_method=payment_method,
            billing_name=billing_name or subscription.billing_name or workspace.name,
            billing_email=billing_email or subscription.billing_email or (user.email if user else ""),
            paid_at=timezone.now(),
        )

    return invoice, subscription, account


def generate_invoice_html(invoice: BillingInvoice) -> str:
    """Generate a clean, printable HTML invoice for download/viewing."""
    line_items_html = ""
    for item in invoice.line_items:
        desc = item.get("description", "Service")
        amt = item.get("amount", "0.00")
        line_items_html += f"""
        <tr>
          <td style="padding: 12px 16px; border-bottom: 1px solid #f0ecf6; font-size: 14px; color: #25243b;">{desc}</td>
          <td style="padding: 12px 16px; border-bottom: 1px solid #f0ecf6; font-size: 14px; color: #25243b; text-align: right; font-weight: 700;">${amt}</td>
        </tr>
        """

    formatted_date = invoice.paid_at.strftime("%B %d, %Y") if invoice.paid_at else invoice.created_at.strftime("%B %d, %Y")

    return f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Invoice {invoice.invoice_number}</title>
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
        <div class="brand">✦ content studio</div>
        <div style="font-size: 13px; color: #726e85; margin-top: 4px;">Content Studio Platform Inc.</div>
      </div>
      <div style="text-align: right;">
        <div class="badge">PAID</div>
        <div style="font-size: 18px; font-weight: 850; margin-top: 8px;">{invoice.invoice_number}</div>
      </div>
    </div>

    <div class="meta-grid">
      <div class="meta-box">
        <h4>Billed To</h4>
        <p><strong>{invoice.billing_name or invoice.workspace.name}</strong></p>
        <p>{invoice.billing_email or "Customer Account"}</p>
        <p>Workspace: {invoice.workspace.name}</p>
      </div>
      <div class="meta-box" style="text-align: right;">
        <h4>Payment Info</h4>
        <p>Date: {formatted_date}</p>
        <p>Method: {invoice.payment_method}</p>
        <p>Currency: {invoice.currency}</p>
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
        <span>Total Paid ({invoice.currency}):</span>
        <strong>${invoice.amount}</strong>
      </div>
    </div>

    <div class="footer-note">
      Thank you for building your audience with Content Studio. For support or enterprise billing questions, contact support@contentstudio.com.
    </div>
  </div>
</body>
</html>"""

import hashlib
import hmac
import json
from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal
from unittest import skipUnless
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.db import close_old_connections, connection
from django.test import TestCase, TransactionTestCase, override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from integrations.social.models import (
    BillingInvoice,
    BillingWebhookEvent,
    CreditAccount,
    CreditReservationStatus,
    SocialNetwork,
    SocialPost,
    SocialPostVariant,
    WorkspaceSubscription,
    WorkspaceTier,
)
from integrations.social.services.billing import (
    finalize_credit_reservation,
    generate_invoice_html,
    get_or_create_workspace_billing,
    reserve_credits,
)
from prospecting.models import Workspace, WorkspaceMembership


@override_settings(CONTENT_AUTOMATION_DEV_BOOTSTRAP=False, BILLING_WEBHOOK_SECRET="billing-test-secret")
class BillingApiTests(TestCase):
    def setUp(self):
        users = get_user_model()
        self.owner = users.objects.create_user(username="billing-owner", email="owner@example.com")
        self.member = users.objects.create_user(username="billing-member")
        self.staff = users.objects.create_user(username="billing-staff", is_staff=True)
        self.inactive = users.objects.create_user(username="billing-inactive")
        self.workspace = Workspace.objects.create(name="Billing <Workspace>")
        WorkspaceMembership.objects.create(
            workspace=self.workspace, user=self.owner, role=WorkspaceMembership.OWNER, is_active=True
        )
        WorkspaceMembership.objects.create(
            workspace=self.workspace, user=self.member, role=WorkspaceMembership.MEMBER, is_active=True
        )
        WorkspaceMembership.objects.create(
            workspace=self.workspace, user=self.staff, role=WorkspaceMembership.ADMIN, is_active=True
        )
        WorkspaceMembership.objects.create(
            workspace=self.workspace, user=self.inactive, role=WorkspaceMembership.OWNER, is_active=False
        )
        self.client = APIClient()

    def signed_webhook(self, payload):
        raw = json.dumps(payload, separators=(",", ":")).encode("utf-8")
        signature = hmac.new(b"billing-test-secret", raw, hashlib.sha256).hexdigest()
        return self.client.post(
            reverse("social-billing-webhook"), raw,
            content_type="application/json", HTTP_X_BILLING_SIGNATURE=f"sha256={signature}",
        )

    def test_catalog_is_authoritative_and_public(self):
        response = self.client.get(reverse("social-billing-catalog"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["credit_costs"], {"draft": 2, "image": 1, "image_regeneration": 1})
        self.assertEqual(
            {plan["product_id"] for plan in response.data["plans"] if plan["product_id"]},
            {"plan_starter_monthly", "plan_advance_monthly"},
        )
        self.assertFalse(response.data["simulated_checkout_enabled"])

    def test_simulator_is_disabled_by_default_and_rejects_arbitrary_products(self):
        self.client.force_authenticate(self.staff)
        disabled = self.client.post(reverse("social-billing-checkout"), {"product_id": "plan_starter_monthly"})
        self.assertEqual(disabled.status_code, 403)
        with self.settings(BILLING_SIMULATED_CHECKOUT_ENABLED=True):
            arbitrary = self.client.post(reverse("social-billing-checkout"), {"product_id": "credits_999999"})
        self.assertEqual(arbitrary.status_code, 400)
        self.assertFalse(BillingInvoice.objects.exists())

    @override_settings(BILLING_SIMULATED_CHECKOUT_ENABLED=True)
    def test_simulator_requires_staff_and_uses_fixed_product_values(self):
        self.client.force_authenticate(self.owner)
        self.assertEqual(
            self.client.post(reverse("social-billing-checkout"), {"product_id": "booster_350"}).status_code,
            403,
        )
        self.client.force_authenticate(self.staff)
        response = self.client.post(reverse("social-billing-checkout"), {"product_id": "booster_50"})
        self.assertEqual(response.status_code, 200)
        invoice = BillingInvoice.objects.get()
        self.assertEqual(invoice.amount, Decimal("10.00"))
        self.assertEqual(invoice.line_items[0]["product_id"], "booster_50")
        self.assertEqual(CreditAccount.objects.get(workspace=self.workspace).balance, 65)

    def test_only_active_owner_or_admin_can_read_billing_history(self):
        for user, expected in ((self.owner, 200), (self.member, 403), (self.inactive, 403)):
            self.client.force_authenticate(user)
            response = self.client.get(reverse("social-billing-invoices"))
            self.assertEqual(response.status_code, expected)

    def test_webhook_rejects_invalid_signature(self):
        response = self.client.post(
            reverse("social-billing-webhook"), b"{}", content_type="application/json",
            HTTP_X_BILLING_SIGNATURE="bad",
        )
        self.assertEqual(response.status_code, 401)

    def test_payment_webhook_is_idempotent(self):
        payload = {
            "provider": "stripe", "event_id": "evt_paid_1", "event_type": "payment.succeeded",
            "workspace_id": str(self.workspace.id), "product_id": "booster_150",
            "payment_reference": "pi_1", "billing_name": "A <script>alert(1)</script>",
        }
        first = self.signed_webhook(payload)
        second = self.signed_webhook(payload)
        self.assertEqual(first.status_code, 200)
        self.assertTrue(first.data["processed"])
        self.assertFalse(second.data["processed"])
        self.assertEqual(BillingInvoice.objects.count(), 1)
        self.assertEqual(BillingWebhookEvent.objects.count(), 1)
        self.assertEqual(CreditAccount.objects.get(workspace=self.workspace).balance, 165)

    def test_webhook_event_id_cannot_be_reused_with_different_payload(self):
        base = {"provider": "stripe", "event_id": "evt_reuse", "event_type": "payment.succeeded",
            "workspace_id": str(self.workspace.id), "product_id": "booster_50"}
        self.assertEqual(self.signed_webhook(base).status_code, 200)
        changed = {**base, "product_id": "booster_350"}
        self.assertEqual(self.signed_webhook(changed).status_code, 400)
        self.assertEqual(BillingInvoice.objects.count(), 1)

    def test_renewal_and_cancellation_lifecycle(self):
        renewal = {"provider": "stripe", "event_id": "evt_renew", "event_type": "subscription.renewed",
            "workspace_id": str(self.workspace.id), "product_id": "plan_advance_monthly",
            "subscription_id": "sub_1"}
        self.assertEqual(self.signed_webhook(renewal).status_code, 200)
        subscription = WorkspaceSubscription.objects.get(workspace=self.workspace)
        self.assertEqual(subscription.tier, WorkspaceTier.ADVANCE)
        self.assertEqual(CreditAccount.objects.get(workspace=self.workspace).balance, 165)

        at_period_end = {"provider": "stripe", "event_id": "evt_cancel_later",
            "event_type": "subscription.cancelled", "workspace_id": str(self.workspace.id),
            "cancellation_effective": "period_end"}
        self.assertEqual(self.signed_webhook(at_period_end).status_code, 200)
        subscription.refresh_from_db()
        self.assertTrue(subscription.cancel_at_period_end)
        self.assertEqual(subscription.tier, WorkspaceTier.ADVANCE)

        immediate = {**at_period_end, "event_id": "evt_cancel_now", "cancellation_effective": "immediate"}
        self.assertEqual(self.signed_webhook(immediate).status_code, 200)
        subscription.refresh_from_db()
        self.assertEqual(subscription.tier, WorkspaceTier.FREE)
        self.assertFalse(subscription.is_active)
        self.assertFalse(subscription.engage_entitled)

    def test_invoice_html_escapes_stored_content(self):
        invoice = BillingInvoice.objects.create(
            invoice_number="INV-<bad>", workspace=self.workspace, amount=Decimal("10.00"),
            title="Test", line_items=[{"description": "<img src=x onerror=alert(1)>", "amount": "10.00"}],
            billing_name="<script>alert(1)</script>", billing_email="bad@example.com",
            payment_method="<b>card</b>",
        )
        html = generate_invoice_html(invoice)
        self.assertNotIn("<script>", html)
        self.assertNotIn("<img src=x", html)
        self.assertIn("&lt;script&gt;", html)
        self.assertIn("&lt;img", html)


class CreditReservationTests(TestCase):
    def setUp(self):
        self.workspace = Workspace.objects.create(name="Credits")
        get_or_create_workspace_billing(self.workspace)

    def test_reservation_is_atomic_idempotent_and_refundable(self):
        reservation, balance = reserve_credits(
            workspace=self.workspace, amount=10, action_type="TEST", description="test",
            idempotency_key="credit-op-1",
        )
        duplicate, duplicate_balance = reserve_credits(
            workspace=self.workspace, amount=10, action_type="TEST", description="test",
            idempotency_key="credit-op-1",
        )
        self.assertEqual(duplicate.id, reservation.id)
        self.assertEqual(balance, 5)
        self.assertEqual(duplicate_balance, 5)
        finalize_credit_reservation(reservation.id, success=False)
        reservation.refresh_from_db()
        self.assertEqual(reservation.status, CreditReservationStatus.REFUNDED)
        self.assertEqual(CreditAccount.objects.get(workspace=self.workspace).balance, 15)

    def test_insufficient_balance_never_goes_negative(self):
        reservation, balance = reserve_credits(
            workspace=self.workspace, amount=16, action_type="TEST", description="too much",
        )
        self.assertIsNone(reservation)
        self.assertEqual(balance, 15)
        self.assertEqual(CreditAccount.objects.get(workspace=self.workspace).total_used, 0)


class GenerationCreditRefundTests(TestCase):
    def test_required_image_failure_fails_post_and_refunds_reservation(self):
        workspace = Workspace.objects.create(name="Failed image")
        get_or_create_workspace_billing(workspace)
        post = SocialPost.objects.create(workspace=workspace, idea_title="Needs image")
        SocialPostVariant.objects.create(
            post=post, network=SocialNetwork.INSTAGRAM, copy="Instagram copy",
            scheduled_for=timezone.now(),
        )
        reservation, _ = reserve_credits(
            workspace=workspace, amount=3, action_type="POST_GENERATION",
            description="post with required image", post=post, idempotency_key="failed-image",
        )
        self.assertIsNotNone(reservation)
        with (
            patch("integrations.social.services.composer.generate_variants", return_value=post),
            patch(
                "integrations.linkedin.services.images.LinkedInImageGenerator.generate",
                side_effect=RuntimeError("provider unavailable"),
            ),
        ):
            from integrations.social.tasks import generate_post_variants
            result = generate_post_variants(
                str(post.id), controls={"include_image": True}, reservation_id=str(reservation.id)
            )
        post.refresh_from_db()
        reservation.refresh_from_db()
        self.assertEqual(result["status"], "FAILED")
        self.assertEqual(post.metadata["generation_status"], "FAILED")
        self.assertEqual(reservation.status, CreditReservationStatus.REFUNDED)
        self.assertEqual(CreditAccount.objects.get(workspace=workspace).balance, 15)


class CreditConcurrencyTests(TransactionTestCase):
    reset_sequences = True

    @skipUnless(connection.features.has_select_for_update, "Database does not support row locks")
    def test_concurrent_reservations_cannot_overspend(self):
        workspace = Workspace.objects.create(name="Concurrent credits")
        get_or_create_workspace_billing(workspace)

        def reserve(key):
            close_old_connections()
            try:
                current = Workspace.objects.get(pk=workspace.pk)
                reservation, _ = reserve_credits(
                    workspace=current, amount=10, action_type="CONCURRENT",
                    description="concurrent", idempotency_key=key,
                )
                return reservation is not None
            finally:
                close_old_connections()

        with ThreadPoolExecutor(max_workers=2) as executor:
            results = list(executor.map(reserve, ("concurrent-1", "concurrent-2")))
        self.assertEqual(sum(results), 1)
        self.assertEqual(CreditAccount.objects.get(workspace=workspace).balance, 5)

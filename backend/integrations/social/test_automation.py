from datetime import datetime, time
import struct
import zlib
from zoneinfo import ZoneInfo

from django.test import TestCase, override_settings
from django.utils import timezone
from integrations.social.models import (
    ApprovalMode,
    ConnectionState,
    MediaAssetSource,
    SocialConnection,
    SocialNetwork,
    SocialPostState,
    SocialProvider,
    SocialWorkspaceSettings,
)
from integrations.social.services.automation import fill_workspace_queue
from prospecting.models import Workspace


class FakeGenerator:
    def generate(self, *, networks, **kwargs):
        return {
            network: {
                "copy": f"Automatic {network.title()} post",
                "hashtags": ["#Automatic"],
                "metadata": {
                    "image_prompt": "A clean editorial workspace photograph",
                    "alt_text": "A clean workspace",
                },
            }
            for network in networks
        }


class FakeImageGenerator:
    def generate(self, post_id, prompt):
        width = height = 1080
        raw = b"".join(b"\x00" + bytes((80, 90, 120)) * width for _ in range(height))

        def chunk(kind, data):
            return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)

        image = (
            b"\x89PNG\r\n\x1a\n"
            + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(raw))
            + chunk(b"IEND", b"")
        )
        return "", {"content_type": "image/png"}, image


@override_settings(CONTENT_AUTOMATION_DEV_BOOTSTRAP=False, SOCIAL_PUBLISHER_DEFAULT="UPLOAD_POST")
class SocialAutomationTests(TestCase):
    def setUp(self):
        self.workspace = Workspace.objects.create(name="Multi-network automation")
        self.settings = SocialWorkspaceSettings.objects.create(
            workspace=self.workspace,
            brand_name="Studio Co",
            timezone="UTC",
            schedule_days=list(range(7)),
            post_time=time(12, 0),
            posts_per_week=1,
            queue_horizon_days=7,
            approval_mode=ApprovalMode.REQUIRE_APPROVAL,
            is_active=True,
        )
        for network in (SocialNetwork.LINKEDIN, SocialNetwork.INSTAGRAM):
            SocialConnection.objects.create(
                workspace=self.workspace,
                network=network,
                provider=SocialProvider.UPLOAD_POST,
                provider_profile_id=f"profile-{network.lower()}",
                provider_account_id=f"account-{network.lower()}",
                display_name=f"{network.title()} account",
                status=ConnectionState.CONNECTED,
                connected_at=timezone.now(),
            )

    def test_queue_fills_every_connected_network_and_creates_instagram_media(self):
        now = datetime(2026, 9, 15, 8, 0, tzinfo=ZoneInfo("UTC"))
        created = fill_workspace_queue(
            self.settings,
            generator=FakeGenerator(),
            image_generator=FakeImageGenerator(),
            now=now,
        )

        self.assertEqual(len(created), 2)
        variants = [post.variants.get() for post in created]
        self.assertEqual({variant.network for variant in variants}, {SocialNetwork.LINKEDIN, SocialNetwork.INSTAGRAM})
        self.assertTrue(all(variant.status == SocialPostState.NEEDS_REVIEW for variant in variants))
        instagram = next(variant for variant in variants if variant.network == SocialNetwork.INSTAGRAM)
        self.assertEqual(instagram.media_assets.get().source, MediaAssetSource.AI)
        self.assertEqual(
            fill_workspace_queue(
                self.settings,
                generator=FakeGenerator(),
                image_generator=FakeImageGenerator(),
                now=now,
            ),
            [],
        )

    def test_disabled_automation_does_not_create_posts(self):
        self.settings.is_active = False
        self.settings.save(update_fields=["is_active"])
        self.assertEqual(fill_workspace_queue(self.settings, generator=FakeGenerator()), [])

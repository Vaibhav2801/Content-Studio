from unittest.mock import Mock

from django.test import TestCase
from django.utils import timezone

from integrations.social.models import BrandProfile, SocialPost, SocialPostVariant, SocialWorkspaceSettings
from integrations.social.services.composer import (
    SocialContentGenerator,
    compose_image_generation_prompt,
    normalize_controls,
)
from integrations.social.services.editorial import LENGTH_TARGETS, normalized_text
from prospecting.models import Workspace


class SocialContentQualityTests(TestCase):
    def setUp(self):
        self.workspace = Workspace.objects.create(name="Content quality")
        self.settings = SocialWorkspaceSettings.objects.create(workspace=self.workspace, brand_name="Route Floww")
        self.brand = BrandProfile.objects.create(
            settings=self.settings, audience="Dispatchers", voice="Direct and practical",
            calls_to_action=["Review your dispatch handoff"], forbidden_topics=["guaranteed savings"],
            visual_direction="Tactile cut-paper illustration in navy and amber",
        )
        self.post = SocialPost.objects.create(
            workspace=self.workspace, idea_title="Better handoffs",
            idea_text="Assign an owner and make the next step visible before handing off a route change.",
        )
        self.router = Mock()
        self.generator = SocialContentGenerator(router=self.router)

    @staticmethod
    def draft(size, hook="A route change should not leave the next owner guessing.", image_prompt=""):
        detail = " Give each handoff an owner, a clear next action, and a place to check its status."
        copy = hook + "\n\n" + ((detail * 3 + "\n\n") * (size // (len(detail) * 3) + 1))
        return {"copy": copy[:size - 1] + ".", "hashtags": [], "image_prompt": image_prompt, "alt_text": ""}

    def generate(self, length="Medium", networks=None, include_image=False):
        return self.generator.generate(
            post=self.post, networks=networks or ["LINKEDIN"],
            controls=normalize_controls({"length": length, "include_image": include_image}),
        )

    def test_each_length_produces_a_different_sized_post_on_every_network(self):
        for network, targets in LENGTH_TARGETS.items():
            counts = []
            for length, (minimum, maximum) in targets.items():
                with self.subTest(network=network, length=length):
                    sample = self.draft((minimum + maximum) // 2, image_prompt="A layered cut-paper route map showing one amber path passing between two navy hands, with crisp edges, side lighting, generous negative space and a clear central focal point.")
                    self.router.generate.return_value = {"type": "structured", "data": {network: sample}}
                    result = self.generate(length, [network])[network]
                    counts.append(len(result["copy"]))
                    self.assertGreaterEqual(counts[-1], minimum)
                    self.assertLessEqual(counts[-1], maximum)
                    self.assertEqual(result["metadata"]["generation_status"], "AI")
            self.assertLess(counts[0], counts[1])
            self.assertLess(counts[1], counts[2])

    def test_same_length_output_is_revised_for_a_long_request(self):
        self.router.generate.side_effect = [
            {"type": "structured", "data": {"LINKEDIN": self.draft(950)}},
            {"type": "structured", "data": {"LINKEDIN": self.draft(2100)}},
        ]
        result = self.generate("Long")["LINKEDIN"]
        self.assertGreaterEqual(len(result["copy"]), 1800)
        self.assertEqual(normalized_text(result["copy"]), normalized_text(self.draft(2100)["copy"]))
        self.assertTrue(result["metadata"]["editorial_revision"])
        self.assertIn("Long requires 1800", self.router.generate.call_args.kwargs["prompt"])

    def test_only_failed_platform_is_revised_and_valid_platform_is_preserved(self):
        linkedin = self.draft(950)
        x = self.draft(150, hook="Who owns the next route change?")
        self.router.generate.side_effect = [
            {"type": "structured", "data": {"LINKEDIN": linkedin, "X": {"copy": "Too short."}}},
            {"type": "structured", "data": {"X": x}},
        ]
        result = self.generate(networks=["LINKEDIN", "X"])
        self.assertEqual(normalized_text(result["LINKEDIN"]["copy"]), normalized_text(linkedin["copy"]))
        self.assertEqual(result["X"]["copy"], x["copy"])
        schema = self.router.generate.call_args.kwargs["schema"]
        self.assertEqual(set(schema.model_fields), {"X"})

    def test_generic_or_recent_hook_is_revised(self):
        SocialPostVariant.objects.create(
            post=SocialPost.objects.create(workspace=self.workspace, idea_title="Previous"),
            network="LINKEDIN", copy="A route change should not leave the next owner guessing.\n\nPrevious details.",
            scheduled_for=timezone.now(),
        )
        for hook in ("Did you know handoffs matter?", "A route change should not leave the next owner guessing.", self.post.idea_title):
            with self.subTest(hook=hook):
                self.router.generate.side_effect = [
                    {"type": "structured", "data": {"LINKEDIN": self.draft(950, hook=hook)}},
                    {"type": "structured", "data": {"LINKEDIN": self.draft(1000, hook="An assigned owner makes the next step visible.")}},
                ]
                result = self.generate()["LINKEDIN"]
                self.assertTrue(result["metadata"]["editorial_revision"])

    def test_invalid_output_fails_without_template_or_overwriting_existing_copy(self):
        variant = SocialPostVariant.objects.create(post=self.post, network="LINKEDIN", copy="An existing draft to keep.", scheduled_for=timezone.now())
        self.router.generate.return_value = {"type": "structured", "data": {"LINKEDIN": {"copy": "Simple filler."}}}
        with self.assertRaisesRegex(RuntimeError, "after revision"):
            self.generate()
        self.assertEqual(self.router.generate.call_count, 2)
        variant.refresh_from_db()
        self.assertEqual(variant.copy, "An existing draft to keep.")

    def test_provider_failure_is_reported_without_another_editorial_request(self):
        self.router.generate.return_value = {"type": "error", "text": "Provider unavailable"}
        with self.assertRaisesRegex(RuntimeError, "generation is unavailable"):
            self.generate()
        self.router.generate.assert_called_once()

    def test_overlong_copy_is_rewritten_instead_of_silently_truncated(self):
        self.router.generate.side_effect = [
            {"type": "structured", "data": {"LINKEDIN": self.draft(3300)}},
            {"type": "structured", "data": {"LINKEDIN": self.draft(1000)}},
        ]
        result = self.generate()["LINKEDIN"]
        self.assertEqual(normalized_text(result["copy"]), normalized_text(self.draft(1000)["copy"]))
        self.assertIn("3000-character platform limit", self.router.generate.call_args.kwargs["prompt"])

    def test_x_limit_counts_hashtags_and_requests_revision(self):
        too_long = self.draft(260)
        too_long["hashtags"] = ["#DispatchOperationsLeadership"]
        self.router.generate.side_effect = [
            {"type": "structured", "data": {"X": too_long}},
            {"type": "structured", "data": {"X": self.draft(230)}},
        ]
        self.assertEqual(len(self.generate("Long", ["X"])["X"]["copy"]), 230)
        self.assertIn("280-character platform limit", self.router.generate.call_args.kwargs["prompt"])

    def test_vague_image_concept_is_revised(self):
        improved = self.draft(950, image_prompt="A tactile cut-paper scene of one amber route passing between two navy hands. Crisp layered edges, warm side lighting, a clean off-white background and a central focal point frame the handoff.")
        self.router.generate.side_effect = [
            {"type": "structured", "data": {"LINKEDIN": self.draft(950, image_prompt="A business image")}},
            {"type": "structured", "data": {"LINKEDIN": improved}},
        ]
        self.assertEqual(self.generate(include_image=True)["LINKEDIN"]["metadata"]["image_prompt"], improved["image_prompt"])

    def test_dense_copy_gets_readable_paragraphs_without_changing_words_or_an_extra_call(self):
        dense = self.draft(950)
        dense["copy"] = dense["copy"].replace("\n", " ")
        self.router.generate.return_value = {"type": "structured", "data": {"LINKEDIN": dense}}
        result = self.generate()["LINKEDIN"]
        self.router.generate.assert_called_once()
        self.assertLessEqual(len(result["copy"].splitlines()[0]), 180)
        self.assertTrue(all(len(paragraph) <= 450 for paragraph in result["copy"].split("\n\n")))
        self.assertEqual(normalized_text(result["copy"]), normalized_text(dense["copy"]))


    def test_prompt_inherits_brand_guidance_when_post_overrides_are_blank(self):
        self.router.generate.return_value = {"type": "structured", "data": {"LINKEDIN": self.draft(950)}}
        self.generate()
        prompt = self.router.generate.call_args.kwargs["prompt"]
        for saved_value in (self.brand.audience, self.brand.voice, self.brand.calls_to_action[0], self.brand.visual_direction, self.brand.forbidden_topics[0]):
            self.assertIn(saved_value, prompt)
        self.assertIn("Blank creative-requirement fields inherit", prompt)

    def test_image_prompt_uses_brand_profile_for_a_manual_draft_and_post_specific_override(self):
        self.post.metadata = {"creative_brief": {"target_audience": "New dispatchers", "must_avoid": ["busy backgrounds"]}}
        self.post.save(update_fields=["metadata"])
        variant = SocialPostVariant.objects.create(post=self.post, network="LINKEDIN", copy="Assign an owner before handing over a route.", scheduled_for=timezone.now())
        prompt = compose_image_generation_prompt(variant, "A route passed between two hands")
        for value in (self.brand.visual_direction, "New dispatchers", "guaranteed savings", "busy backgrounds", variant.copy):
            self.assertIn(value, prompt)

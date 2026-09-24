from unittest.mock import patch
from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from integrations.social.services.assistant import ContentStudioAssistantService
from prospecting.models import Workspace, WorkspaceMembership


@override_settings(CONTENT_AUTOMATION_DEV_BOOTSTRAP=False)
class ContentStudioAssistantTests(TestCase):
    def setUp(self):
        users = get_user_model()
        self.user = users.objects.create_user(username="assistant-tester", email="assistant@example.com")
        self.workspace = Workspace.objects.create(name="Assistant Workspace")
        WorkspaceMembership.objects.create(
            workspace=self.workspace,
            user=self.user,
            role=WorkspaceMembership.OWNER,
            is_active=True,
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_service_returns_default_welcome_when_empty(self):
        service = ContentStudioAssistantService()
        response = service.respond([])
        self.assertIn("Content Studio AI Assistant", response["reply"])
        self.assertTrue(len(response["suggestions"]) > 0)
        self.assertTrue(len(response["actions"]) > 0)

    @patch("integrations.social.services.assistant.ContentStudioAssistantService._try_llm", return_value=None)
    def test_knowledge_engine_answers_feature_queries(self, mock_llm):
        service = ContentStudioAssistantService()
        
        # Test Approvals feature
        response = service.respond([{"role": "user", "content": "How do approvals and review queue work?"}])
        self.assertIn("Approvals", response["reply"])
        self.assertIn("/content/approvals", response["reply"])

        # Test Composer feature
        response = service.respond([{"role": "user", "content": "How do I create multi-platform posts?"}])
        self.assertIn("Post Composer", response["reply"])
        self.assertIn("/content/create", response["reply"])

        # Test Connections feature
        response = service.respond([{"role": "user", "content": "How do I connect Instagram or LinkedIn?"}])
        self.assertIn("Connections", response["reply"])
        self.assertIn("/content/connections", response["reply"])

        # Test Brand Brain feature
        response = service.respond([{"role": "user", "content": "What is Brand Brain?"}])
        self.assertIn("Brand Brain", response["reply"])

    @patch("integrations.social.services.assistant.ContentStudioAssistantService._try_llm")
    def test_service_uses_llm_when_available(self, mock_llm):
        mock_llm.return_value = "Here is how you use the Post Composer at /content/create."
        service = ContentStudioAssistantService()
        response = service.respond([{"role": "user", "content": "Tell me about composer"}])
        self.assertEqual(response["reply"], "Here is how you use the Post Composer at /content/create.")
        self.assertEqual(response["provider"], "ai")

    @patch("integrations.social.services.assistant.ContentStudioAssistantService._try_llm", return_value=None)
    def test_api_endpoint_handles_chat_post(self, mock_llm):
        response = self.client.post(
            "/api/v3/social/assistant/chat/",
            data={
                "messages": [{"role": "user", "content": "How can I schedule a post on the calendar?"}],
                "current_path": "/content/calendar",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("reply", data)
        self.assertTrue("calendar" in data["reply"].lower())
        self.assertIn("suggestions", data)
        self.assertIn("actions", data)

"""
Content Studio Assistant Service.

Provides an AI assistant capable of answering user questions about any feature,
workflow, configuration, or best practice in Content Studio.
Integrates with IntelligentRouter when LLM credentials are available, and provides
a comprehensive fallback knowledge engine for offline / deterministic mode.
"""

import logging
import re
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# Comprehensive knowledge base cataloging all Content Studio features, routes, and capabilities
PROJECT_FEATURES = {
    "composer": {
        "name": "Post Composer",
        "route": "/content/create",
        "keywords": ["create", "compose", "composer", "draft", "post", "write", "variant", "generate", "image", "alt text", "hook", "emoji", "tone", "publish now", "schedule post"],
        "description": "Create and generate multi-platform social posts with tailored copy, AI images, and scheduling.",
        "details": (
            "The **Post Composer** (`/content/create`) lets you generate tailored social content across multiple networks from a single idea.\n\n"
            "**Key Capabilities:**\n"
            "- **Multi-Platform Support**: Target LinkedIn, Instagram, X (Twitter), Facebook, Threads, YouTube, TikTok, and Pinterest with platform-specific formatting and limits.\n"
            "- **Creative Brief & Controls**: Adjust hook style, emoji density, paragraph length, and brand voice controls.\n"
            "- **Grounding with Content Sources**: Attach saved knowledge documents, URLs, or notes so AI never invents unsupported claims.\n"
            "- **AI Media Manager**: Generate contextual images, reorder gallery assets, regenerate images, and generate alt-text for accessibility.\n"
            "- **Per-Variant Editing & Rewriting**: Fine-tune each platform's copy individually or use AI rewrite actions (shorten, expand, punchier, etc.).\n"
            "- **Publish or Schedule**: Schedule posts for optimal times, publish immediately, or submit for team approval."
        ),
        "actions": [{"label": "Open Composer", "route": "/content/create"}],
    },
    "series": {
        "name": "Content Series",
        "route": "/content/series",
        "keywords": ["series", "campaign", "multi-part", "cadence", "batch", "chapters", "episodes"],
        "description": "Generate a cohesive multi-part content series across a scheduled timeline.",
        "details": (
            "**Content Series** (`/content/series`) enables you to plan and generate multi-part campaigns that tell a continuous story.\n\n"
            "**Key Capabilities:**\n"
            "- **Thematic Continuity**: Generates cohesive posts that each work as standalone content while building on previous chapters.\n"
            "- **Cadence Scheduling**: Set delivery intervals (e.g. daily, twice weekly, weekly) to automatically space out posts.\n"
            "- **Multi-Platform Consistency**: Each part generates variants for all your connected social accounts."
        ),
        "actions": [{"label": "Create Series", "route": "/content/series"}],
    },
    "approvals": {
        "name": "Approvals & Review Queue",
        "route": "/content/approvals",
        "keywords": ["approval", "approvals", "review", "reject", "changes", "batch approve", "governance", "in review", "version"],
        "description": "Review, approve, request changes, or reject post variants before they go live.",
        "details": (
            "The **Approvals** screen (`/content/approvals`) acts as the governance checkpoint for your team's content.\n\n"
            "**Key Capabilities:**\n"
            "- **Review Queue**: View posts grouped by status: *Needs Review*, *Changes Requested*, and *Approved*.\n"
            "- **Batch Approval**: Select multiple posts and approve them together with one click.\n"
            "- **Strict Version Tracking**: If an approved post is edited, the system safely invalidates approval and creates a new draft version to prevent unapproved edits from publishing.\n"
            "- **Quality Checklist**: Automatically verifies character limits, hashtag compliance, and image requirements before publishing.\n"
            "- **Direct Publishing**: Publish approved posts immediately with 'Publish Now'."
        ),
        "actions": [{"label": "Open Approvals", "route": "/content/approvals"}],
    },
    "calendar": {
        "name": "Content Calendar",
        "route": "/content/calendar",
        "keywords": ["calendar", "schedule", "reschedule", "timeline", "month", "week", "day", "date"],
        "description": "Interactive visual calendar showing scheduled, publishing, and published posts.",
        "details": (
            "The **Content Calendar** (`/content/calendar`) provides a unified timeline of all scheduled content.\n\n"
            "**Key Capabilities:**\n"
            "- **Flexible Views**: Switch between Month, Week, and Day views.\n"
            "- **Color-Coded Statuses**: Clearly identifies scheduled, in-flight, published, and failed posts.\n"
            "- **Quick Rescheduling**: Click or drag posts to new dates and times directly within the calendar.\n"
            "- **Network Filtering**: Filter calendar events by specific social networks or post statuses."
        ),
        "actions": [{"label": "View Calendar", "route": "/content/calendar"}],
    },
    "library": {
        "name": "Content Library",
        "route": "/content/library",
        "keywords": ["library", "archive", "duplicate", "history", "assets", "search posts", "reuse"],
        "description": "Central repository to search, reuse, duplicate, and archive posts across your workspace.",
        "details": (
            "The **Content Library** (`/content/library`) is your workspace's searchable archive of past and current content.\n\n"
            "**Key Capabilities:**\n"
            "- **Search & Filters**: Quickly locate posts by keyword, network, date range, or tag.\n"
            "- **Duplicate & Remix**: Turn past high-performing posts into new drafts with one click.\n"
            "- **Lifecycle Management**: Archive deprecated content or clean up unused drafts."
        ),
        "actions": [{"label": "Browse Library", "route": "/content/library"}],
    },
    "engage": {
        "name": "Engagement Hub",
        "route": "/content/engage",
        "keywords": ["engage", "engagement", "inbox", "comments", "mentions", "reviews", "replies", "automations", "sentiment"],
        "description": "Unified social inbox for comments, mentions, sentiment tracking, and response automations.",
        "details": (
            "The **Engagement Hub** (`/content/engage`) connects social interactions into a manageable workflow.\n\n"
            "**Key Capabilities:**\n"
            "- **Unified Inbox**: View and respond to inbound comments and mentions across connected networks.\n"
            "- **Review Queue**: Moderate customer reviews and track community sentiment.\n"
            "- **Smart Automations**: Configure automated reply triggers, smart routing, and auto-tagging.\n"
            "- **Campaign Tracking**: Monitor inbound audience engagement tied directly to specific post campaigns."
        ),
        "actions": [{"label": "Open Engagement Hub", "route": "/content/engage"}],
    },
    "connections": {
        "name": "Social Connections",
        "route": "/content/connections",
        "keywords": ["connect", "connection", "connections", "zernio", "linkedin", "instagram", "facebook", "twitter", "oauth", "reconnect", "health"],
        "description": "Connect and manage social accounts, check connection health, and refresh OAuth tokens.",
        "details": (
            "The **Connections** view (`/content/connections`) manages your authorized social publishing accounts.\n\n"
            "**Key Capabilities:**\n"
            "- **Universal Provider (Zernio)**: Connect LinkedIn, Instagram, Facebook, X, Threads, and YouTube through a secure unified gateway.\n"
            "- **Health Monitoring**: Real-time indicators show whether connections are *Active*, *Needs Attention*, *Degraded*, or *Disconnected*.\n"
            "- **Account Selection**: Easily select between personal profiles and company pages during OAuth setup.\n"
            "- **Seamless Reconnection**: Reauthorize expired tokens without losing past posting history or schedules."
        ),
        "actions": [{"label": "Manage Connections", "route": "/content/connections"}],
    },
    "analytics": {
        "name": "Analytics & Insights",
        "route": "/content/analytics",
        "keywords": ["analytics", "metrics", "impressions", "reach", "clicks", "shares", "engagement rate", "performance", "suggestions"],
        "description": "Performance dashboards, cross-platform metric tracking, and AI-driven growth recommendations.",
        "details": (
            "The **Analytics** view (`/content/analytics`) provides deep performance data on your published content.\n\n"
            "**Key Capabilities:**\n"
            "- **Core Metrics**: Track impressions, reach, clicks, shares, comments, and engagement rate across all networks.\n"
            "- **Live Metric Sync**: Refresh performance data directly from social network APIs with the refresh action.\n"
            "- **AI Growth Suggestions**: Receive actionable insights on best posting times, top-performing formats, and high-impact hooks.\n"
            "- **Explicit Decisions**: Accept or dismiss AI recommendations to train future suggestions."
        ),
        "actions": [{"label": "View Analytics", "route": "/content/analytics"}],
    },
    "brand_brain": {
        "name": "Brand Brain & Knowledge Hub",
        "route": "/content/settings",
        "keywords": ["brand", "brain", "voice", "tone", "sources", "knowledge", "story interview", "interview", "guidelines", "target audience"],
        "description": "Define your brand voice, target audience, upload reference sources, and run Story Interviews.",
        "details": (
            "**Brand Brain & Knowledge Hub** ensures all generated content matches your company's authentic voice.\n\n"
            "**Key Capabilities:**\n"
            "- **Brand Identity**: Define your mission, target personas, tone pillars, and words/topics to avoid.\n"
            "- **Content Sources**: Upload PDFs, URLs, or paste notes. Extracted text is indexed and referenced during generation with grounded citations.\n"
            "- **Story Interview**: Complete guided founder/team interviews to convert stories, milestones, and customer wins into post prompts.\n"
            "- **Voice Suggestions**: The AI learns from your manual edits over time, suggesting refinements to your Brand Brain guidelines."
        ),
        "actions": [{"label": "Configure Brand Brain", "route": "/content/settings"}],
    },
    "settings": {
        "name": "Workspace Settings & Governance",
        "route": "/content/settings",
        "keywords": ["settings", "workspace", "switch workspace", "timezone", "schedule", "export", "delete", "data", "gdpr"],
        "description": "Manage workspace configuration, default schedules, timezones, data export, and deletion.",
        "details": (
            "The **Settings** view (`/content/settings`) gives you full administrative control over your workspace.\n\n"
            "**Key Capabilities:**\n"
            "- **Publishing Toggle**: Master switch to pause or resume automated publishing.\n"
            "- **Timezone & Slots**: Configure your workspace's local timezone and standard publishing windows.\n"
            "- **Multi-Workspace**: Switch between workspaces or create new ones from the top workspace menu.\n"
            "- **Data Export & Privacy**: Download complete workspace data (posts, metrics, audit logs) or trigger GDPR-compliant workspace deletion."
        ),
        "actions": [{"label": "Open Settings", "route": "/content/settings"}],
    },
    "onboarding": {
        "name": "Onboarding Setup",
        "route": "/content/onboarding",
        "keywords": ["onboarding", "setup", "wizard", "start", "welcome", "first post", "get started"],
        "description": "Guided 4-step wizard to set up business profile, connect accounts, and create your first post.",
        "details": (
            "The **Onboarding Wizard** (`/content/onboarding`) gets new teams publishing quickly in four simple steps:\n\n"
            "1. **Business Profile**: Enter your business name and industry.\n"
            "2. **Connect Account**: Authorize your first social channel (e.g. LinkedIn or Instagram).\n"
            "3. **Brand Brain**: Initialize your core voice guidelines and tone.\n"
            "4. **First Post**: Draft and schedule your inaugural post."
        ),
        "actions": [{"label": "Go to Onboarding", "route": "/content/onboarding"}],
    },
    "home": {
        "name": "Content Studio Home",
        "route": "/content",
        "keywords": ["home", "dashboard", "overview", "summary", "status", "recent", "needs attention"],
        "description": "Central dashboard summarizing posts in review, upcoming schedule, failures, and account health.",
        "details": (
            "The **Content Studio Home** (`/content`) provides an executive view of your publishing pipeline.\n\n"
            "- Track pending approvals, upcoming scheduled posts, and recent publish statuses.\n"
            "- View health alerts for any connections that need re-authorization.\n"
            "- Fast-track new posts with the 'Create post' action."
        ),
        "actions": [{"label": "Go to Home", "route": "/content"}],
    },
}

QUICK_SUGGESTIONS = [
    "How do I create multi-platform posts?",
    "How does the Approvals workflow work?",
    "How do I connect social networks?",
    "What is Brand Brain & how to use it?",
    "Explain Analytics & Suggestions",
    "What can I do in Engagement Hub?",
]


class ContentStudioAssistantService:
    """Provides AI assistant responses about any Content Studio platform feature."""

    system_prompt = (
        "You are the official Content Studio Platform AI Assistant. Your job is to help users understand, navigate, "
        "and master all features of the Content Studio platform. Be helpful, concise, friendly, and structured. "
        "Use markdown formatting (headings, bullet points, bold text) and explicitly reference application routes "
        "like `/content/create`, `/content/calendar`, `/content/approvals`, `/content/connections`, `/content/settings`, "
        "`/content/series`, `/content/library`, `/content/engage`, and `/content/analytics` whenever relevant. "
        "Never invent fictional features that don't exist in the project."
    )

    def __init__(self, router=None):
        self.router = router

    def get_router(self):
        if self.router is not None:
            return self.router
        try:
            from llm.router import IntelligentRouter
            self.router = IntelligentRouter()
            return self.router
        except Exception as exc:
            logger.debug("Could not initialize IntelligentRouter for Assistant: %s", exc)
            return None

    def respond(self, messages: List[Dict[str, str]], current_path: str = "") -> Dict[str, Any]:
        """
        Process the user's conversation and return an assistant reply with deep links and suggested actions.
        """
        user_message = ""
        for msg in reversed(messages):
            if msg.get("role") == "user":
                user_message = msg.get("content", "").strip()
                break

        if not user_message:
            return {
                "reply": "Hello! I'm your Content Studio AI Assistant. Ask me anything about creating posts, setting up social connections, using Brand Brain, managing approvals, reviewing analytics, or navigating the platform!",
                "suggestions": QUICK_SUGGESTIONS[:4],
                "actions": [{"label": "Create Post", "route": "/content/create"}, {"label": "View Calendar", "route": "/content/calendar"}],
            }

        # Try LLM via IntelligentRouter if available
        llm_reply = self._try_llm(messages, current_path=current_path)
        if llm_reply:
            matched_feature = self._find_matching_feature(user_message, current_path)
            actions = matched_feature.get("actions", []) if matched_feature else []
            return {
                "reply": llm_reply,
                "suggestions": self._relevant_suggestions(user_message),
                "actions": actions,
                "provider": "ai",
            }

        # Knowledge Engine Fallback
        return self._knowledge_engine_reply(user_message, current_path)

    @staticmethod
    def has_llm_credentials() -> bool:
        import os
        return any(bool(os.environ.get(k)) for k in ["GEMINI_API_KEY", "GROQ_API_KEY", "CEREBRAS_API_KEY", "OPENROUTER_API_KEY"])

    def _try_llm(self, messages: List[Dict[str, str]], current_path: str = "") -> Optional[str]:
        if not self.has_llm_credentials():
            return None

        router = self.get_router()
        if not router:
            return None

        # Build context prompt
        feature_summary = "\n".join([f"- {f['name']} ({f['route']}): {f['description']}" for f in PROJECT_FEATURES.values()])
        context = (
            f"Content Studio Features & Routes:\n{feature_summary}\n\n"
            f"User is currently on page: {current_path or '/content'}\n\n"
            "User conversation history:\n"
        )
        for msg in messages[-6:]:
            role = "User" if msg.get("role") == "user" else "Assistant"
            context += f"{role}: {msg.get('content', '')}\n"

        context += "\nRespond as the Content Studio AI assistant. Provide clear, accurate instructions and reference routes."

        try:
            result = router.generate(
                prompt=context,
                system_prompt=self.system_prompt,
            )
            if isinstance(result, dict):
                text = result.get("text") or (result.get("data", {}).get("reply") if result.get("type") == "structured" else "")
                if text and text.strip():
                    text = text.strip()
                    if text.startswith("{") and text.endswith("}"):
                        try:
                            import json
                            parsed_json = json.loads(text)
                            if isinstance(parsed_json, dict):
                                text = (
                                    parsed_json.get("assistant_response")
                                    or parsed_json.get("reply")
                                    or parsed_json.get("text")
                                    or parsed_json.get("content")
                                    or text
                                )
                        except Exception:
                            pass
                    return text.strip()
        except Exception as exc:
            logger.info("Assistant LLM generation bypassed, using knowledge engine: %s", exc)

        return None

    def _find_matching_feature(self, query: str, current_path: str = "") -> Optional[Dict[str, Any]]:
        query_lower = query.lower()
        query_words = set(re.findall(r"\b\w+\b", query_lower))

        best_match = None
        highest_score = 0

        for key, feature in PROJECT_FEATURES.items():
            score = 0
            # Direct keyword match
            for kw in feature["keywords"]:
                if kw in query_lower:
                    score += 3
            # Check route name match
            if key in query_lower or feature["route"].replace("/content/", "") in query_lower:
                score += 4
            # Contextual weight if the user asks "here" or "this page"
            if ("here" in query_words or "this page" in query_lower or "how do i use this" in query_lower) and feature["route"] == current_path:
                score += 5

            if score > highest_score:
                highest_score = score
                best_match = feature

        if highest_score > 0:
            return best_match

        # If user asks generic "what can you do" or "help" while on a specific page
        if current_path:
            for feature in PROJECT_FEATURES.values():
                if feature["route"] == current_path:
                    return feature

        return None

    def _knowledge_engine_reply(self, query: str, current_path: str = "") -> Dict[str, Any]:
        """Provides rich, deterministic feature answers when LLM API keys are not active."""
        query_lower = query.lower()

        # Handle general greetings
        if query_lower in ["hi", "hello", "hey", "help", "what can you do?", "what can you do"]:
            return {
                "reply": (
                    "👋 **Hi! I'm your Content Studio AI Assistant.**\n\n"
                    "I can guide you through every feature of the Content Studio platform:\n\n"
                    "- ✍️ **[Post Composer](/content/create)**: Draft multi-platform posts with AI variant generation & image creation.\n"
                    "- 📚 **[Content Series](/content/series)**: Create multi-part thematic campaigns on a cadence.\n"
                    "- ✅ **[Approvals](/content/approvals)**: Manage team reviews, batch approvals, and publishing governance.\n"
                    "- 📅 **[Content Calendar](/content/calendar)**: Visualize and reschedule scheduled posts across networks.\n"
                    "- 🔗 **[Connections](/content/connections)**: Connect social accounts (LinkedIn, Instagram, X, Facebook, etc.) via Zernio.\n"
                    "- 📊 **[Analytics](/content/analytics)**: Track impressions, reach, engagement rate, and AI optimization suggestions.\n"
                    "- 🧠 **[Brand Brain & Hub](/content/settings)**: Keep content aligned with your tone, personas, and source files.\n"
                    "- 💬 **[Engagement Hub](/content/engage)**: Monitor comments, reviews, and automated replies.\n\n"
                    "Click any of the topics below or ask me a specific question!"
                ),
                "suggestions": QUICK_SUGGESTIONS,
                "actions": [
                    {"label": "Create Post", "route": "/content/create"},
                    {"label": "View Calendar", "route": "/content/calendar"},
                    {"label": "Manage Connections", "route": "/content/connections"},
                ],
            }

        matched = self._find_matching_feature(query, current_path)
        if matched:
            reply = f"### {matched['name']}\n\n{matched['details']}"
            return {
                "reply": reply,
                "suggestions": self._relevant_suggestions(query),
                "actions": matched.get("actions", []),
            }

        # Fallback general query handler
        return {
            "reply": (
                f"I understand you're asking about **'{query}'**.\n\n"
                "In Content Studio, you can manage your complete content lifecycle across these core areas:\n\n"
                "- **Create & Publish**: Use the **[Post Composer](/content/create)** or **[Content Series](/content/series)** to craft tailored posts for LinkedIn, Instagram, X, Facebook, and more.\n"
                "- **Review & Schedule**: Review drafts in **[Approvals](/content/approvals)** and check your timeline on the **[Content Calendar](/content/calendar)**.\n"
                "- **Grow & Optimize**: Monitor performance in **[Analytics](/content/analytics)** and set your brand voice in **[Brand Brain](/content/settings)**.\n\n"
                "Would you like more details on any of these workflows?"
            ),
            "suggestions": QUICK_SUGGESTIONS[:4],
            "actions": [{"label": "Open Composer", "route": "/content/create"}, {"label": "Go to Home", "route": "/content"}],
        }

    def _relevant_suggestions(self, query: str) -> List[str]:
        q = query.lower()
        if "approval" in q or "review" in q:
            return ["Can I batch approve posts?", "What happens if I edit an approved post?", "How do I publish now?"]
        if "create" in q or "post" in q or "composer" in q:
            return ["How does multi-platform generation work?", "How do I attach Content Sources?", "How to generate AI images?"]
        if "connect" in q or "account" in q or "network" in q:
            return ["How do I connect Instagram?", "What is Zernio?", "How to reconnect an expired account?"]
        if "brand" in q or "tone" in q or "source" in q:
            return ["What is Story Interview?", "How do Content Sources work?", "How does Brand Brain affect drafts?"]
        if "analytics" in q or "metrics" in q:
            return ["How often are metrics refreshed?", "What are Analytics Suggestions?", "Can I compare networks?"]
        return QUICK_SUGGESTIONS[:3]

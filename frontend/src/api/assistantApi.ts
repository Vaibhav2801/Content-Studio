import { csrfToken } from './auth'

export interface ChatAction {
  label: string
  route: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  actions?: ChatAction[]
  suggestions?: string[]
}

export interface AssistantChatResponse {
  reply: string
  suggestions?: string[]
  actions?: ChatAction[]
  provider?: string
}

const baseUrl = (import.meta.env.VITE_SOCIAL_API_BASE_URL as string | undefined) ?? '/api/v3/social'

export const DEFAULT_QUICK_SUGGESTIONS = [
  'How do I create multi-platform posts?',
  'How does the Approvals workflow work?',
  'How do I connect social networks?',
  'What is Brand Brain & how to use it?',
  'Explain Analytics & Suggestions',
  'What can I do in Engagement Hub?',
]

// Client-side fallback knowledge for demo mode, offline, or when backend is unreachable
const CLIENT_KNOWLEDGE_BASE: Record<string, {
  name: string
  route: string
  keywords: string[]
  details: string
  actions: ChatAction[]
}> = {
  composer: {
    name: 'Post Composer',
    route: '/content/create',
    keywords: ['create', 'compose', 'composer', 'draft', 'post', 'write', 'variant', 'generate', 'image', 'alt text', 'hook', 'emoji', 'tone'],
    details: 'The **Post Composer** (`/content/create`) lets you generate tailored social content across multiple networks simultaneously from a single concept.\n\n- **Multi-Platform Support**: Tailors formatting and character counts for LinkedIn, Instagram, X (Twitter), Facebook, Threads, YouTube, and TikTok.\n- **Creative Brief & Voice**: Customize hooks, emoji density, and brand tone pillars.\n- **Grounding Sources**: Attach saved knowledge articles or documents to ensure factual accuracy.\n- **Media Manager**: Generate AI images, reorder gallery photos, and generate accessible alt text.\n- **Per-Variant Editing**: Fine-tune individual platform drafts or use one-click AI rewrite actions.',
    actions: [{ label: 'Open Composer', route: '/content/create' }],
  },
  series: {
    name: 'Content Series',
    route: '/content/series',
    keywords: ['series', 'campaign', 'multi-part', 'cadence', 'batch', 'chapters', 'episodes'],
    details: '**Content Series** (`/content/series`) enables you to plan and generate multi-part campaigns that tell an evolving narrative across a scheduled cadence.\n\n- **Thematic Consistency**: Each post stands on its own while building upon earlier chapters.\n- **Cadence Scheduling**: Set intervals (daily, weekly, bi-weekly) to automatically space out your series.\n- **Multi-Network Output**: Generates unified variants for all connected platforms.',
    actions: [{ label: 'Create Series', route: '/content/series' }],
  },
  approvals: {
    name: 'Approvals & Governance',
    route: '/content/approvals',
    keywords: ['approval', 'approvals', 'review', 'reject', 'changes', 'batch approve', 'governance', 'in review', 'version'],
    details: 'The **Approvals** screen (`/content/approvals`) acts as the quality gateway for your team before content is published.\n\n- **Review Queue**: View drafts categorized by *Needs Review*, *Changes Requested*, and *Approved*.\n- **Batch Approval**: Select multiple variants and approve them all at once.\n- **Strict Version Control**: Editing an approved post immediately creates a new draft version and revokes approval to prevent unintended changes from publishing.\n- **Quality Checks**: Enforces character limits, hashtag compliance, and media requirements.',
    actions: [{ label: 'Open Approvals', route: '/content/approvals' }],
  },
  calendar: {
    name: 'Content Calendar',
    route: '/content/calendar',
    keywords: ['calendar', 'schedule', 'reschedule', 'timeline', 'month', 'week', 'day', 'date'],
    details: 'The **Content Calendar** (`/content/calendar`) provides a visual bird\'s-eye view of all upcoming and past posts.\n\n- **Multiple Views**: Seamlessly switch between Month, Week, and Day layouts.\n- **Drag & Click Rescheduling**: Change publishing dates and times on the fly.\n- **Color-Coded Statuses**: Easily distinguish scheduled, in-review, published, and failed posts.\n- **Network Filtering**: Isolate specific social platforms to focus on individual channel schedules.',
    actions: [{ label: 'View Calendar', route: '/content/calendar' }],
  },
  library: {
    name: 'Content Library',
    route: '/content/library',
    keywords: ['library', 'archive', 'duplicate', 'history', 'assets', 'search posts', 'reuse'],
    details: 'The **Content Library** (`/content/library`) is your central archive of all created posts and creative assets.\n\n- **Instant Search**: Search through post bodies, ideas, and tags.\n- **Duplicate & Remix**: One-click duplication lets you repurpose top-performing posts.\n- **Archival**: Safely archive outdated posts to keep your workspace tidy.',
    actions: [{ label: 'Browse Library', route: '/content/library' }],
  },
  engage: {
    name: 'Engagement Hub',
    route: '/content/engage',
    keywords: ['engage', 'engagement', 'inbox', 'comments', 'mentions', 'reviews', 'replies', 'automations', 'sentiment'],
    details: 'The **Engagement Hub** (`/content/engage`) consolidates customer interactions across your connected channels.\n\n- **Unified Inbox**: Monitor and reply to incoming comments and mentions.\n- **Review Moderation**: Triage product reviews and analyze community sentiment.\n- **Smart Automations**: Configure rules for instant replies, routing, and auto-tagging.',
    actions: [{ label: 'Open Engagement Hub', route: '/content/engage' }],
  },
  connections: {
    name: 'Social Connections',
    route: '/content/connections',
    keywords: ['connect', 'connection', 'connections', 'zernio', 'linkedin', 'instagram', 'facebook', 'twitter', 'oauth', 'reconnect', 'health'],
    details: 'The **Connections** view (`/content/connections`) manages your authorized social channel integrations.\n\n- **Zernio Provider**: Unified integration for LinkedIn, Instagram, Facebook, X, Threads, and YouTube.\n- **Health Monitoring**: Real-time indicators alert you if tokens require re-authorization.\n- **Easy Reconnect**: Quickly refresh permissions without disrupting scheduled content.',
    actions: [{ label: 'Manage Connections', route: '/content/connections' }],
  },
  analytics: {
    name: 'Analytics & Insights',
    route: '/content/analytics',
    keywords: ['analytics', 'metrics', 'impressions', 'reach', 'clicks', 'shares', 'engagement rate', 'performance', 'suggestions'],
    details: 'The **Analytics** view (`/content/analytics`) measures your audience growth and post engagement.\n\n- **Cross-Platform Metrics**: Compare impressions, reach, clicks, shares, and engagement rates.\n- **Live Refresh**: Fetch updated metrics directly from provider APIs.\n- **AI Growth Suggestions**: Receive data-backed recommendations on optimal posting schedules, hook styles, and topics.',
    actions: [{ label: 'View Analytics', route: '/content/analytics' }],
  },
  brand_brain: {
    name: 'Brand Brain & Knowledge Hub',
    route: '/content/settings',
    keywords: ['brand', 'brain', 'voice', 'tone', 'sources', 'knowledge', 'story interview', 'interview', 'guidelines'],
    details: '**Brand Brain & Knowledge Hub** keeps your AI content authentic to your company\'s tone and facts.\n\n- **Voice & Personas**: Configure tone guidelines, target personas, and words to avoid.\n- **Content Sources**: Upload PDFs, links, or notes to ground AI drafts in your own data.\n- **Story Interview**: Complete guided Q&As to turn founder stories and milestones into high-converting posts.',
    actions: [{ label: 'Open Brand Brain', route: '/content/settings' }],
  },
}

function getClientFallbackReply(query: string, currentPath: string): AssistantChatResponse {
  const q = query.toLowerCase()

  if (q === 'hi' || q === 'hello' || q === 'help' || q.includes('what can you do')) {
    return {
      reply: '👋 **Hello! I am your Content Studio AI Assistant.**\n\nI can help you navigate, use, and master any feature across the platform:\n\n- ✍️ **[Post Composer](/content/create)**: Draft multi-platform posts with AI variant generation & image creation.\n- 📚 **[Content Series](/content/series)**: Create multi-part thematic campaigns.\n- ✅ **[Approvals](/content/approvals)**: Manage team reviews, batch approvals, and quality governance.\n- 📅 **[Content Calendar](/content/calendar)**: Visualize and reschedule scheduled posts across networks.\n- 🔗 **[Connections](/content/connections)**: Connect social accounts (LinkedIn, Instagram, X, Facebook, etc.).\n- 📊 **[Analytics](/content/analytics)**: Track impressions, reach, engagement rate, and AI optimization suggestions.\n- 🧠 **[Brand Brain](/content/settings)**: Keep content aligned with your tone, personas, and source files.\n- 💬 **[Engagement Hub](/content/engage)**: Monitor comments, reviews, and automated replies.\n\nClick any topic below or ask me any question!',
      suggestions: DEFAULT_QUICK_SUGGESTIONS,
      actions: [
        { label: 'Create Post', route: '/content/create' },
        { label: 'View Calendar', route: '/content/calendar' },
        { label: 'Manage Connections', route: '/content/connections' },
      ],
    }
  }

  for (const feature of Object.values(CLIENT_KNOWLEDGE_BASE)) {
    if (feature.keywords.some((kw) => q.includes(kw)) || feature.route.includes(q)) {
      return {
        reply: `### ${feature.name}\n\n${feature.details}`,
        suggestions: DEFAULT_QUICK_SUGGESTIONS.slice(0, 3),
        actions: feature.actions,
      }
    }
  }

  // Current path fallback
  if (currentPath) {
    const currentFeature = Object.values(CLIENT_KNOWLEDGE_BASE).find((f) => f.route === currentPath)
    if (currentFeature && (q.includes('this') || q.includes('here') || q.includes('how do i use'))) {
      return {
        reply: `### ${currentFeature.name}\n\n${currentFeature.details}`,
        suggestions: DEFAULT_QUICK_SUGGESTIONS.slice(0, 3),
        actions: currentFeature.actions,
      }
    }
  }

  return {
    reply: `I can help you with **"${query}"** in Content Studio!\n\nHere are the main areas to explore:\n- **[Post Composer](/content/create)** to draft tailored multi-channel content.\n- **[Approvals](/content/approvals)** to review and approve posts before publishing.\n- **[Content Calendar](/content/calendar)** to view and reschedule your timeline.\n- **[Analytics](/content/analytics)** to see performance metrics and AI suggestions.\n\nWhat specific part of this workflow would you like to know more about?`,
    suggestions: DEFAULT_QUICK_SUGGESTIONS.slice(0, 4),
    actions: [{ label: 'Go to Composer', route: '/content/create' }, { label: 'Go to Home', route: '/content' }],
  }
}

export const assistantApi = {
  chat: async (messages: ChatMessage[], currentPath: string): Promise<AssistantChatResponse> => {
    const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user')?.content || ''

    try {
      const headers = new Headers({
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      })
      const token = csrfToken()
      if (token) headers.set('X-CSRFToken', token)

      const response = await fetch(`${baseUrl}/assistant/chat/`, {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify({
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
          current_path: currentPath,
        }),
      })

      if (response.ok) {
        return (await response.json()) as AssistantChatResponse
      }
    } catch {
      // Backend not running, network error, or demo mode
    }

    return getClientFallbackReply(lastUserMessage, currentPath)
  },
}

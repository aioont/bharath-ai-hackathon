# Frontend Integration Guide: Chat History

## Overview

This guide shows how to integrate the persistent chat history feature into your React frontend.

## ✨ Key Features

- **Load past conversations** from database
- **Continue existing conversations** with conversation UUID
- **Automatic history persistence** (no code changes needed!)
- **Multilingual audio history** with playback
- **Analytics dashboard** showing cache hit rate & usage

---

## 🔧 Implementation Steps

### Step 1: Update API Service

Add new endpoints to [frontend\src\services\api.ts](frontend\src\services\api.ts):

```typescript
// ─── Chat History Endpoints ───────────────────────────────────────────────

export interface Conversation {
  id: number
  conversation_uuid: string
  title: string
  language: string
  category: string
  message_count: number
  created_at: string
  updated_at: string
}

export interface ConversationDetail {
  conversation: Conversation
  messages: Array<ChatMessage & {
    model_used?: string
    tokens_used?: number
    cached_response?: boolean
    created_at: string
  }>
  message_count: number
}

export interface ChatAnalytics {
  user_id: number
  period_days: number
  total_messages: number
  conversations: number
  cache_hit_rate: number
  total_tokens: number
  avg_response_time_ms: number
}

/**
 * Get list of user's conversations
 */
export async function getConversations(
  category?: string,
  limit = 20,
  offset = 0
): Promise<{ conversations: Conversation[]; total: number }> {
  const params = new URLSearchParams()
  if (category) params.append('category', category)
  params.append('limit', String(limit))
  params.append('offset', String(offset))
  
  const { data } = await api.get(`/api/chat/conversations?${params}`)
  return data
}

/**
 * Get full conversation with all messages
 */
export async function getConversation(
  conversationUuid: string,
  includeAudio = false
): Promise<ConversationDetail> {
  const { data } = await api.get(
    `/api/chat/conversations/${conversationUuid}?include_audio=${includeAudio}`
  )
  return data
}

/**
 * Get chat analytics
 */
export async function getChatAnalytics(
  days = 7
): Promise<ChatAnalytics> {
  const { data } = await api.get(`/api/chat/analytics?days=${days}`)
  return data
}
```

---

### Step 2: Update Chat Request to Include conversation_uuid

Modify the `sendChatMessage` function in [api.ts](frontend\src\services\api.ts):

```typescript
export async function sendChatMessage(request: {
  message: string
  language: string
  conversation_history?: ChatMessage[]
  conversation_uuid?: string  // ← ADD THIS
  category?: string
  tts_enabled?: boolean
  farmer_profile?: any
}): Promise<{
  response: string
  language: string
  audio_base64?: string
  audio_format?: string
  confidence?: number
}> {
  const { data } = await api.post('/api/chat', {
    message: request.message,
    language: request.language,
    conversation_history: request.conversation_history || [],
    conversation_uuid: request.conversation_uuid,  // ← INCLUDE THIS
    category: request.category || 'general',
    tts_enabled: request.tts_enabled || false,
    farmer_profile: request.farmer_profile,
  })
  return data
}
```

---

### Step 3: Add Conversation State to Chat Component

Update [Chat.tsx](frontend\src\pages\Chat.tsx):

```typescript
export default function Chat() {
  const { state } = useAppContext()
  const profile = state.userProfile

  // ═══ CONVERSATION STATE ═══════════════════════════════════════════════
  const [currentConversationUuid, setCurrentConversationUuid] = useState<string | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [showHistory, setShowHistory] = useState(false)

  // Load conversations on mount (if authenticated)
  useEffect(() => {
    if (state.authUser) {
      loadConversations()
    }
  }, [state.authUser])

  const loadConversations = async () => {
    try {
      const { conversations } = await getConversations(selectedTopic, 20, 0)
      setConversations(conversations)
    } catch (error) {
      console.error('Failed to load conversations:', error)
    }
  }

  // Load existing conversation
  const loadConversation = async (uuid: string) => {
    try {
      const { conversation, messages } = await getConversation(uuid, false)
      
      // Set messages (convert to ChatMessageExt format)
      const convertedMessages: ChatMessageExt[] = messages.map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
        timestamp: msg.created_at,
        audioBase64: msg.audioBase64,  // if includeAudio=true
        audioFormat: msg.audioFormat,
      }))
      
      setMessages(convertedMessages)
      setCurrentConversationUuid(uuid)
      setShowHistory(false)
      
      toast.success(`Loaded: ${conversation.title}`)
    } catch (error) {
      toast.error('Failed to load conversation')
    }
  }

  // ═══ UPDATE SEND MESSAGE ═══════════════════════════════════════════════
  const sendMessage = async (text?: string) => {
    const msg = (text ?? input).trim()
    if (!msg || loading) return

    window.speechSynthesis.cancel()

    const userMessage: ChatMessageExt = {
      role: 'user',
      content: msg,
      timestamp: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setLoading(true)

    try {
      const result = await sendChatMessage({
        message: msg,
        language: chatLang,
        conversation_history: messages.slice(-10),
        conversation_uuid: currentConversationUuid || undefined,  // ← PASS UUID
        category: selectedTopic,
        tts_enabled: autoSpeak,
        farmer_profile: (profile || crops.length > 0) ? {
          state: profile?.state,
          district: profile?.district,
          farming_type: profile?.farmingType,
          crops: crops.map(c => ({
            crop_name: c.crop_name,
            area_acres: c.area_acres,
            soil_type: c.soil_type,
            season: c.season,
            irrigation: c.irrigation,
            variety: c.variety,
            notes: c.notes,
            is_primary: c.is_primary,
          })),
        } : undefined,
      })

      if (!mountedRef.current) return

      const aiMessage: ChatMessageExt = {
        role: 'assistant',
        content: result.response,
        timestamp: new Date().toISOString(),
        audioBase64: result.audio_base64,
        audioFormat: result.audio_format,
      }
      setMessages((prev) => [...prev, aiMessage])
      
      // Refresh conversation list (new conversation was created)
      if (state.authUser && !currentConversationUuid) {
        loadConversations()
      }
      
    } catch (err: unknown) {
      // ... error handling ...
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }

  // ═══ UI: ADD HISTORY SIDEBAR ═══════════════════════════════════════════
  return (
    <div className="flex h-[calc(100vh-10rem)]">
      {/* Sidebar: Conversation History */}
      {showHistory && (
        <div className="w-64 bg-white border-r border-gray-200 overflow-y-auto">
          <div className="p-3 border-b flex justify-between items-center">
            <h3 className="font-bold text-sm">History</h3>
            <button 
              onClick={() => setShowHistory(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>
          
          <div className="p-2 space-y-2">
            {conversations.map(conv => (
              <button
                key={conv.conversation_uuid}
                onClick={() => loadConversation(conv.conversation_uuid)}
                className={`w-full text-left p-2 rounded-lg text-xs border transition-colors ${
                  currentConversationUuid === conv.conversation_uuid
                    ? 'bg-green-50 border-green-300'
                    : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                }`}
              >
                <div className="font-medium truncate">{conv.title}</div>
                <div className="text-[10px] text-gray-500 mt-1">
                  {conv.message_count} messages • {new Date(conv.updated_at).toLocaleDateString()}
                </div>
              </button>
            ))}
            
            {conversations.length === 0 && (
              <div className="text-center text-gray-400 text-xs py-8">
                No conversations yet
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header with History Toggle */}
        <div className="flex-shrink-0 space-y-3 mb-3 bg-white p-2 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {state.authUser && (
                <button
                  onClick={() => setShowHistory(!showHistory)}
                  className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                  title="Toggle conversation history"
                >
                  📚
                </button>
              )}
              
              {currentConversationUuid && (
                <button
                  onClick={() => {
                    setCurrentConversationUuid(null)
                    setMessages([{
                      role: 'assistant',
                      content: TOPIC_WELCOME[selectedTopic],
                      timestamp: new Date().toISOString(),
                    }])
                  }}
                  className="text-xs px-2 py-1 bg-gray-100 rounded-full hover:bg-gray-200"
                >
                  + New Chat
                </button>
              )}
              
              <h1 className="font-bold text-gray-800 flex items-center gap-2">
                {/* ... existing header ... */}
              </h1>
            </div>
            
            <LanguageSelector value={chatLang} onChange={(l: Language) => setChatLang(l.code)} />
          </div>
          
          {/* ... rest of header ... */}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          {/* ... existing message rendering ... */}
        </div>

        {/* Input */}
        {/* ... existing input area ... */}
      </div>
    </div>
  )
}
```

---

### Step 4: Add Analytics Dashboard (Optional)

Create a new component `ChatAnalytics.tsx`:

```typescript
import { useEffect, useState } from 'react'
import { getChatAnalytics, ChatAnalytics as Analytics } from '@/services/api'

export default function ChatAnalytics() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [days, setDays] = useState(7)

  useEffect(() => {
    loadAnalytics()
  }, [days])

  const loadAnalytics = async () => {
    try {
      const data = await getChatAnalytics(days)
      setAnalytics(data)
    } catch (error) {
      console.error('Failed to load analytics:', error)
    }
  }

  if (!analytics) return <div>Loading...</div>

  const costSavings = analytics.cache_hit_rate > 0 
    ? (analytics.total_messages * 0.015 * (analytics.cache_hit_rate / 100)).toFixed(2)
    : '0.00'

  return (
    <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-200">
      <h2 className="text-xl font-bold mb-4">Chat Analytics ({days} days)</h2>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-green-50 rounded-lg">
          <div className="text-2xl font-bold text-green-700">
            {analytics.total_messages}
          </div>
          <div className="text-xs text-gray-600">Total Messages</div>
        </div>

        <div className="p-4 bg-blue-50 rounded-lg">
          <div className="text-2xl font-bold text-blue-700">
            {analytics.conversations}
          </div>
          <div className="text-xs text-gray-600">Conversations</div>
        </div>

        <div className="p-4 bg-purple-50 rounded-lg">
          <div className="text-2xl font-bold text-purple-700">
            {analytics.cache_hit_rate.toFixed(1)}%
          </div>
          <div className="text-xs text-gray-600">Cache Hit Rate</div>
        </div>

        <div className="p-4 bg-orange-50 rounded-lg">
          <div className="text-2xl font-bold text-orange-700">
            ${costSavings}
          </div>
          <div className="text-xs text-gray-600">Cost Saved</div>
        </div>
      </div>

      <div className="mt-4 p-4 bg-gray-50 rounded-lg">
        <div className="text-sm text-gray-600 space-y-1">
          <div>Avg Response Time: <strong>{analytics.avg_response_time_ms}ms</strong></div>
          <div>Total Tokens: <strong>{analytics.total_tokens.toLocaleString()}</strong></div>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        {[7, 30, 90].map(d => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className={`px-3 py-1 text-xs rounded-full ${
              days === d 
                ? 'bg-green-600 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {d} days
          </button>
        ))}
      </div>
    </div>
  )
}
```

Add to [Profile.tsx](frontend\src\pages\Profile.tsx) or create a new Analytics page.

---

## 🎨 UI/UX Improvements

### Conversation Title Auto-Generation

The backend automatically generates conversation titles like:
- "General Chat - Mar 05, 2026"
- "Crop Doctor Chat - Mar 05, 2026"

You can update titles via a PATCH endpoint (to be implemented):

```typescript
// Future API endpoint
export async function updateConversationTitle(
  uuid: string,
  title: string
): Promise<void> {
  await api.patch(`/api/chat/conversations/${uuid}`, { title })
}
```

### Message Timestamps

Format timestamps nicely:

```typescript
function formatMessageTime(timestamp: string): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  
  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  
  return date.toLocaleDateString('en-IN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
```

---

## 🔒 Security Considerations

### JWT Authentication

All chat history endpoints require authentication:

```typescript
// In api.ts
const token = localStorage.getItem('authToken')
if (token) {
  api.defaults.headers.common['Authorization'] = `Bearer ${token}`
}
```

### Data Privacy

- **User isolation:** Conversations are filtered by `user_id`
- **Access control:** Cannot access other users' conversations
- **Soft delete:** Use `is_archived` flag instead of hard delete

---

## 📱 Mobile Optimization

### Infinite Scroll for Conversations

```typescript
const [page, setPage] = useState(0)
const LIMIT = 20

const loadMoreConversations = async () => {
  const { conversations } = await getConversations(
    selectedTopic,
    LIMIT,
    page * LIMIT
  )
  setConversations(prev => [...prev, ...conversations])
  setPage(prev => prev + 1)
}
```

### Swipe to Delete (Future)

```typescript
<Swipeable
  onSwipeLeft={() => archiveConversation(conv.conversation_uuid)}
  className="conversation-item"
>
  {/* conversation content */}
</Swipeable>
```

---

## 🧪 Testing

### Test Chat History Flow

1. **Start new conversation:**
   - Send message without `conversation_uuid`
   - Backend creates new conversation
   - Returns response

2. **Continue conversation:**
   - Load conversation list
   - Click on conversation
   - Send message with `conversation_uuid`
   - Messages appended to same conversation

3. **Verify caching:**
   - Send same message twice
   - Second request should be faster (<100ms)
   - Check `cached_response: true` in analytics

### Sample Test Data

```typescript
// Send multiple messages to populate history
const testMessages = [
  "What is the best rice variety for Punjab?",
  "How to control pests in wheat?",
  "Market prices for tomatoes in Delhi",
  "Weather forecast for Haryana",
  "Government schemes for farmers",
]

for (const msg of testMessages) {
  await sendChatMessage({
    message: msg,
    language: 'en',
    category: 'general',
    tts_enabled: false,
  })
  await new Promise(resolve => setTimeout(resolve, 1000))
}
```

---

## 🐛 Troubleshooting

### Issue: Conversations not loading

**Check:**
1. User is authenticated (`localStorage.getItem('authToken')`)
2. Backend is running
3. Database migration completed
4. Network tab shows 200 response

### Issue: Messages not saving

**Check:**
1. `conversation_uuid` is valid UUID format
2. Database tables exist (`chat_conversations`, `chat_messages`)
3. Connection pool initialized (check backend logs)

### Issue: Cache not working

**Check:**
1. ElastiCache connected (check `REDIS_URL` in .env)
2. Redis client initialized (backend logs: `cache_initialized`)
3. TTLs configured correctly in `TTL_CONFIG`

---

## 🎯 Next Steps

1. **Add conversation search:**
   - Full-text search on message content
   - Filter by date range, category, language

2. **Export conversations:**
   - Download as PDF
   - Share via email/WhatsApp

3. **Voice message history:**
   - Store original voice input
   - Playback original audio

4. **Multi-device sync:**
   - WebSocket for real-time updates
   - Push notifications for new messages

---

**Last Updated:** March 5, 2026  
**Related Docs:**
- [Backend API Documentation](../backend/docs/CHAT_HISTORY_AND_AWS_OPTIMIZATION.md)
- [Database Schema](../backend/scripts/create_chat_history_tables.py)
- [Cost Optimization Guide](../backend/docs/CHAT_HISTORY_AND_AWS_OPTIMIZATION.md#-cost-optimization-strategies)

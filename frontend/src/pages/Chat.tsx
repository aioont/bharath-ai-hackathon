import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Sparkles, Volume2, VolumeX, Trash2 } from 'lucide-react'
import { sendChatMessage, getCrops, getChatHistory, clearChatHistory } from '@/services/api'

// ── Chat History Cache (localStorage, 24-hour TTL) ──────────────────────────
const CHAT_CACHE_KEY = 'agri_chat_history_cache'
const CHAT_CACHE_TTL = 24 * 60 * 60 * 1000 // 24 hours in ms

interface ChatHistoryCache {
  timestamp: number
  messages: Array<{ role: 'user' | 'assistant'; content: string; timestamp?: string; isError?: boolean }>
}

function getCachedHistory(): ChatHistoryCache | null {
  try {
    const raw = localStorage.getItem(CHAT_CACHE_KEY)
    if (!raw) return null
    const cache: ChatHistoryCache = JSON.parse(raw)
    if (Date.now() - cache.timestamp > CHAT_CACHE_TTL) {
      localStorage.removeItem(CHAT_CACHE_KEY)
      return null
    }
    return cache
  } catch {
    return null
  }
}

function setCachedHistory(messages: ChatHistoryCache['messages']) {
  try {
    const cache: ChatHistoryCache = { timestamp: Date.now(), messages }
    localStorage.setItem(CHAT_CACHE_KEY, JSON.stringify(cache))
  } catch {
    // quota exceeded or other error — silently skip
  }
}

function clearCachedHistory() {
  localStorage.removeItem(CHAT_CACHE_KEY)
}
import type { ChatMessage, FarmerCrop } from '@/services/api'
import ChatMessageBubble, { TypingIndicator } from '@/components/ChatMessage'
import VoiceButton from '@/components/VoiceButton'
import TopicSelector from '@/components/TopicSelector'
import LanguageSelector from '@/components/LanguageSelector'
import PlanGenerator from '@/components/PlanGenerator'
import MarketAnalyzer from '@/components/MarketAnalyzer'
import { useAppContext } from '@/context/AppContext'
import type { Language } from '@/context/AppContext'
import toast from 'react-hot-toast'

// ---------------------------------------------------------------------------
// Welcome messages (mirror prompts.yaml welcome_message per category)
// ---------------------------------------------------------------------------
const TOPIC_WELCOME: Record<string, string> = {
  general:
    '🌾I am your General Agricultural Expert. Ask me anything about farming — crops, soil, seeds, inputs, or best practices!',
  crop_doctor:
    "🩺 Crop Doctor here! Describe your plant's symptoms — yellowing, spots, wilting, or pest damage — and I'll diagnose the problem and suggest the best treatment.",
  market:
    '📈 Market Expert here! Ask me about mandi prices, MSP, when to sell, storage tips, or how to get the best value for your produce.',
  weather:
    "🌦️ Weather Advisor here! Tell me your location and current crops, and I'll give you farming advice based on the weather — irrigation, sowing windows, and more.",
  schemes:
    "🏛️ Govt Scheme Advisor here! I can help you find and apply for PM Kisan, crop insurance, Kisan Credit Card, subsidies, and other government benefits. What do you need help with?",
}

// ---------------------------------------------------------------------------
// Extended ChatMessage type that can carry optional audio from TTS
// ---------------------------------------------------------------------------
interface ChatMessageExt extends ChatMessage {
  audioBase64?: string
  audioFormat?: string
}

// ---------------------------------------------------------------------------
// Error helper
// ---------------------------------------------------------------------------
function extractErrorMessage(err: unknown): string {
  if (err && typeof err === 'object') {
    const axiosDetail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
    if (axiosDetail) return axiosDetail
    const axiosMessage = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
    if (axiosMessage) return axiosMessage
    const errMessage = (err as { message?: string })?.message
    if (errMessage) return errMessage
  }
  if (typeof err === 'string' && err.trim()) return err
  return 'Could not reach the AI service. Please try again.'
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function Chat() {
  const { state, t } = useAppContext()
  const profile = state.userProfile

  // Load farmer's crops for LLM context
  const [crops, setCrops] = useState<FarmerCrop[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  
  // Load chat history on mount (cache-first, 24-hour TTL)
  const loadChatHistory = async () => {
    if (!state.authUser) return

    // 1. Try cache first
    const cached = getCachedHistory()
    if (cached && cached.messages.length > 0) {
      setMessages(cached.messages as ChatMessageExt[])
      return // skip network request
    }

    // 2. Cache miss — fetch from API
    try {
      setLoadingHistory(true)
      const { messages: historyMsgs } = await getChatHistory(false)

      if (historyMsgs && historyMsgs.length > 0) {
        const convertedMessages: ChatMessageExt[] = historyMsgs.map(msg => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
          timestamp: msg.created_at,
        }))

        setMessages(convertedMessages)
        setCachedHistory(convertedMessages) // populate cache
        toast.success(`Loaded ${historyMsgs.length} messages from history`, { duration: 2000 })
      }
    } catch (error) {
      console.error('Failed to load chat history:', error)
      // Keep default welcome message if history load fails
    } finally {
      setLoadingHistory(false)
    }
  }
  
  const handleClearChat = async () => {
    if (!confirm('Are you sure you want to clear all chat history? This cannot be undone.')) {
      return
    }

    try {
      await clearChatHistory()
      clearCachedHistory() // also clear the local cache

      // Reset to welcome message
      const welcome: ChatMessageExt = {
        role: 'assistant',
        content: profile?.name
          ? `Namaste ${profile.name}! 🌾 ${TOPIC_WELCOME[selectedTopic]}`
          : TOPIC_WELCOME[selectedTopic],
        timestamp: new Date().toISOString(),
      }
      setMessages([welcome])
      setCachedHistory([welcome])

      toast.success('Chat history cleared successfully')
    } catch (error) {
      toast.error('Failed to clear chat history')
    }
  }
  
  useEffect(() => {
    if (state.authUser) {
      getCrops().then(setCrops).catch(() => { })
      loadChatHistory()
    }
  }, [state.authUser])

  const [messages, setMessages] = useState<ChatMessageExt[]>([
    {
      role: 'assistant',
      content: profile?.name
        ? `Namaste ${profile.name}! 🌾 ${TOPIC_WELCOME['general']}`
        : TOPIC_WELCOME['general'],
      timestamp: new Date().toISOString(),
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [chatLang, setChatLang] = useState(state.selectedLanguage.code)

  // Sync chat language with global language changes
  useEffect(() => {
    setChatLang(state.selectedLanguage.code)
  }, [state.selectedLanguage.code])

  const [selectedTopic, setSelectedTopic] = useState<string>('general')
  const [showScroll, setShowScroll] = useState(false)
  const [isListening, setIsListening] = useState(false)
  // autoSpeak: when ON → request TTS from backend + show AudioPlayer
  //            when OFF → text only, no TTS
  const [autoSpeak, setAutoSpeak] = useState(false)
  // Feature cards accordion: only one open at a time
  const [openCard, setOpenCard] = useState<'plan' | 'market' | null>(null)
  const toggleCard = (card: 'plan' | 'market') =>
    setOpenCard(prev => prev === card ? null : card)

  const bottomRef = useRef<HTMLDivElement>(null)
  const chatRef = useRef<HTMLDivElement>(null)
  const mountedRef = useRef(true)
  // Blocks late-firing recognition callbacks from re-filling the input after send
  const isSubmittingRef = useRef(false)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      // Cancel any in-progress browser speech on unmount
      window.speechSynthesis.cancel()
    }
  }, [])

  // Show topic-specific welcome when user switches expert mode (skip on initial mount)
  const isFirstRender = useRef(true)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    const welcomeMsg: ChatMessageExt = {
      role: 'assistant',
      content: TOPIC_WELCOME[selectedTopic] ?? TOPIC_WELCOME['general'],
      timestamp: new Date().toISOString(),
    }
    
    setMessages((prev) => {
      const last = prev[prev.length - 1]
      // Prevent duplicate welcome messages
      if (last?.role === 'assistant' && (
          last.content === welcomeMsg.content || 
          last.content.includes(welcomeMsg.content)
      )) {
        return prev
      }
      return [...prev, welcomeMsg]
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTopic])

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // ── Voice speaker toggle: stop immediately when clicked ──────────────────
  const handleSpeakerToggle = useCallback(() => {
    window.speechSynthesis.cancel() // instant stop if speaking
    setAutoSpeak((prev) => !prev)
  }, [])

  // ── Voice input handlers ─────────────────────────────────────────────────
  // Called when mic activates: wipe any existing text so voice starts clean
  const handleVoiceStart = () => { isSubmittingRef.current = false; setInput('') }
  // Streams partial recognised text live into the textarea as the user speaks
  const handleInterimTranscript = (text: string) => { if (!isSubmittingRef.current) setInput(text) }
  // Final committed transcript
  const handleVoiceTranscript = (text: string) => { if (!isSubmittingRef.current) setInput(text) }

  // ── Language detected from voice input ──────────────────────────────────
  const handleDetectedLanguage = useCallback((langCode: string) => {
    // Only switch if it's a known 2-letter code and different from current
    const known = ['hi', 'bn', 'te', 'mr', 'ta', 'gu', 'kn', 'ml', 'pa', 'or', 'as', 'ur', 'en']
    if (known.includes(langCode) && langCode !== chatLang) {
      setChatLang(langCode)
      toast.success(`Language switched to ${langCode.toUpperCase()}`, { duration: 2000 })
    }
  }, [chatLang])

  const handleScroll = () => {
    const el = chatRef.current
    if (el) setShowScroll(el.scrollHeight - el.scrollTop - el.clientHeight > 100)
  }

  // ── Send message ──────────────────────────────────────────────────────────
  const sendMessage = async (text?: string) => {
    const msg = (text ?? input).trim()
    if (!msg || loading) return

    // Clear input and block any late recognition callbacks from re-filling it
    isSubmittingRef.current = true
    setInput('')
    // Stop mic if it's still listening (continuous mode)
    if (isListening) setIsListening(false)

    window.speechSynthesis.cancel()

    const userMessage: ChatMessageExt = {
      role: 'user',
      content: msg,
      timestamp: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, userMessage])
    setLoading(true)

    try {
      const result = await sendChatMessage({
        message: msg,
        language: chatLang,
        conversation_history: messages.slice(-10),
        category: selectedTopic,
        tts_enabled: autoSpeak,           // request TTS audio only when speaker is ON
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
        ...(result.model === 'demo' ? { isDemo: true } : {}),
        // Store audio from Sarvam TTS (present only when tts_enabled was true)
        audioBase64: result.audio_base64 ?? undefined,
        audioFormat: result.audio_format ?? 'wav',
      }
      setMessages((prev) => {
        const updated = [...prev, aiMessage]
        // Update cache with latest messages (strip audio blobs to keep storage lean)
        setCachedHistory(updated.map(({ audioBase64: _a, audioFormat: _f, ...rest }) => rest))
        return updated
      })
    } catch (err: unknown) {
      if (!mountedRef.current) return

      const detail = extractErrorMessage(err)
      const isServerError =
        err &&
        typeof err === 'object' &&
        (err as { response?: { status?: number } })?.response?.status !== undefined

      if (isServerError) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: `⚠️ ${detail}`,
            timestamp: new Date().toISOString(),
            isError: true,
          },
        ])
      } else {
        toast.error(detail, { duration: 5000 })
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false)
        isSubmittingRef.current = false
      }
    }
  }

  return (
    <div
      className="flex flex-col animate-fade-in"
      style={{
        zoom: 0.9,
        height: 'calc(100vh - 3rem)',
      }}
    >
      {/* Header & Topic Selector */}
      <div className="flex-shrink-0 space-y-1 mb-2 bg-white p-1 rounded-lg shadow-sm border border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="font-bold text-gray-800 flex items-center gap-1.5">
              <span className="text-base" title="AgriSaarthi - Your Autonomous AI Agricultural Expert">🌾</span>
              <span className="bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent font-extrabold text-sm">{t('chatTitle')}</span>
              <span className="text-[8px] px-1.5 py-0.5 bg-green-100 text-green-700 rounded-full font-normal" title="Autonomous Multilingual Voice & Text AI Expert for Bharat">AI Agent</span>
            </h1>
            {/* Speaker toggle */}
            <button
              onClick={handleSpeakerToggle}
              className={`p-1.5 rounded-full transition-all duration-200 flex items-center gap-1 ${
                autoSpeak
                  ? 'text-green-600 bg-green-50 ring-1 ring-green-300'
                  : 'text-gray-400 hover:bg-gray-100'
              }`}
              title={autoSpeak ? 'Voice ON — click to mute & disable TTS' : 'Voice OFF — click to enable TTS audio'}
            >
              {autoSpeak ? <Volume2 size={14} /> : <VolumeX size={14} />}
              <span className="text-[10px] font-medium">
                {autoSpeak ? t('audioMode') : t('textMode')}
              </span>
            </button>
          </div>
          
          <div className="flex items-center gap-1">
            <LanguageSelector value={chatLang} onChange={(l: Language) => setChatLang(l.code)} />
            
            {/* Clear Chat button - only show for authenticated users */}
            {state.authUser && messages.length > 1 && (
              <button
                onClick={handleClearChat}
                className="p-1.5 rounded-full transition-all duration-200 flex items-center gap-1 text-red-500 hover:bg-red-50"
                title="Clear chat history"
              >
                <Trash2 size={14} />
                <span className="text-[10px] font-medium hidden sm:inline">Clear</span>
              </button>
            )}
            
            
          </div>
        </div>
        <TopicSelector selectedTopic={selectedTopic} onSelect={setSelectedTopic} disabled={loading} />

        {/* Feature Cards toggle bar */}
        <div className="border-t border-gray-100 pt-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] text-gray-400">⚡ {t('aiModules')}</span>
            {(
              [
                ['plan', `🌱 ${t('cultivationAdvisor')}`, 'green'],
                ['market', `📊 ${t('marketIntelligence')}`, 'blue']
              ] as const
              ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => toggleCard(key)}
                className={`text-xs px-3 py-1 rounded-full border font-medium transition-all ${openCard === key ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                  }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
        
      {/* Feature Card Panels */}
      {openCard === 'plan' && (
          <div className="flex-shrink-0 mb-2 overflow-y-auto max-h-[70vh]">
            <PlanGenerator
              isOpen
              onToggle={() => toggleCard('plan')}
              language={chatLang}
              autoSpeak={autoSpeak}
              userProfile={{ name: profile?.name, state: profile?.state }}
            />
          </div>
        )}
        {openCard === 'market' && (
          <div className="flex-shrink-0 mb-2 overflow-y-auto max-h-[70vh]">
            <MarketAnalyzer
              isOpen
              onToggle={() => toggleCard('market')}
              language={chatLang}
              autoSpeak={autoSpeak}
              userProfile={{ state: profile?.state }}
            />
          </div>
        )}

        {/* Messages - Hidden when AI Decision Modules are active */}
        {!openCard && (
          <>
            <div
              ref={chatRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto scrollbar-hide rounded-lg bg-gray-50 border border-gray-200 p-2 relative"
          >
            {loadingHistory && (
              <div className="flex items-center justify-center py-8">
                <Sparkles className="animate-spin text-green-500 mr-2" size={20} />
                <span className="text-sm text-gray-500">{t('loadingHistory')}</span>
              </div>
            )}
            
            {!loadingHistory && messages.map((msg, i) => (
              <div key={i}>
                <ChatMessageBubble message={msg} isLatest={i === messages.length - 1} />
              </div>
            ))}

            {loading && (
              <div className="p-3 bg-white rounded-xl rounded-tl-none shadow-sm inline-block border border-gray-100">
                <TypingIndicator />
                <span className="text-[10px] text-green-600 block mt-1 animate-pulse">
                  {autoSpeak ? t('thinkingVoice') : t('researching')}
                </span>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Scroll-to-bottom button */}
          {showScroll && (
            <button
              onClick={() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' })}
              className="absolute bottom-20 right-4 bg-white border border-gray-200 rounded-full p-1.5 shadow-md hover:bg-gray-50 transition-colors text-xs"
            >
              ↓
            </button>
          )}
        </>
        )}

        {/* Input */}
        <div className="flex-shrink-0 flex gap-1.5 mt-2 items-end">
        <VoiceButton
          onTranscript={handleVoiceTranscript}
          onInterimTranscript={handleInterimTranscript}
          onStart={handleVoiceStart}
          onDetectedLanguage={handleDetectedLanguage}
          isListening={isListening}
          setIsListening={setIsListening}
          language={chatLang === 'hi' ? 'hi-IN' : chatLang === 'en' ? 'en-IN' : `${chatLang}-IN`}
          disabled={loading}
        />
        <div className="flex-1 bg-white rounded-xl border-2 border-gray-200 focus-within:border-green-500 px-2.5 py-1.5 transition-all">
          <textarea
            className="w-full resize-none focus:outline-none text-xs max-h-20 bg-transparent"
            placeholder={isListening ? 'Listening…' : `${t('askAnyLang')} ${autoSpeak ? '🔊' : '📝'}`}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                sendMessage()
              }
            }}
          />
        </div>
        <button
          onClick={() => sendMessage()}
          disabled={loading || !input.trim()}
          className="bg-green-600 text-white p-2 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors shadow-sm"
        >
          {loading ? <Sparkles size={16} className="animate-spin" /> : <Send size={16} />}
        </button>
      </div>
    </div>
  )
}
import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Sparkles, Volume2, VolumeX } from 'lucide-react'
import { sendChatMessage, getCrops } from '@/services/api'
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
  const { state } = useAppContext()
  const profile = state.userProfile

  // Load farmer's crops for LLM context
  const [crops, setCrops] = useState<FarmerCrop[]>([])
  useEffect(() => {
    if (state.authUser) {
      getCrops().then(setCrops).catch(() => { })
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
  const [openCard, setOpenCard] = useState<'plan' | 'market' | 'schemes' | null>(null)
  const toggleCard = (card: 'plan' | 'market' | 'schemes') =>
    setOpenCard(prev => prev === card ? null : card)

  const bottomRef = useRef<HTMLDivElement>(null)
  const chatRef = useRef<HTMLDivElement>(null)
  const mountedRef = useRef(true)

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

  // ── Voice input transcript handler ───────────────────────────────────────
  const handleVoiceTranscript = (text: string) => setInput(text)

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
      setMessages((prev) => [...prev, aiMessage])
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
      if (mountedRef.current) setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-10rem)] md:h-[calc(100vh-8rem)] animate-fade-in">
      {/* Header & Topic Selector */}
      <div className="flex-shrink-0 space-y-3 mb-3 bg-white p-2 rounded-xl shadow-sm border border-gray-100">
        <div className="flex items-center justify-between">
          <h1 className="font-bold text-gray-800 flex items-center gap-2">
            <span className="text-2xl" title="AgriSaarthi - Your Autonomous AI Agricultural Expert">🌾</span>
            <span className="bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent font-extrabold">AgriSaarthi</span>
            <span className="text-[9px] px-1.5 py-0.5 bg-green-100 text-green-700 rounded-full font-normal" title="Autonomous Multilingual Voice & Text AI Expert for Bharat">AI Agent</span>
            {/* Speaker toggle — click to instantly stop & toggle voice mode */}
            <button
              onClick={handleSpeakerToggle}
              className={`p-1 rounded-full transition-all duration-200 ${autoSpeak
                ? 'text-green-600 bg-green-50 ring-2 ring-green-300'
                : 'text-gray-400 hover:bg-gray-100'
                }`}
              title={autoSpeak ? 'Voice ON — click to mute & disable TTS' : 'Voice OFF — click to enable TTS audio'}
            >
              {autoSpeak ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </button>
            <span className={`text-[10px] font-normal px-1.5 py-0.5 rounded-full ${autoSpeak ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
              }`}>
              {autoSpeak ? 'Audio ON' : 'Text only'}
            </span>
          </h1>
          <LanguageSelector value={chatLang} onChange={(l: Language) => setChatLang(l.code)} />
        </div>
        <TopicSelector selectedTopic={selectedTopic} onSelect={setSelectedTopic} disabled={loading} />

        {/* Feature Cards toggle bar */}
        <div className="border-t border-gray-100 pt-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] text-gray-400">⚡ AI Decision Modules:</span>
            {(
              [
                ['plan', '🌱 Cultivation Advisor', 'green'],
                ['market', '📊 Market Intelligence', 'blue']
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
        <div className="flex-shrink-0 mb-3 overflow-y-auto max-h-[50vh]">
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
        <div className="flex-shrink-0 mb-3 overflow-y-auto max-h-[50vh]">
          <MarketAnalyzer
            isOpen
            onToggle={() => toggleCard('market')}
            language={chatLang}
            autoSpeak={autoSpeak}
            userProfile={{ state: profile?.state }}
          />
        </div>
      )}

      {/* Messages */}
      <div
        ref={chatRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto scrollbar-hide rounded-2xl bg-gray-50 border border-gray-200 p-4 relative"
      >
        {messages.map((msg, i) => (
          <div key={i}>
            <ChatMessageBubble message={msg} isLatest={i === messages.length - 1} />
          </div>
        ))}

        {loading && (
          <div className="p-4 bg-white rounded-2xl rounded-tl-none shadow-sm inline-block border border-gray-100">
            <TypingIndicator />
            <span className="text-xs text-green-600 block mt-1 animate-pulse">
              {autoSpeak ? 'Thinking & preparing voice…' : 'Researching…'}
            </span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Scroll-to-bottom button */}
      {showScroll && (
        <button
          onClick={() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' })}
          className="absolute bottom-24 right-6 bg-white border border-gray-200 rounded-full p-2 shadow-md hover:bg-gray-50 transition-colors"
        >
          ↓
        </button>
      )}

      {/* Input */}
      <div className="flex-shrink-0 flex gap-2 mt-3 items-end">
        <VoiceButton
          onTranscript={handleVoiceTranscript}
          onDetectedLanguage={handleDetectedLanguage}
          isListening={isListening}
          setIsListening={setIsListening}
          language={chatLang === 'hi' ? 'hi-IN' : chatLang === 'en' ? 'en-IN' : `${chatLang}-IN`}
          disabled={loading}
        />
        <div className="flex-1 bg-white rounded-2xl border-2 border-gray-200 focus-within:border-green-500 px-3 py-2 transition-all">
          <textarea
            className="w-full resize-none focus:outline-none text-sm max-h-24 bg-transparent"
            placeholder={isListening ? 'Listening…' : `Ask in any language… ${autoSpeak ? '🔊' : '📝'}`}
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
          className="bg-green-600 text-white p-3 rounded-xl hover:bg-green-700 disabled:opacity-50 transition-colors shadow-sm"
        >
          {loading ? <Sparkles size={20} className="animate-spin" /> : <Send size={20} />}
        </button>
      </div>
    </div>
  )
}
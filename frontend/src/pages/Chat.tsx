import { useState, useRef, useEffect } from 'react'
import { Send, RotateCcw, Sparkles, ChevronDown } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { sendChatMessage } from '@/services/api'
import type { ChatMessage } from '@/services/api'
import ChatMessageBubble, { TypingIndicator } from '@/components/ChatMessage'
import VoiceButton from '@/components/VoiceButton'
import LanguageSelector from '@/components/LanguageSelector'
import { useAppContext } from '@/context/AppContext'
import { EXPERT_CATEGORIES, SOIL_TYPES, MARKET_STATES } from '@/utils/constants'
import type { Language } from '@/context/AppContext'
import toast from 'react-hot-toast'

const SUGGESTED_QUESTIONS = [
  'What fertilizer should I use for tomatoes?',
  'How to identify and treat rice blast disease?',
  'Best practices for drip irrigation in mango orchards?',
  'What government schemes are available for small farmers?',
  'When is the best time to harvest wheat in Punjab?',
  'How to prepare compost at home for organic farming?',
]

export default function Chat() {
  const { state } = useAppContext()
  const profile = state.userProfile
  const [searchParams] = useSearchParams()
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: `${profile?.name ? `Namaste ${profile.name}! 🌾` : 'Namaste! 🌾'} I'm your AI agricultural expert powered by Sarvam-M. I can help you with:\n\n• Crop management & best practices\n• Pest & disease identification\n• Soil health & fertilizers\n• Market insights & pricing\n• Government schemes & subsidies\n• Weather-based farming advice\n\nAsk me anything in your language!`,
      timestamp: new Date().toISOString(),
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [chatLang, setChatLang] = useState(state.selectedLanguage.code)
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('category') || '')
  const [showScroll, setShowScroll] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [farmerProfile, setFarmerProfile] = useState({
    state: profile?.state || '',
    crop: profile?.primaryCrop || '',
    soil_type: profile?.soilType || '',
    season: 'kharif',
  })
  const bottomRef = useRef<HTMLDivElement>(null)
  const chatRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const handleScroll = () => {
    const el = chatRef.current
    if (el) {
      setShowScroll(el.scrollHeight - el.scrollTop - el.clientHeight > 100)
    }
  }

  const sendMessage = async (text?: string) => {
    const msg = (text || input).trim()
    if (!msg) return
    if (loading) return

    const userMessage: ChatMessage = {
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
        category: selectedCategory || undefined,
        farmer_profile: farmerProfile.state ? farmerProfile : undefined,
      })

      const aiMessage: ChatMessage = {
        role: 'assistant',
        content: result.response,
        timestamp: new Date().toISOString(),
        ...(result.model === 'demo' ? { isDemo: true } : {}),
      }
      setMessages((prev) => [...prev, aiMessage])
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Could not reach the AI service. Please check your connection and try again.'
      toast.error(detail, { duration: 5000 })
      const errMessage: ChatMessage = {
        role: 'assistant',
        content: `⚠️ ${detail}`,
        timestamp: new Date().toISOString(),
        isError: true,
      }
      setMessages((prev) => [...prev, errMessage])
    } finally {
      setLoading(false)
    }
  }

  const clearChat = () => {
    setMessages([{
      role: 'assistant',
      content: 'Chat cleared! How can I help you today? 🌾',
      timestamp: new Date().toISOString(),
    }])
  }

  return (
    <div className="flex flex-col h-[calc(100vh-10rem)] md:h-[calc(100vh-8rem)] animate-fade-in">
      {/* Header */}
      <div className="flex-shrink-0 space-y-3 mb-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="section-title text-xl flex items-center gap-2 mb-0">
              <span>🤖</span> AI Expert Chat
            </h1>
            <p className="text-xs text-gray-500">Powered by Sarvam-M</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowProfile(!showProfile)}
              className="btn-secondary text-xs py-2 px-3"
            >
              👨‍🌾 Profile
            </button>
            <button onClick={clearChat} className="p-2 rounded-xl text-gray-500 hover:bg-gray-100 transition-colors" title="Clear chat">
              <RotateCcw size={16} />
            </button>
          </div>
        </div>

        {/* Farmer Profile Panel */}
        {showProfile && (
          <div className="card border border-primary-200 bg-primary-50 space-y-3 animate-slide-up">
            <h3 className="text-sm font-semibold text-primary-800">Your Farmer Profile (for better advice)</h3>
            <div className="grid grid-cols-2 gap-3">
              <select
                className="select-field text-sm py-2"
                value={farmerProfile.state}
                onChange={(e) => setFarmerProfile((p) => ({ ...p, state: e.target.value }))}
              >
                <option value="">Select State</option>
                {MARKET_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <select
                className="select-field text-sm py-2"
                value={farmerProfile.soil_type}
                onChange={(e) => setFarmerProfile((p) => ({ ...p, soil_type: e.target.value }))}
              >
                <option value="">Soil Type</option>
                {SOIL_TYPES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="w-full">
              <LanguageSelector
                label="Chat Language"
                value={chatLang}
                onChange={(l: Language) => setChatLang(l.code)}
              />
            </div>
          </div>
        )}

        {/* Category Filter */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
          <button
            onClick={() => setSelectedCategory('')}
            className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium border-2 transition-all ${
              !selectedCategory ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-500 border-gray-200'
            }`}
          >
            All Topics
          </button>
          {EXPERT_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id === selectedCategory ? '' : cat.id)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium border-2 transition-all ${
                selectedCategory === cat.id ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-500 border-gray-200 hover:border-primary-300'
              }`}
            >
              {cat.icon} {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chat Messages */}
      <div
        ref={chatRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto scrollbar-hide rounded-2xl bg-gray-50 border border-gray-200 p-4 relative"
      >
        {messages.map((msg, i) => (
          <ChatMessageBubble key={i} message={msg} isLatest={i === messages.length - 1} />
        ))}
        {loading && <TypingIndicator />}
        <div ref={bottomRef} />

        {/* Scroll to bottom */}
        {showScroll && (
          <button
            onClick={() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' })}
            className="absolute bottom-4 right-4 p-2.5 bg-white rounded-full shadow-lg border border-gray-200 text-gray-600 hover:text-primary-600 transition-colors"
          >
            <ChevronDown size={18} />
          </button>
        )}
      </div>

      {/* Suggested Questions */}
      {messages.length <= 1 && (
        <div className="flex-shrink-0 overflow-x-auto scrollbar-hide mt-3">
          <div className="flex gap-2 pb-1 min-w-0">
            {SUGGESTED_QUESTIONS.map((q) => (
              <button
                key={q}
                onClick={() => sendMessage(q)}
                className="flex-shrink-0 text-xs bg-white border border-gray-200 hover:border-primary-300 
                  hover:bg-primary-50 text-gray-600 hover:text-primary-700 rounded-xl px-3 py-2 
                  transition-all max-w-[200px] text-left line-clamp-2"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="flex-shrink-0 flex gap-2 mt-3">
        <div className="flex-1 flex items-end gap-2 bg-white rounded-2xl border-2 border-gray-200 
          focus-within:border-primary-400 px-4 py-3 transition-colors">
          <textarea
            className="flex-1 resize-none focus:outline-none text-sm text-gray-800 placeholder-gray-400 max-h-24 min-h-[20px]"
            placeholder={`Ask your farming question in any language... 🌾`}
            rows={1}
            value={input}
            onChange={(e) => {
              setInput(e.target.value)
              e.target.style.height = 'auto'
              e.target.style.height = Math.min(e.target.scrollHeight, 96) + 'px'
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                sendMessage()
              }
            }}
          />
          <VoiceButton
            onTranscript={(t) => setInput(t)}
            language={chatLang}
            className="p-2 flex-shrink-0"
          />
        </div>
        <button
          onClick={() => sendMessage()}
          disabled={loading || !input.trim()}
          className="flex-shrink-0 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed 
            text-white p-3.5 rounded-2xl transition-all active:scale-95 shadow-md"
        >
          {loading ? <Sparkles size={20} className="animate-spin" /> : <Send size={20} />}
        </button>
      </div>
    </div>
  )
}

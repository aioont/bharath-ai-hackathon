import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Languages, MessageSquareText, Leaf, TrendingUp, CloudSun, Users, ArrowRight, Sprout, Shield, Zap, ExternalLink, Newspaper, Mic } from 'lucide-react'
import { useAppContext, GREETINGS } from '@/context/AppContext'
import { FARMING_SEASONS, CROP_CATEGORIES } from '@/utils/constants'
import { getNewsFeed, type NewsItem } from '@/services/api'

const features = [
  {
    to: '/chat',
    icon: MessageSquareText,
    emoji: '🌾',
    title: 'AgriSaarthi',
    description: 'Autonomous AI agent with voice & text support in 15+ languages — your personal farming assistant',
    color: 'bg-gradient-to-br from-green-50 to-emerald-50 text-green-700 border-green-300',
    badge: '🎯 Prime Feature',
  },
  {
    to: '/crop-health',
    icon: Leaf,
    emoji: '🌿',
    title: 'Crop Health Diagnostics',
    description: 'AI-powered disease detection from crop photos with instant treatment recommendations',
    color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    badge: 'AI Vision',
  },
  {
    to: '/weather',
    icon: CloudSun,
    emoji: '⛅',
    title: 'Smart Weather Alerts',
    description: 'Real-time weather updates with farming-specific advisories and seasonal forecasts',
    color: 'bg-sky-50 text-sky-700 border-sky-200',
    badge: '7-Day Forecast',
  },
  {
    to: '/market',
    icon: TrendingUp,
    emoji: '📈',
    title: 'Market Intelligence',
    description: 'Live commodity prices from 6000+ mandis with trend analysis and price predictions',
    color: 'bg-orange-50 text-orange-700 border-orange-200',
    badge: 'Real-time',
  },
  {
    to: '/forum',
    icon: Users,
    emoji: '👨‍🌾',
    title: 'Farmer Community',
    description: 'Connect with thousands of farmers, share experiences and learn best practices',
    color: 'bg-purple-50 text-purple-700 border-purple-200',
    badge: 'Peer Network',
  },
  {
    to: '/translate',
    icon: Languages,
    emoji: '🌐',
    title: 'Language Translation',
    description: 'Voice and text translation for agricultural content across 15+ Indian languages',
    color: 'bg-blue-50 text-blue-700 border-blue-200',
    badge: 'Multilingual',
  },
]

const stats = [
  { value: '270M+', label: 'Farmers in India', icon: '👨‍🌾' },
  { value: '15+', label: 'Indian Languages', icon: '🗣️' },
  { value: '100+', label: 'Crop Types', icon: '🌾' },
  { value: '₹370B', label: 'Market Potential', icon: '📊' },
]

export default function Home() {
  const { state, t } = useAppContext()
  const navigate = useNavigate()
  // Determine current season based on month (March = Zaid or Rabi)
  const month = new Date().getMonth() + 1
  const currentSeason = month >= 3 && month <= 6 ? FARMING_SEASONS[2] : month >= 10 || month <= 4 ? FARMING_SEASONS[1] : FARMING_SEASONS[0]
  const profile = state.userProfile
  const greeting = GREETINGS[state.selectedLanguage.code] || 'Namaste'

  const [news, setNews] = useState<NewsItem[]>([])
  const [newsLoading, setNewsLoading] = useState(true)

  useEffect(() => {
    getNewsFeed(6)
      .then((data) => setNews(data))
      .catch(() => setNews([]))
      .finally(() => setNewsLoading(false))
  }, [])

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-3xl bg-agri-gradient p-6 sm:p-8 text-white shadow-xl">
        <div className="absolute inset-0 hero-pattern opacity-30" />
        
        {/* Floating season badge - moved to avoid overlap */}
        <div className="absolute top-4 right-4 bg-white/20 backdrop-blur-sm rounded-xl px-3 py-2 text-xs text-white text-right hidden lg:block z-10">
          <div className="font-semibold">{currentSeason.name}</div>
          <div className="text-primary-200">{currentSeason.period}</div>
        </div>

        <div className="relative">
          <div className="mb-4">
            {profile?.isProfileComplete ? (
              <div className="flex items-center gap-2 mb-3">
                <span className="badge bg-white/20 text-white border-0 text-xs">
                  👨‍🌾 {profile.name}
                </span>
                {profile.state && (
                  <span className="badge bg-white/20 text-white border-0 text-xs">
                    📍 {profile.state}
                  </span>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 mb-3">
                <button
                  onClick={() => navigate('/profile')}
                  className="badge bg-white/20 text-white border-0 text-xs hover:bg-white/30 transition-colors"
                >
                  📝 Complete your profile
                </button>
              </div>
            )}
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold leading-tight mb-3">
                  {greeting}, {state.selectedLanguage.flag}<br />
                  <span className="text-primary-100">
                    {profile?.name ? profile.name : 'Friend'}
                  </span>
                </h1>
                <p className="text-primary-100 text-sm sm:text-base max-w-2xl leading-relaxed">
                  {profile?.state && profile?.isProfileComplete
                    ? `Your intelligent farming companion for ${profile.state}. Access AI-powered crop guidance, real-time market intelligence, weather alerts, and community wisdom — all in your preferred language.`
                    : 'Welcome to India\'s most comprehensive agricultural platform. Get personalized AI assistance, market insights, weather forecasts, crop diagnostics, and connect with farmers nationwide — all powered by cutting-edge technology.'}
                </p>
              </div>
              <div className="text-5xl sm:text-6xl flex-shrink-0 hidden sm:block animate-bounce-slow">🌾</div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 mt-6">
            <button
              onClick={() => navigate('/chat')}
              className="flex items-center gap-2 bg-white text-primary-700 font-semibold text-sm
                px-5 py-3 rounded-xl hover:bg-primary-50 active:scale-95 transition-all shadow-lg hover:shadow-xl"
            >
              <Mic size={18} />
              {t('askExpert')}
              <ArrowRight size={14} />
            </button>
            <button
              onClick={() => navigate('/market')}
              className="flex items-center gap-2 bg-white/20 text-white font-semibold text-sm
                px-5 py-3 rounded-xl hover:bg-white/30 active:scale-95 transition-all border border-white/30 backdrop-blur-sm"
            >
              <TrendingUp size={18} />
              Market Prices
            </button>
            <button
              onClick={() => navigate('/weather')}
              className="flex items-center gap-2 bg-white/20 text-white font-semibold text-sm
                px-5 py-3 rounded-xl hover:bg-white/30 active:scale-95 transition-all border border-white/30 backdrop-blur-sm"
            >
              <CloudSun size={18} />
              Weather
            </button>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* Agent Hero Card — Autonomous Farm Intelligence Agent        */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => navigate('/chat')}
        onKeyDown={(e) => e.key === 'Enter' && navigate('/chat')}
        className="relative overflow-hidden rounded-3xl cursor-pointer select-none group animate-agent-card"
        style={{
          background: 'linear-gradient(135deg, #052e16 0%, #064e3b 25%, #065f46 50%, #047857 70%, #052e16 100%)',
        }}
      >
        {/* Animated gradient overlay */}
        <div
          className="absolute inset-0 animate-gradient-shift opacity-60"
          style={{
            background: 'linear-gradient(135deg, #052e16, #065f46, #0d9488, #047857, #064e3b, #052e16)',
          }}
        />

        {/* Subtle grid pattern */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: 'linear-gradient(rgba(134,239,172,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(134,239,172,0.3) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />

        {/* Floating particles */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="animate-particle-1 absolute top-6  left-[12%] w-1.5 h-1.5 rounded-full bg-green-300/60" />
          <div className="animate-particle-2 absolute top-10 right-[18%] w-2   h-2   rounded-full bg-emerald-200/50" />
          <div className="animate-particle-3 absolute bottom-8 left-[30%] w-1 h-1 rounded-full bg-green-400/70" />
          <div className="animate-particle-4 absolute bottom-12 right-[25%] w-1.5 h-1.5 rounded-full bg-teal-300/60" />
        </div>

        {/* Card content */}
        <div className="relative z-10 flex flex-col sm:flex-row items-center gap-6 sm:gap-10 px-6 sm:px-10 py-8 sm:py-10">

          {/* ── Mic icon with breathing rings ── */}
          <div className="relative flex-shrink-0 flex items-center justify-center w-40 h-40 sm:w-48 sm:h-48">
            {/* Outermost ring */}
            <div className="animate-agent-ring absolute inset-0 rounded-full border-2 border-green-300/30 bg-green-400/5" />
            {/* Middle ring */}
            <div className="animate-agent-ring2 absolute inset-4 rounded-full border-2 border-green-300/40 bg-green-400/8" />
            {/* Inner ring */}
            <div className="animate-agent-ring3 absolute inset-8 rounded-full border-2 border-green-200/60 bg-green-300/10" />

            {/* Mic button */}
            <div
              className="animate-agent-float relative z-10 w-24 h-24 sm:w-28 sm:h-28 rounded-full flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform duration-500"
              style={{
                background: 'linear-gradient(135deg, #16a34a 0%, #059669 50%, #0d9488 100%)',
                boxShadow: '0 0 40px rgba(74,222,128,0.35), 0 8px 32px rgba(0,0,0,0.4)',
              }}
            >
              {/* Mic SVG */}
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-12 h-12 sm:w-14 sm:h-14 drop-shadow-lg"
              >
                <rect x="9" y="2" width="6" height="11" rx="3" fill="rgba(255,255,255,0.15)" />
                <path d="M19 10v2a7 7 0 01-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="22" />
                <line x1="8" y1="22" x2="16" y2="22" />
              </svg>
            </div>
          </div>

          {/* ── Text content ── */}
          <div className="flex-1 text-center sm:text-left">
            {/* Label pill */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-3 text-xs font-semibold tracking-widest uppercase"
              style={{ background: 'rgba(134,239,172,0.12)', border: '1px solid rgba(134,239,172,0.3)', color: '#86efac' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              Powered by Sarvam AI
            </div>

            {/* Main heading — shimmer text */}
            <h2
              className="animate-text-shimmer text-2xl sm:text-3xl lg:text-4xl font-black leading-tight mb-3"
              style={{ fontFamily: 'system-ui, sans-serif', letterSpacing: '-0.02em' }}
            >
              Autonomous Multilingual<br />
              Farm Decision &amp; Risk<br />
              Intelligence Agent
            </h2>

            {/* Sub-caption */}
            <p className="text-green-200/70 text-sm sm:text-base mb-5 max-w-md mx-auto sm:mx-0 leading-relaxed">
              Revolutionary AI agent that understands 15+ Indian languages through voice & text. Autonomous decision-making system combining real-time IoT sensor data, market intelligence, weather patterns & government schemes — delivering personalized farm guidance without human intervention.
            </p>

            {/* CTA row */}
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3">
              <div
                className="flex items-center gap-2.5 px-5 py-2.5 rounded-xl font-bold text-sm transition-all duration-300 group-hover:scale-105 group-hover:shadow-lg"
                style={{
                  background: 'linear-gradient(135deg, #22c55e, #10b981)',
                  color: '#fff',
                  boxShadow: '0 4px 20px rgba(34,197,94,0.4)',
                }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                  <rect x="9" y="2" width="6" height="11" rx="3" />
                  <path d="M19 10v2a7 7 0 01-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="22" />
                  <line x1="8" y1="22" x2="16" y2="22" />
                </svg>
                Talk to AI Agent
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </div>
              <div className="text-green-300/60 text-xs font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                15+ languages supported
              </div>
            </div>
          </div>
        </div>

        {/* Bottom glow line */}
        <div
          className="absolute bottom-0 left-0 right-0 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(134,239,172,0.5), transparent)' }}
        />
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">

        {stats.map((stat) => (
          <div key={stat.label} className="card text-center py-4">
            <div className="text-2xl mb-1">{stat.icon}</div>
            <div className="text-xl font-bold text-gray-900">{stat.value}</div>
            <div className="text-xs text-gray-500">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Features Grid */}
      <section>
        <h2 className="section-title">What can I help you with?</h2>
        <p className="section-subtitle">Tap any feature to get started</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((feature) => (
            <button
              key={feature.to}
              onClick={() => navigate(feature.to)}
              className={`card text-left hover:scale-[1.02] active:scale-[0.98] transition-transform
                border-2 ${feature.color.split(' ').find((c) => c.startsWith('border'))}`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 ${feature.color.split(' ').filter((c) => c.startsWith('bg')).join(' ')
                  }`}>
                  {feature.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2 mb-1">
                    <h3 className="font-semibold text-gray-900 text-sm leading-snug">{feature.title}</h3>
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed">{feature.description}</p>
                  <span className={`inline-block mt-2 text-[10px] font-medium px-2 py-0.5 rounded-full ${feature.color.split(' ').filter((c) => !c.startsWith('border')).join(' ')
                    } bg-opacity-30`}>
                    {feature.badge}
                  </span>
                </div>
                <ArrowRight size={16} className="text-gray-400 flex-shrink-0 mt-0.5" />
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Crop Categories */}
      <section>
        <h2 className="section-title">Crop Categories</h2>
        <p className="section-subtitle">Find specific advice for your crop type</p>
        <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2">
          {CROP_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => navigate(`/chat?category=${cat.id}`)}
              className="flex-shrink-0 card border border-gray-100 hover:border-primary-300 hover:bg-primary-50 
                transition-all text-center py-4 px-5 min-w-[110px] active:scale-95"
            >
              <div className="text-3xl mb-2">{cat.icon}</div>
              <div className="font-medium text-gray-800 text-xs">{cat.name}</div>
              <div className="text-gray-400 text-xs mt-1">{cat.crops.length} crops</div>
            </button>
          ))}
        </div>
      </section>

      {/* Why AI section */}
      <section className="card bg-gradient-to-br from-earth-50 to-primary-50 border border-earth-100">
        <h2 className="section-title text-xl">Why AI for Agriculture?</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
          {[
            { icon: <Zap className="text-yellow-500" size={20} />, title: 'Real-time Adaptation', desc: 'AI continuously learns and adapts to market prices, weather conditions, and pest outbreaks' },
            { icon: <Shield className="text-blue-500" size={20} />, title: 'Contextual Intelligence', desc: 'Recommendations consider soil type, local weather, and market trends for personalized advice' },
            { icon: <Sprout className="text-primary-500" size={20} />, title: 'Unmatched Scale', desc: 'Foundation models efficiently handle 15+ languages and 100+ crop types simultaneously' },
          ].map((item) => (
            <div key={item.title} className="flex gap-3">
              <div className="flex-shrink-0 w-9 h-9 bg-white rounded-xl flex items-center justify-center shadow-sm">
                {item.icon}
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 text-sm mb-0.5">{item.title}</h4>
                <p className="text-xs text-gray-500">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Agri News Feed (replaces AI & Cloud Infrastructure) */}
      <section className="card border border-green-200 bg-green-50/40">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-green-100 rounded-xl flex items-center justify-center">
              <Newspaper size={18} className="text-green-700" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-sm">Latest Agri News</h3>
              <p className="text-xs text-gray-500">Powered by RuralVoice</p>
            </div>
          </div>
          <a
            href="https://eng.ruralvoice.in"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-green-700 hover:text-green-900 font-medium"
          >
            View all <ExternalLink size={11} />
          </a>
        </div>

        {newsLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse flex gap-3">
                <div className="w-16 h-14 bg-gray-200 rounded-lg flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-gray-200 rounded w-3/4" />
                  <div className="h-2 bg-gray-200 rounded w-full" />
                  <div className="h-2 bg-gray-200 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : news.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">Could not load news. Check your connection.</p>
        ) : (
          <div className="space-y-3">
            {news.map((item, idx) => (
              <a
                key={item.guid || idx}
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex gap-3 group hover:bg-white rounded-xl p-2 -mx-2 transition-colors"
              >
                {item.image_url ? (
                  <img
                    src={item.image_url}
                    alt=""
                    className="w-16 h-14 object-cover rounded-lg flex-shrink-0 bg-gray-100"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                  />
                ) : (
                  <div className="w-16 h-14 bg-green-100 rounded-lg flex-shrink-0 flex items-center justify-center text-2xl">
                    🌾
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-semibold text-gray-900 line-clamp-2 group-hover:text-green-700 transition-colors leading-snug">
                    {item.title}
                  </h4>
                  <p className="text-[10px] text-gray-500 line-clamp-2 mt-0.5">{item.description}</p>
                  <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-400">
                    {item.author && <span>✍ {item.author}</span>}
                    {item.pub_date && (
                      <span>
                        {new Date(item.pub_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </span>
                    )}
                  </div>
                </div>
                <ArrowRight size={14} className="text-gray-300 group-hover:text-green-600 flex-shrink-0 mt-1 transition-colors" />
              </a>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

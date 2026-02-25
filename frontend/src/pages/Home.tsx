import { useNavigate } from 'react-router-dom'
import { Languages, MessageSquareText, Leaf, TrendingUp, CloudSun, Users, ArrowRight, Sprout, Shield, Zap } from 'lucide-react'
import { useAppContext, GREETINGS } from '@/context/AppContext'
import { FARMING_SEASONS, CROP_CATEGORIES } from '@/utils/constants'

const features = [
  {
    to: '/translate',
    icon: Languages,
    emoji: '🌐',
    title: 'Voice & Text Translation',
    description: 'Translate agricultural content into 15+ Indian languages instantly',
    color: 'bg-blue-50 text-blue-700 border-blue-200',
    badge: 'Core Feature',
  },
  {
    to: '/chat',
    icon: MessageSquareText,
    emoji: '🤖',
    title: 'AI Expert Chat',
    description: 'Chat with Sarvam-M powered AI for crop, soil & pest advice',
    color: 'bg-primary-50 text-primary-700 border-primary-200',
    badge: 'Powered by Sarvam-M',
  },
  {
    to: '/crop-health',
    icon: Leaf,
    emoji: '🌿',
    title: 'Crop Health Diagnostics',
    description: 'Upload crop images to detect diseases and get treatment plans',
    color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    badge: 'AI Powered',
  },
  {
    to: '/market',
    icon: TrendingUp,
    emoji: '📈',
    title: 'Market Price Tracker',
    description: 'Real-time commodity prices from mandis across India',
    color: 'bg-orange-50 text-orange-700 border-orange-200',
    badge: 'Live Data',
  },
  {
    to: '/weather',
    icon: CloudSun,
    emoji: '⛅',
    title: 'Weather & Forecasts',
    description: 'Localized weather alerts and farming-specific climate insights',
    color: 'bg-sky-50 text-sky-700 border-sky-200',
    badge: '7-Day Forecast',
  },
  {
    to: '/forum',
    icon: Users,
    emoji: '👨‍🌾',
    title: 'Community Forum',
    description: 'Connect with farmers, share knowledge and peer support',
    color: 'bg-purple-50 text-purple-700 border-purple-200',
    badge: 'Community',
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
  const currentSeason = FARMING_SEASONS[0]
  const profile = state.userProfile
  const greeting = GREETINGS[state.selectedLanguage.code] || 'Namaste'

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-3xl bg-agri-gradient p-6 text-white shadow-xl">
        <div className="absolute inset-0 hero-pattern opacity-30" />
        <div className="relative">
          <div className="flex items-start justify-between mb-4">
            <div>
              {profile?.isProfileComplete ? (
                <div className="flex items-center gap-2 mb-2">
                  <span className="badge bg-white/20 text-white border-0 text-xs">
                    👨‍🌾 {profile.name}
                  </span>
                  {profile.primaryCrop && (
                    <span className="badge bg-white/20 text-white border-0 text-xs">
                      🌾 {profile.primaryCrop}
                    </span>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 mb-2">
                  <button
                    onClick={() => navigate('/profile')}
                    className="badge bg-white/20 text-white border-0 text-xs hover:bg-white/30 transition-colors"
                  >
                    📝 Complete your profile
                  </button>
                </div>
              )}
              <h1 className="text-2xl sm:text-3xl font-bold leading-tight text-balance">
                {greeting}, {state.selectedLanguage.flag}<br />
                <span className="text-primary-100">
                  {profile?.name ? profile.name : 'Agri-Translate AI'}
                </span>
              </h1>
              <p className="mt-2 text-primary-100 text-sm sm:text-base max-w-md">
                {profile?.state
                  ? `Farming support for ${profile.state} — multilingual AI crop advice, market prices & weather`
                  : 'Empowering India\'s farmers with multilingual AI. Get crop advice, market prices and weather alerts in your own language.'}
              </p>
            </div>
            <div className="text-6xl hidden sm:block">🌾</div>
          </div>

          <div className="flex flex-wrap gap-2 mt-4">
            <button
              onClick={() => navigate('/chat')}
              className="flex items-center gap-2 bg-white text-primary-700 font-semibold text-sm
                px-4 py-2.5 rounded-xl hover:bg-primary-50 active:scale-95 transition-all shadow-md"
            >
              <MessageSquareText size={16} />
              {t('askExpert')}
              <ArrowRight size={14} />
            </button>
            <button
              onClick={() => navigate('/translate')}
              className="flex items-center gap-2 bg-white/20 text-white font-semibold text-sm
                px-4 py-2.5 rounded-xl hover:bg-white/30 active:scale-95 transition-all border border-white/30"
            >
              <Languages size={16} />
              {t('translateNow')}
            </button>
          </div>
        </div>

        {/* Floating season badge */}
        <div className="absolute top-4 right-4 bg-white/20 rounded-xl px-3 py-2 text-xs text-white text-right hidden md:block">
          <div className="font-semibold">{currentSeason.name}</div>
          <div className="text-primary-200">{currentSeason.period}</div>
        </div>
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
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 ${
                  feature.color.split(' ').filter((c) => c.startsWith('bg')).join(' ')
                }`}>
                  {feature.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2 mb-1">
                    <h3 className="font-semibold text-gray-900 text-sm leading-snug">{feature.title}</h3>
                  </div>
                  <p className="text-xs text-gray-500 line-clamp-2">{feature.description}</p>
                  <span className={`inline-block mt-2 text-[10px] font-medium px-2 py-0.5 rounded-full ${
                    feature.color.split(' ').filter((c) => !c.startsWith('border')).join(' ')
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

      {/* AI Infrastructure Note */}
      <section className="card border border-dashed border-primary-300 bg-primary-50/50">
        <div className="flex items-center gap-3 mb-4">
          <div className="text-2xl">⚡</div>
          <div>
            <h3 className="font-bold text-gray-900 text-sm">AI & Cloud Infrastructure</h3>
            <p className="text-xs text-gray-500">Built on production-grade AI + cloud services</p>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {[
            { service: 'Sarvam-M', desc: 'Multilingual AI chat & reasoning', icon: '🧠' },
            { service: 'Sarvam Translate', desc: 'sarvam-translate:v1 — 10 languages', icon: '🌐' },
            { service: 'AWS Rekognition', desc: 'Crop disease image analysis', icon: '🔬' },
            { service: 'Amazon S3', desc: 'Image storage & data lake', icon: '📦' },
            { service: 'Supabase', desc: 'PostgreSQL — forum & user data', icon: '🗄️' },
            { service: 'FastAPI', desc: 'High-performance REST API', icon: '🚀' },
          ].map((item) => (
            <div key={item.service} className="bg-white rounded-xl p-3 border border-primary-100">
              <div className="text-xl mb-1">{item.icon}</div>
              <div className="font-medium text-gray-800 text-xs">{item.service}</div>
              <div className="text-gray-400 text-[10px]">{item.desc}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

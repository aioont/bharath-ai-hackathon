import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Mic, ArrowRight, Sprout, Zap, ExternalLink, Newspaper, ShieldCheck, Globe2, Cpu } from 'lucide-react'
import { useAppContext } from '@/context/AppContext'
import { FARMING_SEASONS, CROP_CATEGORIES } from '@/utils/constants'
import { getNewsFeed, type NewsItem } from '@/services/api'


export default function Home() {
  const { state, t } = useAppContext()
  const navigate = useNavigate()
  // Determine current season based on month (March = Zaid or Rabi)
  const month = new Date().getMonth() + 1
  const currentSeason = month >= 3 && month <= 6 ? FARMING_SEASONS[2] : month >= 10 || month <= 4 ? FARMING_SEASONS[1] : FARMING_SEASONS[0]

  const [news, setNews] = useState<NewsItem[]>([])
  const [newsLoading, setNewsLoading] = useState(true)

  useEffect(() => {
    getNewsFeed(6)
      .then((data) => setNews(data))
      .catch(() => setNews([]))
      .finally(() => setNewsLoading(false))
  }, [])

  // ── Feature cards ─────────────────────────────────────────────────────────
  const features = [
    {
      to: '/chat',
      emoji: '🤖',
      title: t('feat1Title'),
      description: t('feat1Desc'),
      bg: 'bg-gradient-to-br from-green-600 to-emerald-500',
      pill: 'bg-white/20 text-white',
      pillText: t('featurePrimeLabel'),
      dark: true,
    },
    {
      to: '/insurance',
      emoji: '🛡️',
      title: t('feat2Title'),
      description: t('feat2Desc'),
      bg: 'bg-gradient-to-br from-violet-50 to-purple-50',
      border: 'border-violet-200',
      pill: 'bg-violet-100 text-violet-700',
      pillText: t('featureGovtSchemes'),
      dark: false,
    },
    {
      to: '/crop-health',
      emoji: '🌿',
      title: t('feat3Title'),
      description: t('feat3Desc'),
      bg: 'bg-gradient-to-br from-emerald-50 to-teal-50',
      border: 'border-emerald-200',
      pill: 'bg-emerald-100 text-emerald-700',
      pillText: t('featureAIVision'),
      dark: false,
    },
    {
      to: '/weather',
      emoji: '⛅',
      title: t('feat4Title'),
      description: t('feat4Desc'),
      bg: 'bg-gradient-to-br from-sky-50 to-blue-50',
      border: 'border-sky-200',
      pill: 'bg-sky-100 text-sky-700',
      pillText: t('feature7Day'),
      dark: false,
    },
    {
      to: '/market',
      emoji: '📈',
      title: t('feat5Title'),
      description: t('feat5Desc'),
      bg: 'bg-gradient-to-br from-orange-50 to-amber-50',
      border: 'border-orange-200',
      pill: 'bg-orange-100 text-orange-700',
      pillText: t('featureRealtime'),
      dark: false,
    },
    {
      to: '/forum',
      emoji: '👥',
      title: t('feat6Title'),
      description: t('feat6Desc'),
      bg: 'bg-gradient-to-br from-purple-50 to-pink-50',
      border: 'border-purple-200',
      pill: 'bg-purple-100 text-purple-700',
      pillText: t('featurePeerNetwork'),
      dark: false,
    },
    {
      to: '/translate',
      emoji: '🌐',
      title: t('feat7Title'),
      description: t('feat7Desc'),
      bg: 'bg-gradient-to-br from-blue-50 to-indigo-50',
      border: 'border-blue-200',
      pill: 'bg-blue-100 text-blue-700',
      pillText: t('featureMultilingual'),
      dark: false,
    },
  ]

  const aiPillars = [
    {
      icon: <Globe2 size={18} className="text-blue-500" />,
      title: t('pillar1Title'),
      desc: t('pillar1Desc'),
    },
    {
      icon: <Cpu size={18} className="text-purple-500" />,
      title: t('pillar2Title'),
      desc: t('pillar2Desc'),
    },
    {
      icon: <Sprout size={18} className="text-green-600" />,
      title: t('pillar3Title'),
      desc: t('pillar3Desc'),
    },
    {
      icon: <Zap size={18} className="text-yellow-500" />,
      title: t('pillar4Title'),
      desc: t('pillar4Desc'),
    },
  ]

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── HERO ──────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl bg-agri-gradient p-6 sm:p-8 text-white shadow-xl">
        <div className="absolute inset-0 hero-pattern opacity-30" />
        <div className="absolute top-4 right-4 bg-white/20 backdrop-blur-sm rounded-xl px-3 py-2 text-xs text-white text-right hidden lg:block z-10">
          <div className="font-semibold">{currentSeason.name}</div>
          <div className="text-primary-200">{currentSeason.period}</div>
        </div>

        <div className="relative">
          {/* AWS badge */}
          <div className="inline-flex items-center gap-1.5 bg-white/15 backdrop-blur-sm border border-white/30 rounded-full px-3 py-1 mb-4 text-[11px] font-semibold text-white/90 tracking-wide">
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-300 animate-pulse" />
            Powered by Amazon Bedrock · Sarvam AI · AWS EC2, S3, OpenSearch, RDS, Rekognition 
          </div>

          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black leading-tight mb-2 tracking-tight">
                {t('heroHeading')}
              </h1>
              <p className="text-primary-100 text-sm sm:text-base max-w-xl leading-relaxed">
                {t('heroSubtitle')}
              </p>
            </div>
            <div className="text-5xl sm:text-6xl flex-shrink-0 hidden sm:block animate-bounce-slow">🌾</div>
          </div>

          {/* Profile badges */}
          {state.authUser && (
            <div className="flex flex-wrap items-center gap-2 mb-4">
              {state.authUser.full_name && (
                <span className="badge bg-white/20 text-white border-0 text-xs">👨‍🌾 {state.authUser.full_name}</span>
              )}
              {state.authUser.state && (
                <span className="badge bg-white/20 text-white border-0 text-xs">📍 {state.authUser.state}</span>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-3 mt-2">
            <button onClick={() => navigate('/chat')}
              className="flex items-center gap-2 bg-white text-primary-700 font-bold text-sm px-5 py-3 rounded-xl
                hover:bg-primary-50 active:scale-95 transition-all shadow-lg hover:shadow-xl">
              <Mic size={18} /> {t('talkToAgriSaarthi')} <ArrowRight size={14} />
            </button>
            <button onClick={() => navigate('/insurance')}
              className="flex items-center gap-2 bg-white/20 text-white font-semibold text-sm px-4 py-3 rounded-xl
                hover:bg-white/30 active:scale-95 transition-all border border-white/30 backdrop-blur-sm">
              <ShieldCheck size={16} /> {t('feat2Title')}
            </button>
            <button onClick={() => navigate('/crop-health')}
              className="flex items-center gap-2 bg-white/20 text-white font-semibold text-sm px-4 py-3 rounded-xl
                hover:bg-white/30 active:scale-95 transition-all border border-white/30 backdrop-blur-sm">
              <Sprout size={16} /> {t('feat3Title')}
            </button>
          </div>
        </div>
      </div>



      {/* ── AGENT CARD ────────────────────────────────────────────── */}
      <div
        role="button" tabIndex={0}
        onClick={() => navigate('/chat')}
        onKeyDown={(e) => e.key === 'Enter' && navigate('/chat')}
        className="relative overflow-hidden rounded-3xl cursor-pointer select-none group animate-agent-card"
        style={{ background: 'linear-gradient(135deg, #052e16 0%, #064e3b 25%, #065f46 50%, #047857 70%, #052e16 100%)' }}
      >
        <div className="absolute inset-0 animate-gradient-shift opacity-60"
          style={{ background: 'linear-gradient(135deg, #052e16, #065f46, #0d9488, #047857, #064e3b, #052e16)' }} />
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'linear-gradient(rgba(134,239,172,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(134,239,172,0.3) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        <div className="absolute inset-0 pointer-events-none">
          <div className="animate-particle-1 absolute top-6 left-[12%] w-1.5 h-1.5 rounded-full bg-green-300/60" />
          <div className="animate-particle-2 absolute top-10 right-[18%] w-2 h-2 rounded-full bg-emerald-200/50" />
          <div className="animate-particle-3 absolute bottom-8 left-[30%] w-1 h-1 rounded-full bg-green-400/70" />
          <div className="animate-particle-4 absolute bottom-12 right-[25%] w-1.5 h-1.5 rounded-full bg-teal-300/60" />
        </div>

        <div className="relative z-10 flex flex-col sm:flex-row items-center gap-6 sm:gap-10 px-6 sm:px-10 py-8 sm:py-10">
          <div className="relative flex-shrink-0 flex items-center justify-center w-36 h-36 sm:w-44 sm:h-44">
            <div className="animate-agent-ring absolute inset-0 rounded-full border-2 border-green-300/30 bg-green-400/5" />
            <div className="animate-agent-ring2 absolute inset-4 rounded-full border-2 border-green-300/40 bg-green-400/8" />
            <div className="animate-agent-ring3 absolute inset-8 rounded-full border-2 border-green-200/60 bg-green-300/10" />
            <div className="animate-agent-float relative z-10 w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform duration-500"
              style={{ background: 'linear-gradient(135deg, #16a34a 0%, #059669 50%, #0d9488 100%)', boxShadow: '0 0 40px rgba(74,222,128,0.35), 0 8px 32px rgba(0,0,0,0.4)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-10 h-10 sm:w-12 sm:h-12 drop-shadow-lg">
                <rect x="9" y="2" width="6" height="11" rx="3" fill="rgba(255,255,255,0.15)" />
                <path d="M19 10v2a7 7 0 01-14 0v-2" /><line x1="12" y1="19" x2="12" y2="22" /><line x1="8" y1="22" x2="16" y2="22" />
              </svg>
            </div>
          </div>

          <div className="flex-1 text-center sm:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-3 text-xs font-semibold tracking-widest uppercase"
              style={{ background: 'rgba(134,239,172,0.12)', border: '1px solid rgba(134,239,172,0.3)', color: '#86efac' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              Autonomous AI · Amazon Bedrock · 15+ Languages
            </div>
            <h2 className="animate-text-shimmer text-2xl sm:text-3xl lg:text-4xl font-black leading-tight mb-2"
              style={{ letterSpacing: '-0.02em' }}>
              {t('agentHeading')}
            </h2>
            <p className="text-green-200/70 text-sm mb-4 max-w-md mx-auto sm:mx-0 leading-relaxed">
              {t('agentCardDesc')}
            </p>
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3">
              <div className="flex items-center gap-2.5 px-5 py-2.5 rounded-xl font-bold text-sm transition-all duration-300 group-hover:scale-105"
                style={{ background: 'linear-gradient(135deg, #22c55e, #10b981)', color: '#fff', boxShadow: '0 4px 20px rgba(34,197,94,0.4)' }}>
                <Mic size={14} /> {t('talkToAgent')} <ArrowRight size={14} />
              </div>
              <span className="text-green-300/60 text-xs font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                {t('voiceTextCaption')}
              </span>
            </div>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(134,239,172,0.5), transparent)' }} />
      </div>

      {/* ── FEATURE CARDS ─────────────────────────────────────────── */}
      <section>
        <h2 className="section-title">{t('whatCanIHelp')}</h2>
        <p className="section-subtitle">{t('tapFeature')}</p>

        {/* Hero feature — full width */}
        <button onClick={() => navigate(features[0].to)}
          className={`w-full mb-4 rounded-2xl p-5 text-left active:scale-[0.98] transition-transform ${features[0].bg} shadow-md hover:shadow-lg`}>
          <div className="flex items-center justify-between mb-3">
            <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${features[0].pill}`}>{features[0].pillText}</span>
            <ArrowRight size={18} className="text-white/70" />
          </div>
          <div className="text-4xl mb-2">{features[0].emoji}</div>
          <h3 className="text-lg font-bold text-white leading-tight mb-1">{features[0].title}</h3>
          <p className="text-white/80 text-xs leading-relaxed max-w-sm">{features[0].description}</p>
        </button>

        {/* 2-col grid for the rest */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {features.slice(1).map((f) => (
            <button key={f.to} onClick={() => navigate(f.to)}
              className={`rounded-2xl p-4 text-left border active:scale-[0.97] transition-all hover:shadow-md ${f.bg} ${f.border ?? ''}`}>
              <div className="flex items-start justify-between mb-3">
                <span className="text-2xl">{f.emoji}</span>
                <ArrowRight size={13} className="text-gray-400 mt-0.5" />
              </div>
              <h3 className="font-bold text-gray-900 text-xs leading-snug mb-1">{f.title}</h3>
              <p className="text-[10px] text-gray-500 leading-relaxed line-clamp-3">{f.description}</p>
              <span className={`inline-block mt-2 text-[9px] font-semibold px-2 py-0.5 rounded-full ${f.pill}`}>{f.pillText}</span>
            </button>
          ))}
        </div>
      </section>



      {/* ── WHY AI — 4 pillars ────────────────────────────────────── */}
      <section className="card bg-gradient-to-br from-slate-50 to-primary-50 border border-slate-100">
        <div className="flex items-center gap-2 mb-4">
          <Cpu size={16} className="text-primary-600" />
          <h2 className="font-bold text-gray-900 text-sm">{t('whyAIHeading')}</h2>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {aiPillars.map((p) => (
            <div key={p.title} className="flex gap-3">
              <div className="flex-shrink-0 w-9 h-9 bg-white rounded-xl flex items-center justify-center shadow-sm">
                {p.icon}
              </div>
              <div>
                <h4 className="font-bold text-gray-900 text-xs mb-0.5">{p.title}</h4>
                <p className="text-[10px] text-gray-500 leading-relaxed">{p.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CROP CATEGORIES ───────────────────────────────────────── */}
      <section>
        <h2 className="section-title">{t('cropCategories')}</h2>
        <p className="section-subtitle">{t('findCropAdvice')}</p>
        <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2">
          {CROP_CATEGORIES.map((cat) => (
            <button key={cat.id} onClick={() => navigate(`/chat?category=${cat.id}`)}
              className="flex-shrink-0 card border border-gray-100 hover:border-primary-300 hover:bg-primary-50
                transition-all text-center py-4 px-5 min-w-[110px] active:scale-95">
              <div className="text-3xl mb-2">{cat.icon}</div>
              <div className="font-medium text-gray-800 text-xs">{cat.name}</div>
              <div className="text-gray-400 text-xs mt-1">{cat.crops.length} crops</div>
            </button>
          ))}
        </div>
      </section>

      {/* ── AGRI NEWS ─────────────────────────────────────────────── */}
      <section className="card border border-green-200 bg-green-50/40">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-green-100 rounded-xl flex items-center justify-center">
              <Newspaper size={18} className="text-green-700" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-sm">{t('latestNews')}</h3>
              <p className="text-xs text-gray-500">{t('latestNewsSubtitle')}</p>
            </div>
          </div>
          <a href="https://eng.ruralvoice.in" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-green-700 hover:text-green-900 font-medium">
            {t('viewAll')} <ExternalLink size={11} />
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
          <p className="text-sm text-gray-500 text-center py-4">{t('newsLoadError')}</p>
        ) : (
          <div className="space-y-3">
            {news.map((item, idx) => (
              <a key={item.guid || idx} href={item.link} target="_blank" rel="noopener noreferrer"
                className="flex gap-3 group hover:bg-white rounded-xl p-2 -mx-2 transition-colors">
                {item.image_url ? (
                  <img src={item.image_url} alt="" className="w-16 h-14 object-cover rounded-lg flex-shrink-0 bg-gray-100"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                ) : (
                  <div className="w-16 h-14 bg-green-100 rounded-lg flex-shrink-0 flex items-center justify-center text-2xl">🌾</div>
                )}
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-semibold text-gray-900 line-clamp-2 group-hover:text-green-700 transition-colors leading-snug">{item.title}</h4>
                  <p className="text-[10px] text-gray-500 line-clamp-2 mt-0.5">{item.description}</p>
                  <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-400">
                    {item.author && <span>✍ {item.author}</span>}
                    {item.pub_date && <span>{new Date(item.pub_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>}
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

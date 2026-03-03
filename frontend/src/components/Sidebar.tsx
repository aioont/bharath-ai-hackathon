import { useState } from 'react'
import { NavLink, Link } from 'react-router-dom'
import {
  Home, Languages, MessageSquareText, Leaf, TrendingUp,
  CloudSun, Users, HelpCircle, UserCircle, LogIn, ChevronDown, Check, Shield,
} from 'lucide-react'
import { useAppContext } from '@/context/AppContext'
import { SUPPORTED_LANGUAGES } from '@/utils/constants'

const navItems = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/chat', label: 'AgriSaarthi', icon: MessageSquareText },
  { to: '/forum', label: 'Community Forum', icon: Users },
  { to: '/crop-health', label: 'Crop Health', icon: Leaf },
  { to: '/insurance', label: 'Insurance Advisor', icon: Shield },
  { to: '/market', label: 'Market Prices', icon: TrendingUp },
  { to: '/weather', label: 'Weather', icon: CloudSun },
  { to: '/translate', label: 'Translate', icon: Languages },
]

export default function Sidebar() {
  const { state, t, setLanguage } = useAppContext()
  const profile = state.userProfile
  const authUser = state.authUser
  const lang = state.selectedLanguage

  const [langOpen, setLangOpen] = useState(false)

  return (
    <div className="flex flex-col h-screen pt-16 pb-16 overflow-y-auto">
      {/* App brand (mobile only) */}
      <div className="px-4 mb-4 lg:hidden">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-agri-gradient rounded-xl flex items-center justify-center text-xl shadow-md">
            🌾
          </div>
          <div>
            <h2 className="font-bold text-gray-900 text-sm">Agri-Translate AI</h2>
            <p className="text-xs text-primary-600">Powered by Sarvam AI</p>
          </div>
        </div>
      </div>

      {/* Language — prominent display + expandable selector */}
      <div className="px-4 mb-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
          🌐 Your Language
        </p>
        {/* Current language pill — always visible */}
        <div
          className="flex items-center gap-3 px-3 py-2.5 bg-primary-50 border-2 border-primary-200 rounded-xl cursor-pointer hover:bg-primary-100 transition-colors"
          onClick={() => setLangOpen(o => !o)}
          title="Click to change language"
        >
          <span className="text-2xl leading-none">{lang.flag}</span>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-primary-800 leading-tight">{lang.englishName}</div>
            <div className="text-xs text-primary-500">{lang.name}</div>
          </div>
          <ChevronDown
            size={15}
            className={`text-primary-400 shrink-0 transition-transform duration-200 ${langOpen ? 'rotate-180' : ''}`}
          />
        </div>
        {/* Expandable full selector */}
        {langOpen && (
          <div className="mt-2 text-sm bg-white rounded-xl shadow-inner border border-gray-200 overflow-hidden">
             {SUPPORTED_LANGUAGES.map((l) => (
                <button
                  key={l.code}
                  onClick={() => {
                    setLanguage(l)
                    setLangOpen(false)
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-primary-50 transition-colors ${
                    l.code === lang.code ? 'bg-primary-50 text-primary-900 border-l-2 border-primary-500' : 'text-gray-700'
                  }`}
                >
                  <span className="text-xl leading-none">{l.flag}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-xs truncate leading-tight">{l.englishName}</div>
                    <div className="text-[10px] text-gray-500 truncate">{l.name}</div>
                  </div>
                  {l.code === lang.code && <Check size={14} className="text-primary-600 shrink-0" />}
                </button>
             ))}
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1 mb-2">{t('features')}</p>
        {authUser ? (
          <ul className="space-y-1">
            {navItems.map(({ to, label, icon: Icon }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={to === '/'}
                  className={({ isActive }) =>
                    isActive ? 'nav-link-active' : 'nav-link'
                  }
                >
                  <Icon size={18} />
                  <span className="text-sm">{label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mx-1 mt-2 p-4 bg-primary-50 border border-primary-100 rounded-xl text-center">
            <div className="text-3xl mb-2">🌾</div>
            <p className="text-xs text-gray-600 mb-3 leading-snug">Sign in to access all features — chat, market prices, weather & more.</p>
            <Link
              to="/login"
              className="flex items-center justify-center gap-1.5 w-full px-3 py-2 bg-primary-600 text-white text-xs font-semibold rounded-lg hover:bg-primary-700 transition-colors"
            >
              <LogIn size={13} />
              Sign In
            </Link>
            <Link
              to="/register"
              className="mt-2 block text-xs text-primary-600 hover:underline"
            >
              New here? Create account
            </Link>
          </div>
        )}
      </nav>

      {/* Bottom section */}
      <div className="px-3 pt-4 border-t border-gray-100 space-y-1">
        {authUser && (
          <NavLink
            to="/profile"
            className={({ isActive }) => isActive ? 'nav-link-active' : 'nav-link'}
          >
            <UserCircle size={18} />
            <span className="text-sm">{t('profile')}</span>
          </NavLink>
        )}

        {/* Farmer profile quick card — only when logged in */}
        {authUser && (profile?.isProfileComplete ? (
          <NavLink to="/profile" className="mt-3 block p-3 bg-primary-50 rounded-xl hover:bg-primary-100 transition-colors">
            <div className="flex items-center gap-2">
              <span className="text-xl">👨‍🌾</span>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-primary-800 truncate">{profile.name}</p>
                <p className="text-[10px] text-gray-500 truncate">{profile.district ? `${profile.district} · ` : ''}{profile.state}</p>
              </div>
            </div>
          </NavLink>
        ) : (
          <NavLink to="/profile" className="mt-3 block p-3 bg-amber-50 rounded-xl hover:bg-amber-100 transition-colors border border-amber-200">
            <div className="flex items-center gap-2">
              <span className="text-lg">📝</span>
              <div>
                <p className="text-xs font-semibold text-amber-800">Complete your profile</p>
                <p className="text-[10px] text-gray-500">Get personalised advice</p>
              </div>
            </div>
          </NavLink>
        ))}
      </div>
    </div>
  )
}


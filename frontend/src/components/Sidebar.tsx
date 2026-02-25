import { NavLink } from 'react-router-dom'
import {
  Home, Languages, MessageSquareText, Leaf, TrendingUp,
  CloudSun, Users, HelpCircle, UserCircle
} from 'lucide-react'
import { useAppContext } from '@/context/AppContext'
import LanguageSelector from './LanguageSelector'

const navItems = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/translate', label: 'Translate', icon: Languages },
  { to: '/chat', label: 'AI Expert Chat', icon: MessageSquareText },
  { to: '/crop-health', label: 'Crop Health', icon: Leaf },
  { to: '/market', label: 'Market Prices', icon: TrendingUp },
  { to: '/weather', label: 'Weather', icon: CloudSun },
  { to: '/forum', label: 'Community Forum', icon: Users },
]

export default function Sidebar() {
  const { state, t } = useAppContext()
  const profile = state.userProfile

  return (
    <div className="flex flex-col h-full pt-16 lg:pt-4 pb-4">
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

      {/* Language Selector */}
      <div className="px-4 mb-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{t('yourFarm') || 'Your Language'}</p>
        <LanguageSelector />
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1 mb-2">{t('features')}</p>
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
      </nav>

      {/* Bottom section */}
      <div className="px-3 pt-4 border-t border-gray-100 space-y-1">
        <NavLink
          to="/profile"
          className={({ isActive }) => isActive ? 'nav-link-active' : 'nav-link'}
        >
          <UserCircle size={18} />
          <span className="text-sm">{t('profile')}</span>
        </NavLink>
        <div className="nav-link">
          <HelpCircle size={18} />
          <span className="text-sm">{t('help')}</span>
        </div>

        {/* Farmer profile quick card */}
        {profile?.isProfileComplete ? (
          <NavLink to="/profile" className="mt-3 block p-3 bg-primary-50 rounded-xl hover:bg-primary-100 transition-colors">
            <div className="flex items-center gap-2">
              <span className="text-xl">👨‍🌾</span>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-primary-800 truncate">{profile.name}</p>
                <p className="text-[10px] text-gray-500 truncate">{profile.primaryCrop}{profile.state ? ` · ${profile.state}` : ''}</p>
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
        )}
      </div>
    </div>
  )
}


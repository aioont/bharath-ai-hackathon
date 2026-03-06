import { NavLink } from 'react-router-dom'
import { Home, Languages, Mic, TrendingUp, Users } from 'lucide-react'
import { useAppContext } from '@/context/AppContext'

export default function BottomNav() {
  const { t } = useAppContext()

  const bottomNavItems = [
    { to: '/', labelKey: 'home', icon: Home },
    { to: '/chat', labelKey: 'chatTitle', icon: Mic },
    { to: '/forum', labelKey: 'community', icon: Users },
    { to: '/market', labelKey: 'marketTitle', icon: TrendingUp },
    { to: '/translate', labelKey: 'translateTitle', icon: Languages },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-20 bg-white border-t border-gray-200 safe-bottom lg:hidden">
      <div className="flex items-center justify-around h-16 px-1">
        {bottomNavItems.map(({ to, labelKey, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all duration-200 min-w-0 flex-1 ${
                isActive
                  ? 'text-primary-700'
                  : 'text-gray-400 hover:text-gray-600'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <div className={`p-1.5 rounded-lg ${isActive ? 'bg-primary-100' : ''}`}>
                  <Icon size={20} strokeWidth={isActive ? 2.5 : 1.8} />
                </div>
                <span className="text-[10px] font-medium truncate">{t(labelKey!)}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

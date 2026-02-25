import { NavLink } from 'react-router-dom'
import { Home, Languages, MessageSquareText, Leaf, TrendingUp, CloudSun, Users } from 'lucide-react'

const bottomNavItems = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/translate', label: 'Translate', icon: Languages },
  { to: '/chat', label: 'AI Chat', icon: MessageSquareText },
  { to: '/market', label: 'Market', icon: TrendingUp },
  { to: '/forum', label: 'Forum', icon: Users },
]

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-20 bg-white border-t border-gray-200 safe-bottom lg:hidden">
      <div className="flex items-center justify-around h-16 px-1">
        {bottomNavItems.map(({ to, label, icon: Icon }) => (
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
                <span className="text-[10px] font-medium truncate">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

import { Menu, Globe, Bell, Wifi, WifiOff, UserCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAppContext } from '@/context/AppContext'

export default function Navbar() {
  const { state, dispatch } = useAppContext()
  const profile = state.userProfile

  return (
    <header className="sticky top-0 z-20 bg-white border-b border-gray-100 shadow-sm">
      <div className="flex items-center justify-between h-16 px-4 max-w-7xl mx-auto">
        {/* Left: Hamburger + Logo */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => dispatch({ type: 'TOGGLE_SIDEBAR' })}
            className="p-2 rounded-xl text-gray-500 hover:bg-primary-50 hover:text-primary-700 transition-colors lg:hidden"
            aria-label="Toggle menu"
          >
            <Menu size={22} />
          </button>

          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-agri-gradient rounded-xl flex items-center justify-center text-lg shadow-md">
              🌾
            </div>
            <div className="hidden sm:block">
              <h1 className="text-base font-bold text-gray-900 leading-none">Agri-Translate AI</h1>
              <p className="text-xs text-primary-600 font-medium">Powered by Sarvam AI</p>
            </div>
          </div>
        </div>

        {/* Right: Controls */}
        <div className="flex items-center gap-2">
          {/* Online indicator */}
          <div className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium ${
            state.isOnline
              ? 'bg-primary-50 text-primary-700'
              : 'bg-red-50 text-red-600'
          }`}>
            {state.isOnline ? <Wifi size={12} /> : <WifiOff size={12} />}
            {state.isOnline ? 'Online' : 'Offline'}
          </div>

          {/* Language selector */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-50 rounded-xl text-sm font-medium text-primary-700 cursor-pointer hover:bg-primary-100 transition-colors">
            <Globe size={15} />
            <span className="hidden sm:inline">{state.selectedLanguage.flag} {state.selectedLanguage.englishName}</span>
            <span className="sm:hidden">{state.selectedLanguage.flag}</span>
          </div>

          {/* Profile */}
          <Link
            to="/profile"
            className="relative p-2 rounded-xl text-gray-500 hover:bg-primary-50 hover:text-primary-700 transition-colors"
            title={profile?.name || 'My Profile'}
          >
            {profile?.isProfileComplete ? (
              <span className="w-8 h-8 bg-agri-gradient rounded-xl flex items-center justify-center text-sm font-bold text-white">
                {profile.name.charAt(0).toUpperCase()}
              </span>
            ) : (
              <UserCircle size={22} />
            )}
          </Link>

          {/* Notifications */}
          <button className="relative p-2 rounded-xl text-gray-500 hover:bg-gray-100 transition-colors">
            <Bell size={20} />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary-500 rounded-full" />
          </button>
        </div>
      </div>
    </header>
  )
}

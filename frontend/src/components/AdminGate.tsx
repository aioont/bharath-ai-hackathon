import { useState } from 'react'
import { Lock, LogOut, Database, Activity, Zap } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'

export default function AdminGate({ children }: { children: React.ReactNode }) {
  const [auth, setAuth] = useState(() => {
    return sessionStorage.getItem('admin_auth') === 'true'
  })
  const [creds, setCreds] = useState({ user: '', pass: '' })
  const [error, setError] = useState('')
  const location = useLocation()

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    if (creds.user === 'admin' && creds.pass === 'admin') {
      setAuth(true)
      sessionStorage.setItem('admin_auth', 'true')
      setError('')
    } else {
      setError('Invalid credentials')
    }
  }

  const handleLogout = () => {
    setAuth(false)
    sessionStorage.removeItem('admin_auth')
  }

  if (auth) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* Admin Header */}
        <header className="bg-gray-900 text-white shadow-md sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center gap-8">
                <div className="font-bold text-xl flex items-center gap-2">
                  <Lock className="text-red-400" size={20} />
                  <span>Admin Panel</span>
                </div>
                <nav className="hidden md:flex space-x-4">
                  <Link 
                    to="/admin/eval" 
                    className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      location.pathname === '/admin/eval' ? 'bg-gray-800 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                    }`}
                  >
                    <Activity size={16} /> Evaluation
                  </Link>
                  <Link 
                    to="/admin/tables" 
                    className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      location.pathname === '/admin/tables' ? 'bg-gray-800 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                    }`}
                  >
                    <Database size={16} /> Database Tables
                  </Link>
                  <Link 
                    to="/admin/cache" 
                    className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      location.pathname === '/admin/cache' ? 'bg-gray-800 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                    }`}
                  >
                    <Zap size={16} /> Cache Stats
                  </Link>
                </nav>
              </div>
              
              <button 
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-400 hover:text-red-300 hover:bg-gray-800 rounded-md transition-colors"
              >
                <LogOut size={16} /> Logout
              </button>
            </div>
          </div>
        </header>

        {/* Mobile Navigation */}
        <div className="md:hidden bg-gray-800 p-2 flex justify-center space-x-2">
          <Link 
            to="/admin/eval" 
            className={`flex-1 flex justify-center items-center gap-2 px-3 py-2 rounded-md text-xs font-medium ${
              location.pathname === '/admin/eval' ? 'bg-gray-900 text-white' : 'text-gray-300'
            }`}
          >
            <Activity size={14} /> Eval
          </Link>
          <Link 
            to="/admin/tables" 
            className={`flex-1 flex justify-center items-center gap-2 px-3 py-2 rounded-md text-xs font-medium ${
              location.pathname === '/admin/tables' ? 'bg-gray-900 text-white' : 'text-gray-300'
            }`}
          >
            <Database size={14} /> Tables
          </Link>
          <Link 
            to="/admin/cache" 
            className={`flex-1 flex justify-center items-center gap-2 px-3 py-2 rounded-md text-xs font-medium ${
              location.pathname === '/admin/cache' ? 'bg-gray-900 text-white' : 'text-gray-300'
            }`}
          >
            <Zap size={14} /> Cache
          </Link>
        </div>

        {/* Main Content */}
        <main className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center min-h-[60vh] p-4">
      <div className="w-full max-w-sm bg-white p-8 rounded-2xl shadow-lg border border-gray-100 animate-in fade-in zoom-in duration-300">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center text-red-500">
            <Lock size={32} />
          </div>
        </div>
        <h2 className="text-xl font-bold text-center text-gray-800 mb-6">Admin Access Required</h2>
        
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Username</label>
            <input 
              type="text" 
              value={creds.user}
              onChange={e => setCreds({...creds, user: e.target.value})}
              className="w-full mt-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Password</label>
            <input 
              type="password" 
              value={creds.pass}
              onChange={e => setCreds({...creds, pass: e.target.value})}
              className="w-full mt-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all"
            />
          </div>
          
          {error && <p className="text-red-500 text-sm text-center font-medium bg-red-50 py-1 rounded">{error}</p>}
          
          <button type="submit" className="w-full bg-gray-900 text-white py-2.5 rounded-lg font-semibold hover:bg-black transition-colors shadow-lg hover:shadow-xl transform active:scale-95 duration-200">
            Unlock Dashboard
          </button>
        </form>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { Lock } from 'lucide-react'

export default function AdminGate({ children }: { children: React.ReactNode }) {
  const [auth, setAuth] = useState(false)
  const [creds, setCreds] = useState({ user: '', pass: '' })
  const [error, setError] = useState('')

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    if (creds.user === 'admin' && creds.pass === 'admin') {
      setAuth(true)
      setError('')
    } else {
      setError('Invalid credentials')
    }
  }

  if (auth) return <>{children}</>

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

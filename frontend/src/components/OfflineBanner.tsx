import { useEffect, useState } from 'react'
import { WifiOff, RefreshCw } from 'lucide-react'
import { useAppContext } from '@/context/AppContext'

export default function OfflineBanner() {
  const { state } = useAppContext()
  const [showReconnected, setShowReconnected] = useState(false)
  const [prevOnline, setPrevOnline] = useState(state.isOnline)

  useEffect(() => {
    if (!prevOnline && state.isOnline) {
      setShowReconnected(true)
      const t = setTimeout(() => setShowReconnected(false), 3000)
      return () => clearTimeout(t)
    }
    setPrevOnline(state.isOnline)
  }, [state.isOnline, prevOnline])

  if (state.isOnline && !showReconnected) return null

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-2 py-2 px-4 text-sm font-medium text-white transition-all duration-300 ${
        !state.isOnline ? 'bg-red-500' : 'bg-primary-600'
      }`}
    >
      {!state.isOnline ? (
        <>
          <WifiOff size={15} />
          <span>You're offline. Some features may be limited.</span>
        </>
      ) : (
        <>
          <RefreshCw size={15} className="animate-spin" />
          <span>Back online! Syncing data...</span>
        </>
      )}
    </div>
  )
}

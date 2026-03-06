import { useState, useEffect } from 'react'
import { Download, X, Smartphone } from 'lucide-react'
import { useAppContext } from '@/context/AppContext'

export default function PWAInstallBanner() {
  const { state, installApp, t } = useAppContext()
  const [dismissed, setDismissed] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const wasDismissed = localStorage.getItem('pwa-install-dismissed')
    if (state.installPromptEvent && !wasDismissed && !state.isInstalled) {
      const t = setTimeout(() => setVisible(true), 3000)
      return () => clearTimeout(t)
    }
  }, [state.installPromptEvent, state.isInstalled])

  const handleDismiss = () => {
    setDismissed(true)
    setVisible(false)
    localStorage.setItem('pwa-install-dismissed', '1')
  }

  const handleInstall = async () => {
    await installApp()
    setVisible(false)
  }

  if (!visible || dismissed || state.isInstalled) return null

  return (
    <div className="install-prompt animate-slide-up-bounce">
      <div className="flex-shrink-0 w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
        <Smartphone size={22} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm">Install {t('appName')}</p>
        <p className="text-xs text-primary-200 truncate">Access offline & get instant updates</p>
      </div>
      <button
        onClick={handleInstall}
        className="flex-shrink-0 bg-white text-primary-700 font-semibold text-sm px-3 py-1.5 rounded-lg hover:bg-primary-50 transition-colors"
      >
        <Download size={16} />
      </button>
      <button onClick={handleDismiss} className="flex-shrink-0 text-white/70 hover:text-white">
        <X size={18} />
      </button>
    </div>
  )
}

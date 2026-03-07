import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Menu, Globe, Bell, Wifi, WifiOff, LogIn, LogOut, X,
  AlertTriangle, Leaf, RefreshCw, Volume2, VolumeX, Loader2,
} from 'lucide-react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAppContext } from '@/context/AppContext'
import { getWeatherForecast, translateText, type WeatherForecast } from '@/services/api'
import toast from 'react-hot-toast'

const SEVERITY_COLORS: Record<string, string> = {
  high: 'bg-red-50 border-red-300 text-red-800',
  medium: 'bg-amber-50 border-amber-300 text-amber-800',
  low: 'bg-blue-50 border-blue-300 text-blue-700',
}

// BCP-47 codes for speech synthesis — maps our 2-letter codes
const SPEECH_LANG: Record<string, string> = {
  hi: 'hi-IN', bn: 'bn-IN', te: 'te-IN', mr: 'mr-IN',
  ta: 'ta-IN', gu: 'gu-IN', kn: 'kn-IN', ml: 'ml-IN',
  pa: 'pa-IN', or: 'or-IN', as: 'as-IN', ur: 'ur-PK',
  en: 'en-IN', ne: 'ne-NP', sa: 'sa-IN', si: 'si-LK',
}

// ─── Speaker Button ───────────────────────────────────────────────────────────
function SpeakerButton({
  text,
  langCode,
  speakingId,
  setSpeakingState,
  id,
}: {
  text: string
  langCode: string
  speakingId: string | null
  setSpeakingState: (id: string | null, loading?: boolean) => void
  id: string
}) {
  const isSpeaking = speakingId === id
  const isLoadingId = speakingId === `${id}__loading`

  const handleClick = useCallback(async () => {
    // If already speaking this item → stop
    if (isSpeaking) {
      window.speechSynthesis.cancel()
      setSpeakingState(null)
      return
    }
    // Stop whatever is currently playing
    window.speechSynthesis.cancel()
    setSpeakingState(null)

    const isEnglish = langCode === 'en'

    // Mark loading state
    setSpeakingState(`${id}__loading`)

    let finalText = text
    if (!isEnglish) {
      try {
        const result = await translateText({
          text,
          source_language: 'en',
          target_language: langCode,
          domain: 'agriculture',
        })
        finalText = result.translated_text
      } catch {
        // If translation fails, fall back to English
        toast.error('Translation unavailable, reading in English')
        finalText = text
      }
    }

    const utterance = new SpeechSynthesisUtterance(finalText)
    utterance.lang = SPEECH_LANG[langCode] ?? 'en-IN'
    utterance.rate = 0.9
    utterance.onstart = () => setSpeakingState(id)
    utterance.onend = () => setSpeakingState(null)
    utterance.onerror = () => setSpeakingState(null)
    window.speechSynthesis.speak(utterance)
  }, [text, langCode, id, isSpeaking, setSpeakingState])

  return (
    <button
      onClick={handleClick}
      title={isSpeaking ? 'Stop' : `Read aloud in ${langCode.toUpperCase()}`}
      className={`shrink-0 p-1 rounded-lg transition-all ${isSpeaking
        ? 'text-primary-600 bg-primary-100 animate-pulse'
        : isLoadingId
          ? 'text-gray-400 cursor-wait'
          : 'text-gray-400 hover:text-primary-600 hover:bg-primary-50'
        }`}
    >
      {isLoadingId ? (
        <Loader2 size={13} className="animate-spin" />
      ) : isSpeaking ? (
        <VolumeX size={13} />
      ) : (
        <Volume2 size={13} />
      )}
    </button>
  )
}

// ─── Main Navbar ──────────────────────────────────────────────────────────────
export default function Navbar() {
  const { state, dispatch, logout, t } = useAppContext()
  const navigate = useNavigate()
  const location = useLocation()
  const isAuthRoute = location.pathname === '/' || location.pathname === '/login' || location.pathname === '/register'
  const authUser = state.authUser
  const userProfile = state.userProfile
  const langCode = state.selectedLanguage.code

  // ── Notification panel state ──────────────────────────────────────────────
  const [notifOpen, setNotifOpen] = useState(false)
  const [weatherData, setWeatherData] = useState<WeatherForecast | null>(null)
  const [notifLoading, setNotifLoading] = useState(false)
  const [fetchedFor, setFetchedFor] = useState<string>('')
  const panelRef = useRef<HTMLDivElement>(null)

  // Shared speaking state:  null = silent, "<id>" = speaking, "<id>__loading" = translating
  const [speakingId, setSpeakingIdRaw] = useState<string | null>(null)
  const setSpeakingState = useCallback((id: string | null) => {
    setSpeakingIdRaw(id)
  }, [])

  // Stop speech when panel is closed
  useEffect(() => {
    if (!notifOpen) {
      window.speechSynthesis.cancel()
      setSpeakingIdRaw(null)
    }
  }, [notifOpen])

  // Fetch weather when user logs in and has a state set in profile
  useEffect(() => {
    const location = userProfile?.state
      ? `${userProfile.state}, India`
      : authUser
        ? 'India'
        : null

    if (!authUser || !location || location === fetchedFor) return

    setNotifLoading(true)
    getWeatherForecast(location, state.selectedLanguage.code, 3)
      .then((data) => {
        setWeatherData(data)
        setFetchedFor(location)
      })
      .catch(() => {/* silent — bell will show no-data state */ })
      .finally(() => setNotifLoading(false))
  }, [authUser, userProfile?.state])

  // Close panel on outside click
  useEffect(() => {
    if (!notifOpen) return
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setNotifOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [notifOpen])

  const handleLogout = () => {
    logout()
    toast.success('Signed out successfully')
    navigate('/')
  }

  const refreshWeather = () => {
    setFetchedFor('')
    setWeatherData(null)
  }

  const current = weatherData?.current
  const hasAlerts = (current?.alerts?.length ?? 0) > 0
  const conditionEmoji: Record<string, string> = {
    clear: '☀️', 'partly-cloudy': '⛅', cloudy: '☁️',
    rain: '🌧️', 'heavy-rain': '⛈️', thunderstorm: '⛈️',
    fog: '🌫️', snow: '❄️', hail: '🌨️',
  }
  const emoji = conditionEmoji[current?.condition ?? ''] ?? '🌤️'

  return (
    <header className="sticky top-0 z-[60] bg-white border-b border-gray-100 shadow-sm">
      <div className="flex items-center justify-between h-16 px-4 max-w-7xl mx-auto">
        {/* Left: Hamburger + Logo */}
        <div className="flex items-center gap-3">
          {!isAuthRoute && (
            <button
              onClick={() => dispatch({ type: 'TOGGLE_SIDEBAR' })}
              className="p-2 rounded-xl text-gray-500 hover:bg-primary-50 hover:text-primary-700 transition-colors lg:hidden"
              aria-label="Toggle menu"
            >
              <Menu size={22} />
            </button>
          )}

          <div className="flex items-center gap-2 ml-8">
            <div className="w-9 h-9 bg-agri-gradient rounded-xl flex items-center justify-center text-lg shadow-md">
              🌾
            </div>
            <div className="hidden sm:block">
              <h1 className="text-base font-bold text-gray-900 leading-none">{t('chatTitle')}</h1>
              <p className="text-xs text-primary-600 font-medium">{t('appTagline')}</p>
            </div>
          </div>
        </div>

        {/* Right: Controls */}
        <div className="flex items-center gap-2">
          {/* Online indicator */}
          <div
            title={state.isOnline ? "You are connected to the internet" : "No internet connection"}
            className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium ${
              state.isOnline
                ? 'bg-primary-50 text-primary-700'
                : 'bg-red-50 text-red-600'
            }`}
          >
            {state.isOnline ? <Wifi size={12} /> : <WifiOff size={12} />}
            {state.isOnline ? 'Connected' : 'Offline'}
          </div>

          {/* Language selector — hidden on login/register */}
          {!isAuthRoute && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-50 rounded-xl text-sm font-medium text-primary-700 cursor-pointer hover:bg-primary-100 transition-colors">
              <Globe size={15} />
              <span className="hidden sm:inline">{state.selectedLanguage.flag} {state.selectedLanguage.englishName}</span>
              <span className="sm:hidden">{state.selectedLanguage.flag}</span>
            </div>
          )}

          {/* Auth: Sign In / User Avatar */}
          {authUser ? (
            <div className="flex items-center gap-1">
              <Link
                to="/profile"
                className="relative p-1.5 rounded-xl text-gray-500 hover:bg-primary-50 hover:text-primary-700 transition-colors"
                title={authUser.full_name || authUser.email}
              >
                <span className="w-8 h-8 bg-agri-gradient rounded-xl flex items-center justify-center text-sm font-bold text-white">
                  {(authUser.full_name || authUser.email).charAt(0).toUpperCase()}
                </span>
              </Link>
              <button
                onClick={handleLogout}
                className="p-2 rounded-xl text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                title="Sign out"
              >
                <LogOut size={18} />
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 text-white text-xs font-semibold rounded-xl hover:bg-primary-700 transition-colors"
            >
              <LogIn size={14} />
              <span className="hidden sm:inline">Sign In</span>
            </Link>
          )}

          {/* Notifications — only when signed in */}
          {authUser && (
            <div className="relative" ref={panelRef}>
              <button
                onClick={() => setNotifOpen((o) => !o)}
                className="relative p-2 rounded-xl text-gray-500 hover:bg-gray-100 transition-colors"
                title="Farming Notifications"
              >
                {notifLoading ? (
                  <RefreshCw size={20} className="animate-spin text-primary-500" />
                ) : (
                  <Bell size={20} />
                )}
                {/* Red dot: always shown when logged in */}
                {!notifLoading && (
                  <span className={`absolute top-1.5 right-1.5 w-2 h-2 rounded-full ${hasAlerts ? 'bg-red-500' : 'bg-primary-500'}`} />
                )}
              </button>

              {/* ── Notification dropdown panel ─────────────────────────────── */}
              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50">
                  {/* Header */}
                  <div className="flex items-center justify-between px-4 py-3 bg-primary-50 border-b border-primary-100">
                    <div className="flex items-center gap-2">
                      <Bell size={16} className="text-primary-600" />
                      <span className="text-sm font-semibold text-primary-800">Today's Farming Advice</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {/* Language badge */}
                      {langCode !== 'en' && (
                        <span className="text-[10px] bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full font-medium">
                          🔊 {state.selectedLanguage.englishName}
                        </span>
                      )}
                      <button
                        onClick={refreshWeather}
                        className="p-1 rounded-lg hover:bg-primary-100 text-primary-600 transition-colors"
                        title="Refresh"
                      >
                        <RefreshCw size={14} />
                      </button>
                      <button
                        onClick={() => setNotifOpen(false)}
                        className="p-1 rounded-lg hover:bg-primary-100 text-primary-600 transition-colors"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>

                  <div className="max-h-[28rem] overflow-y-auto">
                    {notifLoading ? (
                      <div className="py-10 text-center text-sm text-gray-400">
                        <RefreshCw size={22} className="animate-spin mx-auto mb-2 text-primary-400" />
                        Fetching weather...
                      </div>
                    ) : !current ? (
                      <div className="py-10 text-center text-sm text-gray-400">
                        <span className="text-2xl block mb-2">🌾</span>
                        Set your state in <Link to="/profile" onClick={() => setNotifOpen(false)} className="text-primary-600 underline">Profile</Link> to get local advice.
                      </div>
                    ) : (
                      <div className="p-4 space-y-3">
                        {/* Location + condition strip */}
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <span className="font-medium truncate">{weatherData?.location}</span>
                          <span>{current.date}</span>
                        </div>

                        {/* Temperature row */}
                        <div className="flex items-center gap-3 bg-gradient-to-r from-primary-50 to-emerald-50 rounded-xl px-4 py-3">
                          <span className="text-3xl">{emoji}</span>
                          <div className="flex-1">
                            <div className="text-xl font-bold text-gray-800">{current.temperature.current}°C</div>
                            <div className="text-xs text-gray-500 capitalize">
                              {current.condition.replace(/-/g, ' ')} · H:{current.humidity}% · 💧{current.rainfall}mm
                            </div>
                          </div>
                          {/* Read aloud: full weather summary */}
                          <SpeakerButton
                            id="weather-summary"
                            text={`Current weather in ${weatherData?.location}: ${current.temperature.current} degrees Celsius, ${current.condition.replace(/-/g, ' ')}, humidity ${current.humidity} percent, rainfall ${current.rainfall} millimetres.`}
                            langCode={langCode}
                            speakingId={speakingId}
                            setSpeakingState={setSpeakingState}
                          />
                        </div>

                        {/* Alerts */}
                        {current.alerts.length > 0 && (
                          <div className="space-y-1.5">
                            {current.alerts.map((alert, i) => (
                              <div
                                key={i}
                                className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-xs ${SEVERITY_COLORS[alert.severity] ?? SEVERITY_COLORS.low}`}
                              >
                                <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                                <span className="flex-1">{alert.message}</span>
                                <SpeakerButton
                                  id={`alert-${i}`}
                                  text={alert.message}
                                  langCode={langCode}
                                  speakingId={speakingId}
                                  setSpeakingState={setSpeakingState}
                                />
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Farming advice */}
                        <div className="bg-green-50 border border-green-200 rounded-xl px-3 py-2.5">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-1.5 text-green-700 text-xs font-semibold">
                              <Leaf size={12} />
                              Farming Advice
                            </div>
                            <SpeakerButton
                              id="farming-advice"
                              text={current.farming_advice}
                              langCode={langCode}
                              speakingId={speakingId}
                              setSpeakingState={setSpeakingState}
                            />
                          </div>
                          <p className="text-xs text-green-800 leading-relaxed">{current.farming_advice}</p>
                        </div>

                        {/* Agricultural insights */}
                        {(weatherData?.agricultural_insights?.length ?? 0) > 0 && (
                          <div className="space-y-1">
                            <div className="text-xs font-semibold text-gray-600 mb-1">Agricultural Insights</div>
                            {weatherData!.agricultural_insights.map((insight, i) => (
                              <div key={i} className="flex items-start gap-1.5 text-xs text-gray-600 group">
                                <span className="text-primary-500 mt-0.5 shrink-0">•</span>
                                <span className="flex-1">{insight}</span>
                                <SpeakerButton
                                  id={`insight-${i}`}
                                  text={insight}
                                  langCode={langCode}
                                  speakingId={speakingId}
                                  setSpeakingState={setSpeakingState}
                                />
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Read-all button */}
                        <button
                          className="w-full flex items-center justify-center gap-2 py-2 text-xs font-medium text-primary-700 bg-primary-50 hover:bg-primary-100 rounded-xl transition-colors border border-primary-100"
                          onClick={async () => {
                            // If currently reading all, stop
                            if (speakingId === 'read-all') {
                              window.speechSynthesis.cancel()
                              setSpeakingState(null)
                              return
                            }
                            window.speechSynthesis.cancel()
                            setSpeakingState(null)
                            const allText = [
                              `Weather update for ${weatherData?.location}: ${current.temperature.current} degrees, ${current.condition.replace(/-/g, ' ')}.`,
                              ...current.alerts.map(a => a.message),
                              `Farming advice: ${current.farming_advice}`,
                              ...(weatherData?.agricultural_insights ?? []),
                            ].join(' ')

                            let finalText = allText
                            if (langCode !== 'en') {
                              setSpeakingState('read-all__loading')
                              try {
                                const res = await translateText({
                                  text: allText,
                                  source_language: 'en',
                                  target_language: langCode,
                                  domain: 'agriculture',
                                })
                                finalText = res.translated_text
                              } catch {
                                toast.error('Translation unavailable, reading in English')
                              }
                            }
                            setSpeakingState('read-all')
                            const utterance = new SpeechSynthesisUtterance(finalText)
                            utterance.lang = SPEECH_LANG[langCode] ?? 'en-IN'
                            utterance.rate = 0.9
                            utterance.onend = () => setSpeakingState(null)
                            utterance.onerror = () => setSpeakingState(null)
                            window.speechSynthesis.speak(utterance)
                          }}
                        >
                          {speakingId === 'read-all' ? (
                            <><VolumeX size={13} className="text-primary-600" /> Stop reading</>
                          ) : speakingId === 'read-all__loading' ? (
                            <><Loader2 size={13} className="animate-spin" /> Translating...</>
                          ) : (
                            <><Volume2 size={13} /> Read all aloud {langCode !== 'en' ? `in ${state.selectedLanguage.englishName}` : ''}</>
                          )}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Footer link */}
                  {current && (
                    <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50">
                      <Link
                        to="/weather"
                        onClick={() => setNotifOpen(false)}
                        className="text-xs text-primary-600 font-medium hover:underline"
                      >
                        View full 7-day forecast →
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

import { useState, useEffect } from 'react'
import { MapPin, RefreshCw, Thermometer, Droplets, Wind, Eye } from 'lucide-react'
import { getWeatherForecast, getWeatherByCoords } from '@/services/api'
import type { WeatherForecast, WeatherData } from '@/services/api'
import LoadingSpinner from '@/components/LoadingSpinner'
import { WEATHER_ICONS, MARKET_STATES } from '@/utils/constants'
import { useAppContext } from '@/context/AppContext'
import toast from 'react-hot-toast'

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function dayName(dateStr: string) {
  const d = new Date(dateStr)
  return DAY_NAMES[d.getDay()]
}

/** Generate location-aware fallback demo weather (used when API is unreachable) */
function makeDemoWeather(location: string): WeatherForecast {
  const today = new Date()
  const makeDay = (offsetDays: number): WeatherData => {
    const d = new Date(today)
    d.setDate(d.getDate() + offsetDays)
    return {
      location,
      date: d.toISOString().slice(0, 10),
      temperature: { min: 18 + offsetDays, max: 32 + offsetDays, current: 26 },
      humidity: 65,
      rainfall: offsetDays >= 3 ? 10 : 0,
      wind_speed: 12,
      condition: offsetDays >= 3 ? 'rain' : offsetDays >= 1 ? 'partly-cloudy' : 'clear',
      farming_advice: 'Good conditions for field work.',
      alerts: [],
    }
  }
  return {
    location,
    current: { ...makeDay(0), condition: 'partly-cloudy', alerts: [{ type: 'info', message: 'Light rain expected in 3 days. Complete harvesting before then.', severity: 'low' }] },
    forecast: [1, 2, 3, 4, 5, 6].map(makeDay),
    agricultural_insights: [
      'Soil moisture is adequate — delay irrigation by 2-3 days',
      'Monitor crops for pest activity after recent weather changes',
      'Good spray window available for next 2 days — apply early morning',
    ],
  }
}

export default function Weather() {
  const { state, t } = useAppContext()
  const profile = state.userProfile

  // Derive initial location from profile state if available
  const defaultLocation = profile?.state ? `${profile.state}, India` : 'Pune, Maharashtra'

  const [weather, setWeather] = useState<WeatherForecast | null>(null)
  const [loading, setLoading] = useState(false)
  const [location, setLocation] = useState(defaultLocation)
  const [selectedDay, setSelectedDay] = useState<WeatherData | null>(null)
  const [gpsLoading, setGpsLoading] = useState(false)

  const fetchWeather = async (loc?: string) => {
    const target = loc || location
    setLoading(true)
    setSelectedDay(null)
    try {
      const data = await getWeatherForecast(target, state.selectedLanguage.code)
      setWeather(data)
    } catch (_) {
      // Use location-aware demo data instead of hardcoded Pune fallback
      setWeather(makeDemoWeather(target))
      toast('Using estimated weather data', { icon: 'ℹ️' })
    } finally {
      setLoading(false)
    }
  }

  // Fetch on initial mount
  useEffect(() => {
    fetchWeather(defaultLocation)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-refetch when profile state changes (after initial mount)
  useEffect(() => {
    if (profile?.state) {
      const loc = `${profile.state}, India`
      setLocation(loc)
      fetchWeather(loc)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.state])

  const getLocationByGPS = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation not supported')
      return
    }
    setGpsLoading(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const data = await getWeatherByCoords(pos.coords.latitude, pos.coords.longitude, state.selectedLanguage.code)
          setWeather(data)
          setLocation(data.location)
        } catch (_) {
          toast('Using demo weather data', { icon: 'ℹ️' })
        } finally {
          setGpsLoading(false)
        }
      },
      () => {
        toast.error('Could not get location. Please allow location access.')
        setGpsLoading(false)
      }
    )
  }

  const displayDay = selectedDay || weather?.current
  const alertColor = (severity: string) =>
    severity === 'high' ? 'bg-red-50 border-red-200 text-red-700' :
    severity === 'medium' ? 'bg-orange-50 border-orange-200 text-orange-700' :
    'bg-yellow-50 border-yellow-200 text-yellow-700'

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="section-title flex items-center gap-2">
          <span>⛅</span> {t('weatherTitle')}
        </h1>
        <p className="section-subtitle">{t('weatherSubtitle')}</p>
      </div>

      {/* Location Input */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <MapPin size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <select
            className="input-field pl-10"
            value={MARKET_STATES.find((s) => location.includes(s)) || ''}
            onChange={(e) => {
              const loc = e.target.value + ', India'
              setLocation(loc)
              fetchWeather(loc)
            }}
          >
            <option value="">{t('selectLocation')}</option>
            {MARKET_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <button
          onClick={getLocationByGPS}
          disabled={gpsLoading}
          className="flex-shrink-0 p-3 bg-sky-100 hover:bg-sky-200 text-sky-700 rounded-xl transition-colors"
          title="Use GPS location"
        >
          {gpsLoading ? <RefreshCw size={18} className="animate-spin" /> : <MapPin size={18} />}
        </button>
        <button
          onClick={() => fetchWeather()}
          disabled={loading}
          className="flex-shrink-0 p-3 bg-primary-100 hover:bg-primary-200 text-primary-700 rounded-xl transition-colors"
          title={t('refresh')}
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {loading && !weather && (
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" text={t('loadingWeather')} />
        </div>
      )}

      {weather && (
        <>
          {/* Current Weather Card */}
          <div className="relative overflow-hidden rounded-3xl p-6 text-white bg-gradient-to-br from-sky-500 to-blue-700 shadow-xl">
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 80% 20%, white 0%, transparent 60%)' }} />
            <div className="relative">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-1.5 text-sky-200 text-sm mb-1">
                    <MapPin size={14} />
                    {weather.location}
                  </div>
                  <div className="text-6xl font-bold leading-none">
                    {displayDay?.temperature.current}°C
                  </div>
                  <div className="text-sky-200 text-sm mt-1">
                    {displayDay?.temperature.min}° / {displayDay?.temperature.max}°
                  </div>
                </div>
                <div className="text-7xl">
                  {WEATHER_ICONS[displayDay?.condition || 'clear'] || '☀️'}
                </div>
              </div>

              <div className="grid grid-cols-4 gap-3 mt-4 pt-4 border-t border-white/20">
                {[
                  { icon: <Droplets size={14} />, label: t('humidity'), value: `${displayDay?.humidity}%` },
                  { icon: <Wind size={14} />, label: t('wind'), value: `${displayDay?.wind_speed}km/h` },
                  { icon: <Eye size={14} />, label: t('rain'), value: `${displayDay?.rainfall}mm` },
                  { icon: <Thermometer size={14} />, label: t('feels'), value: `${((displayDay?.temperature.current ?? 0) + 2)}°` },
                ].map((item) => (
                  <div key={item.label} className="text-center">
                    <div className="flex justify-center text-sky-300 mb-1">{item.icon}</div>
                    <div className="font-semibold text-sm">{item.value}</div>
                    <div className="text-sky-300 text-[10px]">{item.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Alerts */}
          {displayDay?.alerts.map((alert, i) => (
            <div key={i} className={`flex gap-3 p-4 rounded-2xl border ${alertColor(alert.severity)}`}>
              <span className="text-xl flex-shrink-0">
                {alert.severity === 'high' ? '🚨' : alert.severity === 'medium' ? '⚠️' : '💡'}
              </span>
              <p className="text-sm font-medium">{alert.message}</p>
            </div>
          ))}

          {/* Farming Advice */}
          {displayDay?.farming_advice && (
            <div className="card bg-primary-50 border border-primary-200">
              <div className="flex gap-3">
                <span className="text-2xl">🌾</span>
                <div>
                  <h3 className="font-semibold text-primary-800 text-sm mb-1">{t('farmingAdvice')}</h3>
                  <p className="text-sm text-primary-700">{displayDay.farming_advice}</p>
                </div>
              </div>
            </div>
          )}

          {/* 7-Day Forecast */}
          <section>
            <h2 className="section-title text-lg">{t('forecast7day')}</h2>
            <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2">
              {[weather.current, ...weather.forecast].map((day, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedDay(day === selectedDay ? null : day)}
                  className={`flex-shrink-0 flex flex-col items-center gap-2 p-3 rounded-2xl min-w-[80px]
                    border-2 transition-all ${
                    day === displayDay
                      ? 'bg-sky-500 text-white border-sky-500 shadow-md'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-sky-300'
                  }`}
                >
                  <span className="text-xs font-semibold">{i === 0 ? t('today') : dayName(day.date)}</span>
                  <span className="text-2xl">{WEATHER_ICONS[day.condition] || '☀️'}</span>
                  <div className="text-center">
                    <div className="text-sm font-bold">{day.temperature.max}°</div>
                    <div className={`text-xs ${day === displayDay ? 'text-sky-200' : 'text-gray-400'}`}>
                      {day.temperature.min}°
                    </div>
                  </div>
                  {day.rainfall > 0 && (
                    <span className={`text-[10px] font-medium ${day === displayDay ? 'text-sky-100' : 'text-sky-600'}`}>
                      💧{day.rainfall}mm
                    </span>
                  )}
                </button>
              ))}
            </div>
          </section>

          {/* Agricultural Insights */}
          <section className="card bg-gradient-to-br from-earth-50 to-primary-50 border border-earth-100">
            <h2 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
              🌿 {t('agriInsights')}
            </h2>
            <ul className="space-y-2">
              {weather.agricultural_insights.map((insight, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-primary-800">
                  <span className="text-primary-500 flex-shrink-0 mt-0.5">✦</span>
                  {insight}
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  )
}

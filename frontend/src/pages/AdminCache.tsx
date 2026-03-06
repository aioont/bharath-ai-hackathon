import { useState, useEffect, useCallback } from 'react'
import axios from 'axios'
import { API_BASE_URL } from '@/utils/constants'
import {
  Zap,
  RefreshCw,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  TrendingUp,
  MemoryStick,
  Users,
  Terminal,
} from 'lucide-react'

const adminApi = axios.create({ baseURL: API_BASE_URL })

interface CacheStats {
  available: boolean
  message?: string
  tip?: string
  performance?: {
    hit_rate: string
    cache_hits: number
    cache_misses: number
  }
  resources?: {
    memory_used: string
    connected_clients: number
    total_commands: number
  }
  recommendations?: string[]
}

interface CacheHealth {
  cache_enabled: boolean
  status: string
  fallback: string | null
}

const CLEAR_PATTERNS = [
  { label: 'All Cache', pattern: '*', color: 'red' },
  { label: 'Weather Cache', pattern: 'weather:*', color: 'blue' },
  { label: 'Translation Cache', pattern: 'translate:*', color: 'purple' },
  { label: 'KB / AI Cache', pattern: 'bedrock_kb:*', color: 'orange' },
]

export default function AdminCache() {
  const [stats, setStats] = useState<CacheStats | null>(null)
  const [health, setHealth] = useState<CacheHealth | null>(null)
  const [loading, setLoading] = useState(false)
  const [clearing, setClearing] = useState<string | null>(null)
  const [clearResult, setClearResult] = useState<{ pattern: string; count: number } | null>(null)
  const [error, setError] = useState('')

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [statsRes, healthRes] = await Promise.all([
        adminApi.get('/api/admin/cache/stats'),
        adminApi.get('/api/admin/cache/health'),
      ])
      setStats(statsRes.data)
      setHealth(healthRes.data)
    } catch (err: any) {
      setError(err?.response?.data?.detail || err.message || 'Failed to fetch cache data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const handleClear = async (pattern: string) => {
    if (!confirm(`Clear all cache entries matching "${pattern}"? This cannot be undone.`)) return
    setClearing(pattern)
    setClearResult(null)
    try {
      const res = await adminApi.post(`/api/admin/cache/clear?pattern=${encodeURIComponent(pattern)}`)
      setClearResult({ pattern, count: res.data.keys_deleted ?? 0 })
    } catch (err: any) {
      setError(err?.response?.data?.detail || err.message || 'Failed to clear cache')
    } finally {
      setClearing(null)
    }
  }

  const hitRateNum = stats?.performance
    ? parseFloat(stats.performance.hit_rate)
    : null

  const hitRateColor =
    hitRateNum === null ? 'gray'
    : hitRateNum >= 70 ? 'green'
    : hitRateNum >= 40 ? 'yellow'
    : 'red'

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Zap className="text-yellow-500" size={24} />
            Cache Statistics
          </h1>
          <p className="text-sm text-gray-500 mt-1">Redis / ElastiCache performance overview</p>
        </div>
        <button
          onClick={fetchAll}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-2 text-red-700 text-sm">
          <XCircle size={16} />
          {error}
        </div>
      )}

      {clearResult && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-2 text-green-700 text-sm">
          <CheckCircle2 size={16} />
          Cleared <strong>{clearResult.count}</strong> entries matching <code className="bg-green-100 px-1 rounded">{clearResult.pattern}</code>
        </div>
      )}

      {/* Health Status */}
      {health && (
        <div className={`rounded-xl p-4 border flex items-center gap-4 ${
          health.cache_enabled
            ? 'bg-green-50 border-green-200'
            : 'bg-yellow-50 border-yellow-200'
        }`}>
          {health.cache_enabled ? (
            <CheckCircle2 size={28} className="text-green-500 flex-shrink-0" />
          ) : (
            <AlertTriangle size={28} className="text-yellow-500 flex-shrink-0" />
          )}
          <div>
            <p className={`font-semibold ${health.cache_enabled ? 'text-green-800' : 'text-yellow-800'}`}>
              Cache is {health.status}
            </p>
            {health.fallback && (
              <p className="text-xs text-yellow-700 mt-0.5">Fallback: {health.fallback}</p>
            )}
          </div>
        </div>
      )}

      {!stats?.available ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
          <Zap size={40} className="mx-auto mb-3 text-gray-300" />
          <p className="font-medium">{stats?.message ?? 'Cache not available'}</p>
          {stats?.tip && <p className="text-xs mt-2 text-gray-400">{stats.tip}</p>}
        </div>
      ) : (
        <>
          {/* Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Hit Rate */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp size={18} className={`text-${hitRateColor}-500`} />
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Hit Rate</span>
              </div>
              <p className={`text-3xl font-bold text-${hitRateColor}-600`}>
                {stats.performance?.hit_rate ?? '—'}
              </p>
              <p className="text-xs text-gray-400 mt-1">Target: &gt;60%</p>
            </div>

            {/* Hits */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 size={18} className="text-green-500" />
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Cache Hits</span>
              </div>
              <p className="text-3xl font-bold text-green-600">
                {stats.performance?.cache_hits?.toLocaleString() ?? '—'}
              </p>
              <p className="text-xs text-gray-400 mt-1">Served from cache</p>
            </div>

            {/* Misses */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <XCircle size={18} className="text-red-400" />
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Cache Misses</span>
              </div>
              <p className="text-3xl font-bold text-red-500">
                {stats.performance?.cache_misses?.toLocaleString() ?? '—'}
              </p>
              <p className="text-xs text-gray-400 mt-1">Fetched from origin</p>
            </div>

            {/* Memory */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <MemoryStick size={18} className="text-indigo-500" />
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Memory Used</span>
              </div>
              <p className="text-3xl font-bold text-indigo-600">
                {stats.resources?.memory_used ?? '—'}
              </p>
              <p className="text-xs text-gray-400 mt-1">Redis heap</p>
            </div>
          </div>

          {/* Secondary stats row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm flex items-center gap-4">
              <Users size={28} className="text-blue-400 flex-shrink-0" />
              <div>
                <p className="text-2xl font-bold text-gray-800">
                  {stats.resources?.connected_clients ?? '—'}
                </p>
                <p className="text-xs text-gray-500">Connected Clients</p>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm flex items-center gap-4">
              <Terminal size={28} className="text-purple-400 flex-shrink-0" />
              <div>
                <p className="text-2xl font-bold text-gray-800">
                  {stats.resources?.total_commands?.toLocaleString() ?? '—'}
                </p>
                <p className="text-xs text-gray-500">Total Commands Processed</p>
              </div>
            </div>
          </div>

          {/* Recommendations */}
          {stats.recommendations && stats.recommendations.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <AlertTriangle size={16} className="text-yellow-500" /> Recommendations
              </h3>
              <ul className="space-y-2">
                {stats.recommendations.map((rec, i) => (
                  <li key={i} className="text-sm text-gray-700 bg-gray-50 rounded-lg px-4 py-2">
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {/* Cache Clear Controls */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <h3 className="font-semibold text-gray-800 mb-1 flex items-center gap-2">
          <Trash2 size={16} className="text-red-500" /> Clear Cache
        </h3>
        <p className="text-xs text-gray-400 mb-4">Force fresh data by invalidating specific cache namespaces.</p>
        <div className="flex flex-wrap gap-3">
          {CLEAR_PATTERNS.map(({ label, pattern, color }) => (
            <button
              key={pattern}
              onClick={() => handleClear(pattern)}
              disabled={!!clearing}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-all disabled:opacity-50 ${
                color === 'red'
                  ? 'border-red-200 text-red-600 hover:bg-red-50'
                  : color === 'blue'
                  ? 'border-blue-200 text-blue-600 hover:bg-blue-50'
                  : color === 'purple'
                  ? 'border-purple-200 text-purple-600 hover:bg-purple-50'
                  : 'border-orange-200 text-orange-600 hover:bg-orange-50'
              }`}
            >
              {clearing === pattern ? (
                <RefreshCw size={13} className="animate-spin" />
              ) : (
                <Trash2 size={13} />
              )}
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

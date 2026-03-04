import { useState, useEffect, useCallback } from 'react'
import { FlaskConical, Play, RefreshCw, CheckCircle, XCircle, Clock, ChevronDown, ChevronUp, Database, Trash2, Activity, TrendingUp } from 'lucide-react'
import api, { getCacheStats, clearCache, type CacheStats } from '@/services/api'
import toast from 'react-hot-toast'

// ── Types ────────────────────────────────────────────────────────────────────
interface MetricResult {
    llm_relevancy: number | null
    llm_reason: string
    keyword_overlap: number
    language_match: number
    guardrail_adherence: number
}

interface TestResult {
    id: string
    category: string
    language: string
    is_guardrail: boolean
    question: string
    response: string
    expected_summary: string
    metrics: MetricResult
    composite_score: number
    passed: boolean
    latency_ms: number
}

interface CategoryBreakdown {
    pass_rate: number
    avg_score: number
    total: number
    passed: number
}

interface EvalResult {
    status: string
    framework?: string
    total_cases?: number
    passed?: number
    failed?: number
    pass_rate?: number
    avg_composite_score?: number
    avg_latency_ms?: number
    guardrail_pass_rate?: number | null
    category_breakdown?: Record<string, CategoryBreakdown>
    test_results?: TestResult[]
    message?: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const scoreColor = (s: number) =>
    s >= 0.8 ? 'text-green-600' : s >= 0.6 ? 'text-amber-600' : 'text-red-500'

const scoreBg = (s: number) =>
    s >= 0.8 ? 'bg-green-50 border-green-200' : s >= 0.6 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'

const pct = (v: number) => `${Math.round(v * 100)}%`

const CATEGORY_ICONS: Record<string, string> = {
    general: '🌾', crop_doctor: '🩺', market: '📊', schemes: '🏛️', weather: '🌦️',
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function EvalDashboard() {
    const [result, setResult] = useState<EvalResult | null>(null)
    const [polling, setPolling] = useState(false)
    const [expanded, setExpanded] = useState<string | null>(null)
    const [useLlmJudge, setUseLlmJudge] = useState(true)
    const [cacheStats, setCacheStats] = useState<CacheStats | null>(null)
    const [cacheExpanded, setCacheExpanded] = useState(true)
    const [clearing, setClearing] = useState(false)

    const poll = useCallback(async () => {
        try {
            const resp = await api.get<EvalResult>('/api/eval/status')
            setResult(resp.data)
            if (resp.data.status === 'running') {
                setTimeout(poll, 3000)
            } else {
                setPolling(false)
            }
        } catch {
            setPolling(false)
        }
    }, [])

    const startEval = async () => {
        setPolling(true)
        setResult({ status: 'running', message: 'Starting evaluation…' })
        try {
            await api.post('/api/eval/run', { use_llm_judge: useLlmJudge, max_cases: 11 })
            setTimeout(poll, 2000)
        } catch (e) {
            setPolling(false)
            setResult({ status: 'error', message: 'Failed to start evaluation.' })
        }
    }

    // Load cache stats
    const loadCacheStats = useCallback(async () => {
        try {
            const stats = await getCacheStats()
            setCacheStats(stats)
        } catch (e) {
            console.warn('Cache stats unavailable:', e)
        }
    }, [])

    const handleClearCache = async (pattern = '*') => {
        if (!confirm(`Clear cache keys matching "${pattern}"? This cannot be undone.`)) return
        setClearing(true)
        try {
            const res = await clearCache(pattern)
            toast.success(`Cleared ${res.keys_deleted} cache keys`)
            await loadCacheStats()
        } catch (e) {
            toast.error('Failed to clear cache')
        } finally {
            setClearing(false)
        }
    }

    // Load last result on mount
    useEffect(() => { 
        poll()
        loadCacheStats()
        // Auto-refresh cache stats every 10 seconds
        const interval = setInterval(loadCacheStats, 10000)
        return () => clearInterval(interval)
    }, [poll, loadCacheStats])

    const isRunning = polling || result?.status === 'running'
    const testResults = result?.test_results ?? []

    return (
        <div className="max-w-4xl mx-auto p-4 space-y-6 animate-fade-in">
            {/* Cache Monitoring Section */}
            {cacheStats && (
                <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                    <button
                        onClick={() => setCacheExpanded(!cacheExpanded)}
                        className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors"
                    >
                        <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                            <Database size={20} className="text-blue-600" />
                        </div>
                        <div className="flex-1 text-left">
                            <h2 className="text-lg font-bold text-gray-800">Cache Performance</h2>
                            <p className="text-xs text-gray-500">
                                {cacheStats.available ? (
                                    <span className="flex items-center gap-1">
                                        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                                        ElastiCache Serverless (Valkey) Active
                                    </span>
                                ) : (
                                    <span className="text-amber-600">Cache Unavailable (Fallback Mode)</span>
                                )}
                            </p>
                        </div>
                        {cacheExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                    </button>

                    {cacheExpanded && cacheStats.available && (
                        <div className="px-4 pb-4 space-y-4">
                            {/* Cache stats cards */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {[
                                    {
                                        icon: <TrendingUp size={16} className="text-green-600" />,
                                        label: 'Hit Rate',
                                        value: cacheStats.performance?.hit_rate ?? 'N/A',
                                        sub: `${cacheStats.performance?.cache_hits ?? 0} hits / ${cacheStats.performance?.cache_misses ?? 0} misses`,
                                        color: parseFloat(cacheStats.performance?.hit_rate ?? '0') >= 60 ? 'text-green-600' : 'text-amber-600'
                                    },
                                    {
                                        icon: <Activity size={16} className="text-blue-600" />,
                                        label: 'Memory Used',
                                        value: cacheStats.memory?.used_memory ?? 'N/A',
                                        sub: `Peak: ${cacheStats.memory?.peak_memory ?? 'N/A'}`,
                                        color: 'text-blue-600'
                                    },
                                    {
                                        icon: <Database size={16} className="text-purple-600" />,
                                        label: 'Connections',
                                        value: cacheStats.clients?.connected_clients?.toString() ?? 'N/A',
                                        sub: 'active clients',
                                        color: 'text-purple-600'
                                    },
                                    {
                                        icon: <RefreshCw size={16} className="text-indigo-600" />,
                                        label: 'Total Commands',
                                        value: cacheStats.commands?.total_commands_processed?.toLocaleString() ?? 'N/A',
                                        sub: 'operations',
                                        color: 'text-indigo-600'
                                    },
                                ].map(c => (
                                    <div key={c.label} className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                                        <div className="flex items-center gap-2 mb-1">
                                            {c.icon}
                                            <div className="text-xs text-gray-500 uppercase tracking-wide">{c.label}</div>
                                        </div>
                                        <div className={`text-xl font-bold ${c.color}`}>{c.value}</div>
                                        <div className="text-xs text-gray-400 mt-0.5">{c.sub}</div>
                                    </div>
                                ))}
                            </div>

                            {/* Recommendations */}
                            {cacheStats.recommendations && cacheStats.recommendations.length > 0 && (
                                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                                    <h4 className="text-xs font-semibold text-amber-800 uppercase tracking-wide mb-2">Recommendations</h4>
                                    <ul className="space-y-1 text-xs text-amber-700">
                                        {cacheStats.recommendations.map((rec, i) => (
                                            <li key={i} className="flex items-start gap-1.5">
                                                <span className="text-amber-500 mt-0.5">•</span>
                                                <span>{rec}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Cache control buttons */}
                            <div className="flex flex-wrap gap-2">
                                {[
                                    { label: 'Clear All', pattern: '*', color: 'bg-red-600 hover:bg-red-700' },
                                    { label: 'Clear KB Cache', pattern: 'bedrock_kb:*', color: 'bg-orange-600 hover:bg-orange-700' },
                                    { label: 'Clear Translations', pattern: 'translate:*', color: 'bg-yellow-600 hover:bg-yellow-700' },
                                    { label: 'Clear Weather', pattern: 'weather:*', color: 'bg-blue-600 hover:bg-blue-700' },
                                ].map(btn => (
                                    <button
                                        key={btn.pattern}
                                        onClick={() => handleClearCache(btn.pattern)}
                                        disabled={clearing}
                                        className={`flex items-center gap-1.5 ${btn.color} text-white px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50 transition-colors shadow-sm`}
                                    >
                                        <Trash2 size={12} />
                                        {btn.label}
                                    </button>
                                ))}
                                <button
                                    onClick={loadCacheStats}
                                    className="flex items-center gap-1.5 bg-gray-600 hover:bg-gray-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors shadow-sm ml-auto"
                                >
                                    <RefreshCw size={12} />
                                    Refresh Stats
                                </button>
                            </div>

                            {/* Cost savings estimate */}
                            <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                                <h4 className="text-xs font-semibold text-green-800 uppercase tracking-wide mb-1">Cost Savings</h4>
                                <p className="text-xs text-green-700">
                                    With {cacheStats.performance?.hit_rate ?? '0%'} cache hit rate, you're saving approximately <strong>$470-680/month</strong> on OpenSearch and Bedrock API costs!
                                    Serverless Valkey cost: <strong>$9-28/month</strong> (pay-per-use).
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center">
                        <FlaskConical size={22} className="text-violet-600" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-gray-800">AgriAI Evaluation Dashboard</h1>
                        <p className="text-xs text-gray-500">Powered by <span className="font-mono bg-gray-100 px-1 rounded">DeepEval</span> + Sarvam-M judge</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={useLlmJudge}
                            onChange={e => setUseLlmJudge(e.target.checked)}
                            className="rounded"
                        />
                        AI Judge
                    </label>
                    <button
                        onClick={startEval}
                        disabled={isRunning}
                        className="flex items-center gap-2 bg-violet-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-violet-700 disabled:opacity-50 transition-colors shadow-sm"
                    >
                        {isRunning
                            ? <><RefreshCw size={14} className="animate-spin" /> Running…</>
                            : <><Play size={14} /> Run Evaluation</>
                        }
                    </button>
                </div>
            </div>

            {/* Running indicator */}
            {isRunning && (
                <div className="bg-violet-50 border border-violet-200 rounded-2xl p-4 flex items-center gap-3">
                    <RefreshCw size={18} className="text-violet-500 animate-spin" />
                    <div>
                        <p className="text-sm font-medium text-violet-800">Evaluation in progress…</p>
                        <p className="text-xs text-violet-600">Testing all 11 cases through Sarvam-M — this takes 30–90 seconds</p>
                    </div>
                </div>
            )}

            {/* Summary cards */}
            {result?.status === 'completed' && (
                <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                            { label: 'Pass Rate', value: pct(result.pass_rate ?? 0), sub: `${result.passed}/${result.total_cases} cases`, color: scoreColor(result.pass_rate ?? 0) },
                            { label: 'Avg Score', value: (result.avg_composite_score ?? 0).toFixed(3), sub: 'composite (0–1)', color: scoreColor(result.avg_composite_score ?? 0) },
                            { label: 'Avg Latency', value: `${result.avg_latency_ms}ms`, sub: 'per response', color: 'text-blue-600' },
                            { label: 'Guardrails', value: result.guardrail_pass_rate != null ? pct(result.guardrail_pass_rate) : 'N/A', sub: 'off-topic refusal', color: scoreColor(result.guardrail_pass_rate ?? 0) },
                        ].map(c => (
                            <div key={c.label} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                                <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">{c.label}</div>
                                <div className={`text-2xl font-bold ${c.color}`}>{c.value}</div>
                                <div className="text-xs text-gray-400 mt-0.5">{c.sub}</div>
                            </div>
                        ))}
                    </div>

                    {/* Category breakdown */}
                    {result.category_breakdown && (
                        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                            <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">Category Breakdown</h3>
                            <div className="space-y-2">
                                {Object.entries(result.category_breakdown).map(([cat, data]) => (
                                    <div key={cat} className="flex items-center gap-3">
                                        <span className="text-lg w-6">{CATEGORY_ICONS[cat] ?? '📋'}</span>
                                        <span className="text-sm font-medium text-gray-700 w-28 capitalize">{cat.replace('_', ' ')}</span>
                                        <div className="flex-1 bg-gray-100 rounded-full h-2 relative overflow-hidden">
                                            <div
                                                className={`h-2 rounded-full transition-all ${data.avg_score >= 0.8 ? 'bg-green-500' : data.avg_score >= 0.6 ? 'bg-amber-400' : 'bg-red-400'}`}
                                                style={{ width: `${Math.round(data.avg_score * 100)}%` }}
                                            />
                                        </div>
                                        <span className={`text-sm font-semibold w-10 text-right ${scoreColor(data.avg_score)}`}>
                                            {pct(data.avg_score)}
                                        </span>
                                        <span className="text-xs text-gray-400 w-16 text-right">{data.passed}/{data.total} passed</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Metrics legend */}
                    <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 flex flex-wrap gap-3 text-xs text-gray-500">
                        <span><span className="font-semibold text-violet-600">LLM Relevancy</span> — Sarvam-M judge (0-1)</span>
                        <span>•</span>
                        <span><span className="font-semibold text-blue-600">Keyword Overlap</span> — expected vs response</span>
                        <span>•</span>
                        <span><span className="font-semibold text-green-600">Language Match</span> — script consistency</span>
                        <span>•</span>
                        <span><span className="font-semibold text-amber-600">Guardrail</span> — off-topic refusal accuracy</span>
                    </div>

                    {/* Test result rows */}
                    <div className="space-y-2">
                        <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Detailed Results</h3>
                        {testResults.map(tr => (
                            <div key={tr.id} className={`border rounded-2xl overflow-hidden ${scoreBg(tr.composite_score)}`}>
                                <button
                                    onClick={() => setExpanded(prev => prev === tr.id ? null : tr.id)}
                                    className="w-full flex items-center gap-3 p-3 text-left hover:opacity-80 transition-opacity"
                                >
                                    {tr.passed
                                        ? <CheckCircle size={16} className="text-green-500 flex-shrink-0" />
                                        : <XCircle size={16} className="text-red-500 flex-shrink-0" />
                                    }
                                    <span className="text-base w-5">{CATEGORY_ICONS[tr.category] ?? '📋'}</span>
                                    <span className="flex-1 text-sm font-medium text-gray-800 truncate">{tr.question}</span>
                                    <div className="flex items-center gap-3 flex-shrink-0">
                                        {tr.is_guardrail && (
                                            <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full">Guardrail</span>
                                        )}
                                        <span className={`text-sm font-bold ${scoreColor(tr.composite_score)}`}>
                                            {pct(tr.composite_score)}
                                        </span>
                                        <span className="text-xs text-gray-400 flex items-center gap-0.5">
                                            <Clock size={10} />{tr.latency_ms}ms
                                        </span>
                                        {expanded === tr.id ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                                    </div>
                                </button>

                                {expanded === tr.id && (
                                    <div className="px-4 pb-4 pt-0 space-y-3 border-t border-gray-200 bg-white/70">
                                        {/* Metric bars */}
                                        <div className="grid grid-cols-2 gap-2 text-xs mt-3">
                                            {[
                                                { k: 'LLM Relevancy', v: tr.metrics.llm_relevancy },
                                                { k: 'Keyword Overlap', v: tr.metrics.keyword_overlap },
                                                { k: 'Language Match', v: tr.metrics.language_match },
                                                { k: 'Guardrail', v: tr.metrics.guardrail_adherence },
                                            ].map(m => (
                                                <div key={m.k} className="space-y-0.5">
                                                    <div className="flex justify-between text-gray-500">
                                                        <span>{m.k}</span>
                                                        <span className={`font-semibold ${scoreColor(m.v ?? 0)}`}>
                                                            {m.v != null ? pct(m.v) : 'N/A'}
                                                        </span>
                                                    </div>
                                                    <div className="w-full bg-gray-100 rounded-full h-1">
                                                        <div
                                                            className={`h-1 rounded-full ${(m.v ?? 0) >= 0.8 ? 'bg-green-500' : (m.v ?? 0) >= 0.6 ? 'bg-amber-400' : 'bg-red-400'}`}
                                                            style={{ width: `${Math.round((m.v ?? 0) * 100)}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        {tr.metrics.llm_reason && (
                                            <p className="text-xs text-gray-500 italic">💬 Judge: {tr.metrics.llm_reason}</p>
                                        )}

                                        <div className="grid md:grid-cols-2 gap-3 text-xs">
                                            <div>
                                                <p className="font-semibold text-gray-500 mb-1">AI Response</p>
                                                <p className="text-gray-700 leading-relaxed bg-gray-50 rounded-lg p-2 max-h-28 overflow-y-auto">{tr.response}</p>
                                            </div>
                                            <div>
                                                <p className="font-semibold text-gray-500 mb-1">Expected</p>
                                                <p className="text-gray-600 leading-relaxed bg-gray-50 rounded-lg p-2 max-h-28 overflow-y-auto">{tr.expected_summary}</p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </>
            )}

            {/* Idle state */}
            {(!result || result.status === 'idle') && !isRunning && (
                <div className="text-center py-16 text-gray-400">
                    <FlaskConical size={48} className="mx-auto mb-3 opacity-30" />
                    <p className="text-sm">Click <strong>Run Evaluation</strong> to test AgriAI across all categories</p>
                    <p className="text-xs mt-1">11 test cases • 4 metrics • Sarvam-M as judge</p>
                </div>
            )}
        </div>
    )
}

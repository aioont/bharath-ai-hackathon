import { useState, useEffect } from 'react'
import { Shield, Sparkles, ChevronDown, ChevronUp, ExternalLink, RefreshCw, Volume2, VolumeX } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import AudioPlayer from '@/components/AudioPlayer'
import { useAppContext, type FarmerCrop } from '@/context/AppContext'
import api, { getCrops } from '@/services/api'

// ── Types ──────────────────────────────────────────────────────────────────
interface Scheme {
    id: string
    name: string
    state: string
    ministry?: string
    description?: string
    eligibility?: string[]
    benefits?: string[]
    official_url?: string
}

interface InsuranceResult {
    recommendation: string
    top_schemes: Scheme[]
    sources: { content: string; uri: string }[]
    used_bedrock_kb: boolean
    audio_base64?: string
    audio_format?: string
    language: string
}

// ── Data ────────────────────────────────────────────────────────────────────
const FARMING_TYPES = ['Irrigated', 'Rain-fed', 'Drip Irrigation', 'Organic', 'Mixed']
const INCOME_LEVELS = ['BPL (Below Poverty Line)', 'Marginal (<1 acre)', 'Small (1-5 acres)', 'Medium (5-10 acres)', 'Large (>10 acres)']
const CATEGORIES = ['General', 'SC (Scheduled Caste)', 'ST (Scheduled Tribe)', 'OBC', 'Minority']
const STATES = [
    'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat',
    'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh',
    'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
    'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh',
    'Uttarakhand', 'West Bengal',
]

// ── Component ────────────────────────────────────────────────────────────────
export default function InsuranceSuggestion() {
    const { state, t } = useAppContext()
    const profile = state.userProfile
    const authUser = state.authUser
    const lang = state.selectedLanguage.code || 'en'

    // Map stored farmingType values to form display values
    const farmingTypeMap: Record<string, string> = {
        organic: 'Organic',
        mixed: 'Mixed',
        conventional: '',
        rainfed: 'Rain-fed',
        drip: 'Drip Irrigation',
        canal: 'Irrigated',
        sprinkler: 'Irrigated',
        borewell: 'Irrigated',
    }

    // Form state — pre-fill from profile + authUser
    const [form, setForm] = useState({
        name: profile?.name || authUser?.full_name || '',
        age: '',
        gender: '',
        state: profile?.state || authUser?.state || '',
        district: profile?.district || authUser?.district || '',
        occupation: 'Farmer',
        land_acres: '',
        crop: '',
        farming_type: farmingTypeMap[profile?.farmingType || authUser?.farming_type || ''] || '',
        income_level: '',
        category: 'General',
    })

    const [loading, setLoading] = useState(false)
    const [result, setResult] = useState<InsuranceResult | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [expanded, setExpanded] = useState<string | null>(null)
    const [autoSpeak, setAutoSpeak] = useState(false)
    const [myCrops, setMyCrops] = useState<FarmerCrop[]>([])

    useEffect(() => {
        getCrops().then(setMyCrops).catch(() => {})
    }, [])

    // Update form when profile/authUser loads (e.g. after hydration)
    useEffect(() => {
        setForm(prev => ({
            ...prev,
            name: profile?.name || authUser?.full_name || prev.name,
            state: profile?.state || authUser?.state || prev.state,
            district: profile?.district || authUser?.district || prev.district,
            farming_type: farmingTypeMap[profile?.farmingType || authUser?.farming_type || ''] || prev.farming_type,
        }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [profile, authUser])

    // Auto-select primary crop from myCrops when they load
    useEffect(() => {
        if (myCrops.length === 0) return
        const primary = myCrops.find(c => c.is_primary) ?? myCrops[0]
        const irrigationMap: Record<string, string> = {
            rainfed: 'Rain-fed', drip: 'Drip Irrigation',
            canal: 'Irrigated', sprinkler: 'Irrigated', borewell: 'Irrigated',
        }
        setForm(prev => ({
            ...prev,
            crop: prev.crop || primary.crop_name,
            land_acres: prev.land_acres || (primary.area_acres ? String(primary.area_acres) : ''),
            farming_type: prev.farming_type || (primary.irrigation ? irrigationMap[primary.irrigation] ?? '' : ''),
        }))
    }, [myCrops])

    const set = (k: string, v: string) => setForm(prev => ({ ...prev, [k]: v }))

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setResult(null)
        setError(null)
        try {
            const resp = await api.post<InsuranceResult>('/api/insurance/suggest', {
                ...form,
                age: form.age ? parseInt(form.age) : undefined,
                land_acres: form.land_acres ? parseFloat(form.land_acres) : undefined,
                language: lang,
                tts_enabled: autoSpeak,
            }, { timeout: 90000 })
            setResult(resp.data)
        } catch (err: unknown) {
            const msg = (err as { code?: string; response?: { data?: { detail?: string } } })?.code === 'ECONNABORTED'
                ? 'Request timed out. The AI analysis is taking longer than expected — please try again.'
                : ((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Something went wrong. Please try again.')
            setError(msg)
        } finally { setLoading(false) }
    }

    return (
        <div className="max-w-3xl mx-auto p-4 space-y-8 animate-fade-in pb-20">
            {/* Hero Section */}
            <div className="bg-gradient-to-br from-teal-600 to-emerald-800 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center text-4xl shadow-inner border border-white/30">
                            🛡️
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight">{t('insuranceTitle')}</h1>
                            <p className="text-teal-100 text-sm mt-1 max-w-md">
                                {t('govtSchemesAI')}
                            </p>
                        </div>
                    </div>
                     <button
                        onClick={() => setAutoSpeak(p => !p)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold backdrop-blur-md transition-all border ${
                            autoSpeak 
                            ? 'bg-white/20 border-white/40 text-white shadow-lg' 
                            : 'bg-black/20 border-white/10 text-white/70 hover:bg-black/30'
                        }`}
                    >
                        {autoSpeak ? <Volume2 size={16} className="animate-pulse" /> : <VolumeX size={16} />}
                        {autoSpeak ? 'Voice Feedback ON' : t('enableVoice')}
                    </button>
                </div>
            </div>

            {/* Error banner */}
            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm flex items-start gap-2">
                    <span className="text-lg leading-none">⚠️</span>
                    <span>{error}</span>
                </div>
            )}

            {/* Form */}
            {!result && (
                <form onSubmit={handleSubmit} className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm space-y-6 relative overflow-visible">
                    <div className="absolute -top-3 left-6 px-3 py-1 bg-teal-50 text-teal-700 text-xs font-bold uppercase tracking-wider rounded border border-teal-100 shadow-sm">
                        {t('enterDetails')}
                    </div>
                    
                    <p className="text-sm text-gray-400 bg-teal-50 rounded-xl px-4 py-3 border border-teal-100 flex items-center gap-2">
                        <span className="text-xl">💡</span> {t('prefillNote')}
                    </p>

                    <div className="grid md:grid-cols-2 gap-6">
                        {/* 1. Basic Info Section */}
                        <div className="bg-sky-50 rounded-xl p-4 border border-sky-100 relative group hover:border-sky-300 transition-colors">
                            <h3 className="text-xs font-bold text-sky-700 uppercase tracking-wide mb-4 flex items-center gap-2">
                                <span className="bg-sky-200 text-sky-800 rounded px-1.5 py-0.5">{t('step1')}</span> {t('personalDetails')}
                            </h3>
                            <div className="space-y-3">
                                {[
                                    { key: 'name', label: t('fullName'), placeholder: 'e.g. Ramesh Kumar', type: 'text' },
                                    { key: 'age', label: t('ageLabel'), placeholder: 'e.g. 42', type: 'number' },
                                ].map(f => (
                                    <div key={f.key}>
                                        <label className="text-xs font-medium text-gray-500 block mb-1">{f.label}</label>
                                        <input
                                            type={f.type} placeholder={f.placeholder}
                                            value={form[f.key as keyof typeof form]}
                                            onChange={e => set(f.key, e.target.value)}
                                            className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                                        />
                                    </div>
                                ))}
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs font-medium text-gray-500 block mb-1">{t('genderLabel')}</label>
                                        <select value={form.gender} onChange={e => set('gender', e.target.value)}
                                            className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500">
                                            <option value="">Select</option>
                                            {['Male', 'Female', 'Other'].map(g => <option key={g}>{g}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-gray-500 block mb-1">{t('categoryLabel')}</label>
                                        <select value={form.category} onChange={e => set('category', e.target.value)}
                                            className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500">
                                            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 2. Location Section */}
                        <div className="bg-amber-50 rounded-xl p-4 border border-amber-100 relative group hover:border-amber-300 transition-colors">
                            <h3 className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-4 flex items-center gap-2">
                                <span className="bg-amber-200 text-amber-800 rounded px-1.5 py-0.5">{t('step2')}</span> {t('locationLabel')}
                            </h3>
                            <div className="space-y-3">
                                <div>
                                    <label className="text-xs font-medium text-gray-500 block mb-1">{t('stateLabel')} <span className="text-red-400">*</span></label>
                                    <select required value={form.state} onChange={e => set('state', e.target.value)}
                                        className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500">
                                        <option value="">{t('selectState')}</option>
                                        {STATES.map(s => <option key={s}>{s}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-gray-500 block mb-1">{t('districtLabel')}</label>
                                    <input type="text" placeholder="e.g. Nashik"
                                        value={form.district} onChange={e => set('district', e.target.value)}
                                        className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 3. Farm Details Section (Full Width) */}
                    <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100 relative group hover:border-emerald-300 transition-colors">
                        <h3 className="text-xs font-bold text-emerald-700 uppercase tracking-wide mb-4 flex items-center gap-2">
                            <span className="bg-emerald-200 text-emerald-800 rounded px-1.5 py-0.5">{t('step3')}</span> {t('farmCropDetails')}
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="col-span-2 md:col-span-1">
                                <label className="text-xs font-medium text-gray-500 block mb-1">{t('primaryCrop')} <span className="text-red-400">*</span></label>
                                <div className="space-y-1">
                                    {myCrops.length > 0 ? (
                                        <select
                                            className="w-full bg-white border border-teal-200 text-teal-800 font-medium rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                                            value={myCrops.find(c => c.crop_name === form.crop)?.id ?? ''}
                                            onChange={(e) => {
                                                const c = myCrops.find(cr => cr.id === e.target.value)
                                                if (c) {
                                                    set('crop', c.crop_name)
                                                    if (c.area_acres) set('land_acres', String(c.area_acres))
                                                    const irrigationMap: Record<string, string> = {
                                                        rainfed: 'Rain-fed', drip: 'Drip Irrigation',
                                                        canal: 'Irrigated', sprinkler: 'Irrigated', borewell: 'Irrigated',
                                                    }
                                                    if (c.irrigation && irrigationMap[c.irrigation]) set('farming_type', irrigationMap[c.irrigation])
                                                }
                                            }}
                                        >
                                            <option value="" disabled>Select from My Crops</option>
                                            {myCrops.map(c => (
                                                <option key={c.id} value={c.id}>
                                                    {c.crop_name} {c.area_acres ? `(${c.area_acres} ac)` : ''}
                                                </option>
                                            ))}
                                        </select>
                                    ) : (
                                        <input
                                            type="text"
                                            readOnly
                                            value={form.crop || 'No crop in profile'}
                                            className="w-full bg-gray-50 border border-gray-200 text-gray-400 rounded-lg px-3 py-2 text-sm cursor-not-allowed"
                                        />
                                    )}
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-medium text-gray-500 block mb-1">{t('landAcres')}</label>
                                <input type="number" step="0.5" placeholder="e.g. 3.5"
                                    value={form.land_acres} onChange={e => set('land_acres', e.target.value)}
                                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-gray-500 block mb-1">{t('farmingType')}</label>
                                <select value={form.farming_type} onChange={e => set('farming_type', e.target.value)}
                                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500">
                                    <option value="">{t('selectCrop')}</option>
                                    {FARMING_TYPES.map(f => <option key={f}>{f}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-medium text-gray-500 block mb-1">{t('incomeLevel')}</label>
                                <select value={form.income_level} onChange={e => set('income_level', e.target.value)}
                                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500">
                                    <option value="">{t('incomeLevel')}</option>
                                    {INCOME_LEVELS.map(l => <option key={l}>{l}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>

                    <button type="submit" disabled={loading}
                        className="w-full bg-gradient-to-r from-teal-600 to-emerald-600 text-white py-3 rounded-xl font-semibold text-sm hover:from-teal-700 hover:to-emerald-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-md">
                        {loading
                            ? <><Sparkles size={16} className="animate-spin" /> {t('analysingAI')}</>
                            : <><Shield size={16} /> {t('findSchemes')}</>
                        }
                    </button>
                </form>
            )}

            {/* Results */}
            {result && (
                <div className="space-y-4">
                    {/* KB badge */}
                    <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-xl border ${result.used_bedrock_kb ? 'bg-violet-50 border-violet-200 text-violet-700' : 'bg-gray-50 border-gray-200 text-gray-500'}`}>
                        <span>{result.used_bedrock_kb ? '🟣 AWS Bedrock Knowledge Base' : '🟡 API + Embedded Knowledge'}</span>
                        <span className="text-gray-400">• Sarvam-M reasoning</span>
                    </div>

                    {/* AI Recommendation */}
                    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 to-violet-700 p-1 shadow-xl">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                        <div className="bg-white rounded-[1.4rem] p-6 relative z-10">
                            <h3 className="text-sm font-bold text-indigo-600 mb-4 flex items-center gap-3 uppercase tracking-wider">
                                <span className="p-1.5 bg-indigo-50 rounded-lg"><Sparkles size={18} /></span> 
                                {t('aiAnalysis')}
                            </h3>
                            <div className="text-sm leading-relaxed prose prose-sm prose-indigo max-w-none
                                prose-headings:font-bold prose-headings:text-gray-900 
                                prose-p:text-slate-600 prose-strong:text-indigo-700
                                prose-li:marker:text-indigo-400">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{result.recommendation}</ReactMarkdown>
                            </div>
                        </div>
                    </div>

                    {/* Audio */}
                    {result.audio_base64 && (
                        <AudioPlayer audioBase64={result.audio_base64} format={result.audio_format ?? 'wav'} />
                    )}

                    {/* Scheme Cards */}
                    <div className="pt-2">
                        <div className="flex items-center justify-between mb-4 px-1">
                            <h3 className="text-sm font-bold text-teal-900 flex items-center gap-2">
                                <span className="bg-gradient-to-br from-teal-400 to-emerald-500 text-white p-1.5 rounded-lg shadow-sm"><Shield size={14} /></span>
                                {t('bestSchemes')}
                            </h3>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-teal-600 bg-teal-50 px-2.5 py-1 rounded-full border border-teal-100">
                                {result.top_schemes.length} Options
                            </span>
                        </div>
                        
                        <div className="grid gap-3">
                            {result.top_schemes.map((s, i) => (
                                <div key={s.id || i} className={`border rounded-2xl overflow-hidden shadow-sm transition-all duration-300 ${expanded === s.id ? 'bg-gradient-to-br from-white to-teal-50/30 border-teal-200 ring-1 ring-teal-200 shadow-md transform scale-[1.01]' : 'bg-white border-gray-100 hover:border-teal-200 hover:shadow-md'}`}>
                                    <button
                                        onClick={() => setExpanded(prev => prev === s.id ? null : s.id)}
                                        className="w-full flex items-start gap-4 p-4 text-left group"
                                    >
                                        <span className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all shadow-sm ${expanded === s.id ? 'bg-teal-600 text-white scale-110' : 'bg-gray-50 text-gray-500 group-hover:bg-teal-50 group-hover:text-teal-600'}`}>
                                            {i + 1}
                                        </span>
                                        
                                        <div className="flex-1 min-w-0 pt-0.5">
                                            <p className={`text-sm font-semibold leading-snug mb-1 transition-colors ${expanded === s.id ? 'text-teal-900' : 'text-gray-800 group-hover:text-teal-800'}`}>
                                                {s.name}
                                            </p>
                                            <p className="text-xs text-gray-500 font-medium">{s.ministry || s.state}</p>
                                        </div>
                                        
                                        <div className="flex items-center gap-1 pl-2">
                                            {s.official_url && (
                                                <a href={s.official_url} target="_blank" rel="noreferrer"
                                                    onClick={e => e.stopPropagation()}
                                                    className="p-2 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors">
                                                    <ExternalLink size={16} />
                                                </a>
                                            )}
                                            <div className={`p-1 rounded-lg transition-colors ${expanded === s.id ? 'bg-teal-100 text-teal-700' : 'text-gray-300 group-hover:text-gray-400'}`}>
                                                {expanded === s.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                            </div>
                                        </div>
                                    </button>

                                    {expanded === s.id && (
                                        <div className="px-5 pb-5 pt-0 text-sm space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
                                            <div className="h-px bg-gradient-to-r from-transparent via-teal-100 to-transparent mb-4"></div>
                                            {s.description && <p className="text-slate-600 leading-relaxed">{s.description}</p>}
                                            
                                            <div className="grid md:grid-cols-2 gap-4 pt-2">
                                                {s.eligibility && s.eligibility.length > 0 && (
                                                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                                                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Eligibility</p>
                                                        <ul className="pl-4 list-disc text-slate-700 space-y-1 marker:text-slate-400">
                                                            {s.eligibility.slice(0, 4).map((e, j) => (
                                                                <li key={j}>{typeof e === 'string' ? e : JSON.stringify(e)}</li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}
                                                
                                                {s.benefits && s.benefits.length > 0 && (
                                                    <div className="bg-teal-50 rounded-xl p-3 border border-teal-100">
                                                        <p className="text-xs font-bold text-teal-600 uppercase tracking-wider mb-2">Key Benefits</p>
                                                        <ul className="pl-4 list-disc text-teal-900 space-y-1 marker:text-teal-500">
                                                            {s.benefits.slice(0, 3).map((b, j) => (
                                                                <li key={j}>{typeof b === 'string' ? b : JSON.stringify(b)}</li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* AWS Source citations */}
                    {result.sources.length > 0 && (
                        <div className="bg-violet-50 border border-violet-200 rounded-xl p-4">
                            <h4 className="text-xs font-bold text-violet-700 uppercase tracking-wide mb-3 flex items-center gap-2">
                                <span className="bg-violet-200 text-violet-800 rounded px-1.5 py-0.5">SOURCE</span> AWS Bedrock Knowledge Base
                            </h4>
                            <div className="space-y-2">
                                {result.sources.slice(0, 3).map((s, i) => (
                                    <div key={i} className="text-xs text-violet-900 bg-white/50 p-2 rounded border border-violet-100 italic">
                                        "{s.content}"
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <button onClick={() => setResult(null)}
                        className="flex items-center gap-1 text-xs text-teal-600 hover:underline">
                        <RefreshCw size={12} /> {t('startOver')}
                    </button>
                </div>
            )}
        </div>
    )
}

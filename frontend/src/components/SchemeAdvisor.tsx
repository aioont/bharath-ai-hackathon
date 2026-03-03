import { useState } from 'react'
import { ChevronDown, ChevronUp, Award, ExternalLink, RefreshCw, CheckCircle } from 'lucide-react'
import AudioPlayer from '@/components/AudioPlayer'
import api from '@/services/api'

interface Scheme {
    id: string
    name: string
    type: string
    benefit: string
    documents?: string[]
    how_to_apply?: string
    helpline?: string
    portal?: string
}

interface SchemeAdvisorProps {
    isOpen: boolean
    onToggle: () => void
    language: string
    autoSpeak: boolean
    userProfile?: {
        name?: string
        state?: string
        farmingType?: string
    }
}

export default function SchemeAdvisor({ isOpen, onToggle, language, autoSpeak, userProfile }: SchemeAdvisorProps) {
    const [loading, setLoading] = useState(false)
    const [landAcres, setLandAcres] = useState('')
    const [result, setResult] = useState<{
        matched_schemes: Scheme[]
        ai_narration: string
        news?: { title: string; body: string; href: string }[]
        audio_base64?: string
        audio_format?: string
    } | null>(null)
    const [expandedScheme, setExpandedScheme] = useState<string | null>(null)

    const checkEligibility = async () => {
        setLoading(true)
        try {
            const resp = await api.post('/api/schemes/check-eligibility', {
                state: userProfile?.state || null,
                farming_type: userProfile?.farmingType || null,
                land_acres: landAcres ? parseFloat(landAcres) : null,
                name: userProfile?.name || 'Farmer',
                language,
                tts_enabled: autoSpeak,
            })
            setResult(resp.data)
        } catch { /* silent */ }
        finally { setLoading(false) }
    }

    const prioritySchemes = ['pm_kisan', 'pmfby', 'kcc', 'pmksy', 'soil_health_card']

    return (
        <div className="border border-amber-200 rounded-2xl overflow-hidden bg-white shadow-sm">
            <button
                onClick={onToggle}
                className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-amber-500 to-orange-400 text-white hover:from-amber-600 hover:to-orange-500 transition-all"
            >
                <div className="flex items-center gap-2">
                    <Award size={20} />
                    <span className="font-semibold">🏛️ Scheme Eligibility Advisor</span>
                    <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">Free Benefits</span>
                </div>
                {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>

            {isOpen && (
                <div className="p-4 space-y-4">
                    {!result ? (
                        <div className="space-y-4">
                            {/* Pre-filled summary */}
                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-1">
                                <p className="text-xs font-semibold text-amber-800">Your Profile</p>
                                <p className="text-xs text-amber-700">
                                    {userProfile?.name && <span>👤 {userProfile.name} • </span>}
                                    {userProfile?.state && <span>📍 {userProfile.state} • </span>}
                                    {userProfile?.farmingType && <span>🌿 {userProfile.farmingType}</span>}
                                    {!userProfile?.state && <span className="text-amber-600">Complete your profile for better matching</span>}
                                </p>
                            </div>

                            <div>
                                <label className="text-xs text-gray-500 block mb-1">Your land area (acres) — optional</label>
                                <input
                                    type="number"
                                    placeholder="e.g. 3.5"
                                    value={landAcres}
                                    onChange={e => setLandAcres(e.target.value)}
                                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-400"
                                />
                            </div>

                            <button
                                onClick={checkEligibility}
                                disabled={loading}
                                className="w-full bg-amber-500 text-white py-2 rounded-xl hover:bg-amber-600 transition-colors text-sm font-medium disabled:opacity-50"
                            >
                                {loading ? '⏳ Checking your eligibility…' : '🔍 Check My Eligible Schemes'}
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* Count badge */}
                            <div className="flex items-center gap-2">
                                <CheckCircle size={16} className="text-amber-600" />
                                <span className="text-sm font-semibold text-amber-800">
                                    {result.matched_schemes.length} schemes matched for you
                                </span>
                            </div>

                            {/* AI Narration */}
                            {result.ai_narration && (
                                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 whitespace-pre-wrap max-h-48 overflow-y-auto leading-relaxed">
                                    {result.ai_narration}
                                </div>
                            )}

                            {/* Audio */}
                            {result.audio_base64 && (
                                <AudioPlayer audioBase64={result.audio_base64} format={result.audio_format ?? 'wav'} />
                            )}

                            {/* Scheme Cards */}
                            <div className="space-y-2">
                                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Your Matched Schemes</h4>
                                {result.matched_schemes
                                    .sort((a, b) => (prioritySchemes.indexOf(a.id) + 1 || 99) - (prioritySchemes.indexOf(b.id) + 1 || 99))
                                    .slice(0, 8)
                                    .map(scheme => (
                                        <div key={scheme.id} className="border border-gray-100 rounded-xl overflow-hidden">
                                            <button
                                                onClick={() => setExpandedScheme(expandedScheme === scheme.id ? null : scheme.id)}
                                                className="w-full flex items-start justify-between p-3 hover:bg-gray-50 transition-colors text-left"
                                            >
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-semibold text-gray-800">{scheme.name}</span>
                                                        <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">
                                                            {scheme.type}
                                                        </span>
                                                        {prioritySchemes.slice(0, 3).includes(scheme.id) && (
                                                            <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">
                                                                Priority
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-green-700 mt-0.5">{scheme.benefit}</p>
                                                </div>
                                                <ChevronDown
                                                    size={14}
                                                    className={`text-gray-400 flex-shrink-0 mt-0.5 transition-transform ${expandedScheme === scheme.id ? 'rotate-180' : ''}`}
                                                />
                                            </button>

                                            {expandedScheme === scheme.id && (
                                                <div className="px-3 pb-3 pt-0 space-y-2 bg-gray-50 text-xs">
                                                    {scheme.documents && (
                                                        <div>
                                                            <p className="font-medium text-gray-600">📄 Documents needed:</p>
                                                            <ul className="pl-4 list-disc text-gray-500">
                                                                {scheme.documents.map((d, i) => <li key={i}>{d}</li>)}
                                                            </ul>
                                                        </div>
                                                    )}
                                                    {scheme.how_to_apply && (
                                                        <p><span className="font-medium text-gray-600">📝 How to apply:</span> {scheme.how_to_apply}</p>
                                                    )}
                                                    {scheme.helpline && (
                                                        <p><span className="font-medium text-gray-600">📞 Helpline:</span> {scheme.helpline}</p>
                                                    )}
                                                    {scheme.portal && (
                                                        <a href={scheme.portal} target="_blank" rel="noreferrer"
                                                            className="flex items-center gap-1 text-blue-600 hover:underline">
                                                            <ExternalLink size={10} /> {scheme.portal}
                                                        </a>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                            </div>

                            {/* News */}
                            {result.news && result.news.length > 0 && (
                                <div>
                                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">📰 Latest Updates</h4>
                                    <div className="space-y-2">
                                        {result.news.slice(0, 3).map((n, i) => (
                                            <a key={i} href={n.href} target="_blank" rel="noreferrer"
                                                className="flex items-start gap-2 p-2 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors">
                                                <ExternalLink size={10} className="text-amber-500 mt-0.5 flex-shrink-0" />
                                                <div>
                                                    <p className="text-xs font-medium text-gray-700 line-clamp-1">{n.title}</p>
                                                    <p className="text-xs text-gray-500 line-clamp-1">{n.body}</p>
                                                </div>
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <button
                                onClick={() => setResult(null)}
                                className="flex items-center gap-1 text-xs text-amber-600 hover:underline"
                            >
                                <RefreshCw size={12} /> Check again
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

import { useState } from 'react'
import { ChevronDown, ChevronUp, TrendingUp, RefreshCw, ExternalLink } from 'lucide-react'
import AudioPlayer from '@/components/AudioPlayer'
import ReactMarkdown from 'react-markdown'
import api from '@/services/api'

interface PriceRow {
    market: string
    state: string
    commodity: string
    modal_price: number
    min_price: number
    max_price: number
    unit: string
    date: string
}

interface NewsItem { title: string; body: string; href: string }

interface MarketAnalyzerProps {
    isOpen: boolean
    onToggle: () => void
    language: string
    autoSpeak: boolean
    userProfile?: { state?: string }
}

const COMMODITIES = [
    'Wheat', 'Rice', 'Maize', 'Cotton', 'Onion', 'Potato', 'Tomato', 'Sugarcane',
    'Soybean', 'Groundnut', 'Mustard', 'Chilli', 'Turmeric', 'Garlic', 'Banana', 'Mango',
    'Jowar', 'Bajra', 'Barley', 'Gram', 'Arhar', 'Moong', 'Urad', 'Masoor',
    'Sunflower', 'Safflower', 'Nigerseed', 'Sesamum', 'Coconut', 'Arecanut', 'Cashewnut',
    'Black Pepper', 'Cardamom', 'Ginger', 'Coriander', 'Cumin', 'Fennel', 'Fenugreek', 'Ajwain',
    'Guava', 'Pomegranate', 'Papaya', 'Orange', 'Grapes', 'Apple', 'Pineapple', 'Watermelon',
    'Cabbage', 'Cauliflower', 'Brinjal', 'Okra', 'Peas', 'Beans', 'Carrot', 'Radish',
    'Beetroot', 'Cucumber', 'Bitter Gourd', 'Bottle Gourd', 'Pumpkin'
].sort()

const STATES = [
    'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa',
    'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala',
    'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland',
    'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
    'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Delhi', 'Chandigarh',
    'Jammu and Kashmir', 'Ladakh'
].sort()

export default function MarketAnalyzer({ isOpen, onToggle, language, autoSpeak, userProfile }: MarketAnalyzerProps) {
    const [commodity, setCommodity] = useState('Wheat')
    const [state, setState] = useState(userProfile?.state || 'Maharashtra')
    const [loading, setLoading] = useState(false)
    const [result, setResult] = useState<{
        prices?: { data: PriceRow[]; msp?: number; source: string }
        news?: NewsItem[]
        yield_weather_advice?: string
        season?: string
        analysis_date?: string
        ai_summary?: string
        audio_base64?: string
        audio_format?: string
    } | null>(null)

    const analyze = async () => {
        setLoading(true)
        try {
            const resp = await api.post('/api/market-analyzer/analyze', {
                commodity: commodity.toLowerCase(),
                state: state.toLowerCase(),
                location: state,
                language,
                tts_enabled: autoSpeak,
            })
            setResult(resp.data)
        } catch { /* silent fail */ }
        finally { setLoading(false) }
    }

    return (
        <div className="border border-blue-200 rounded-2xl overflow-hidden bg-white shadow-sm">
            <button
                onClick={onToggle}
                className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-blue-600 to-indigo-500 text-white hover:from-blue-700 hover:to-indigo-600 transition-all"
            >
                <div className="flex items-center gap-2">
                    <TrendingUp size={20} />
                    <span className="font-semibold">📊 Market Analyzer</span>
                    <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">Live Prices</span>
                </div>
                {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>

            {isOpen && (
                <div className="p-4 space-y-4">
                    {/* Selectors */}
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="text-xs text-gray-500 mb-1 block">Crop / Commodity</label>
                            <select
                                className="w-full border border-gray-200 rounded-lg text-sm px-2 py-1.5 focus:outline-none focus:border-blue-400"
                                value={commodity}
                                onChange={e => setCommodity(e.target.value)}
                            >
                                {COMMODITIES.map(c => <option key={c}>{c}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs text-gray-500 mb-1 block">State</label>
                            <select
                                className="w-full border border-gray-200 rounded-lg text-sm px-2 py-1.5 focus:outline-none focus:border-blue-400"
                                value={state}
                                onChange={e => setState(e.target.value)}
                            >
                                {STATES.map(s => <option key={s}>{s}</option>)}
                            </select>
                        </div>
                    </div>

                    <button
                        onClick={analyze}
                        disabled={loading}
                        className="w-full bg-blue-600 text-white py-2 rounded-xl hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50"
                    >
                        {loading ? '⏳ Analysing market…' : '📊 Analyze Market Now'}
                    </button>

                    {result && (
                        <div className="space-y-4">
                            {/* Context Info */}
                            {(result.season || result.analysis_date) && (
                                <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-xl p-3">
                                    <div className="flex items-center justify-between text-xs">
                                        {result.season && (
                                            <span className="font-medium text-green-700">🌾 {result.season}</span>
                                        )}
                                        {result.analysis_date && (
                                            <span className="text-gray-600">📅 {new Date(result.analysis_date).toLocaleDateString()}</span>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Price Table */}
                            {result.prices?.data && result.prices.data.length > 0 && (
                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                            Mandi Prices ({result.prices.source === 'agmarknet_live' ? '🟢 Live' : '🟡 Estimated'})
                                        </h4>
                                        {result.prices.msp && (
                                            <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">
                                                MSP ₹{result.prices.msp}/q
                                            </span>
                                        )}
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-xs">
                                            <thead>
                                                <tr className="bg-blue-50 text-blue-700">
                                                    <th className="px-2 py-1 text-left rounded-l-lg">Mandi</th>
                                                    <th className="px-2 py-1 text-right">Min</th>
                                                    <th className="px-2 py-1 text-right font-bold">Modal</th>
                                                    <th className="px-2 py-1 text-right rounded-r-lg">Max</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {result.prices.data.slice(0, 5).map((row, i) => (
                                                    <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                                                        <td className="px-2 py-1 font-medium">{row.market}</td>
                                                        <td className="px-2 py-1 text-right text-gray-500">₹{row.min_price}</td>
                                                        <td className="px-2 py-1 text-right font-bold text-blue-700">₹{row.modal_price}</td>
                                                        <td className="px-2 py-1 text-right text-gray-500">₹{row.max_price}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* Weather Advice */}
                            {result.yield_weather_advice && (
                                <div className="bg-sky-50 border border-sky-200 rounded-xl p-3">
                                    <h4 className="text-xs font-semibold text-sky-700 mb-1">🌦️ Weather Impact</h4>
                                    <p className="text-xs text-sky-800">{result.yield_weather_advice}</p>
                                </div>
                            )}

                            {/* AI Summary */}
                            {result.ai_summary && (
                                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4 max-h-96 overflow-y-auto shadow-sm">
                                    <h4 className="flex items-center gap-2 mb-3 text-blue-700 font-semibold text-sm uppercase tracking-wide">
                                        <span>🤖 AI Market Insights</span>
                                    </h4>
                                    <div className="prose prose-sm max-w-none text-gray-800 space-y-3">
                                        <ReactMarkdown
                                            components={{
                                                h3: ({ children }) => <h3 className="text-base font-bold text-blue-800 mt-4 mb-2 flex items-center gap-2">{children}</h3>,
                                                h4: ({ children }) => <h4 className="text-sm font-semibold text-blue-700 mt-3 mb-1">{children}</h4>,
                                                p: ({ children }) => <p className="text-sm leading-relaxed mb-2">{children}</p>,
                                                ul: ({ children }) => <ul className="list-disc list-inside space-y-1 ml-2">{children}</ul>,
                                                li: ({ children }) => <li className="text-sm">{children}</li>,
                                                strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
                                                em: ({ children }) => <em className="italic text-blue-700">{children}</em>,
                                            }}
                                        >
                                            {result.ai_summary}
                                        </ReactMarkdown>
                                    </div>
                                </div>
                            )}

                            {/* Audio */}
                            {result.audio_base64 && (
                                <AudioPlayer audioBase64={result.audio_base64} format={result.audio_format ?? 'wav'} />
                            )}

                            {/* News */}
                            {result.news && result.news.length > 0 && (
                                <div>
                                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">📰 Market News</h4>
                                    <div className="space-y-2">
                                        {result.news.slice(0, 3).map((n, i) => (
                                            <a
                                                key={i}
                                                href={n.href}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="flex items-start gap-2 p-2 bg-gray-50 rounded-lg hover:bg-blue-50 transition-colors"
                                            >
                                                <ExternalLink size={10} className="text-blue-500 mt-0.5 flex-shrink-0" />
                                                <div>
                                                    <p className="text-xs font-medium text-gray-700 line-clamp-1">{n.title}</p>
                                                    <p className="text-xs text-gray-500 line-clamp-2">{n.body}</p>
                                                </div>
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <button
                                onClick={() => setResult(null)}
                                className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                            >
                                <RefreshCw size={12} /> New search
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

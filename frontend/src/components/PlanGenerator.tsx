import { useState, useEffect } from 'react'
import { ChevronDown, ChevronUp, Send, Sparkles, Leaf, RefreshCw } from 'lucide-react'
import AudioPlayer from '@/components/AudioPlayer'
import VoiceButton from '@/components/VoiceButton'
import ReactMarkdown from 'react-markdown'
import api from '@/services/api'

interface PlanQuestion {
    id: string
    key: string
    question_en: string
    placeholder?: string
    type: 'text' | 'number' | 'select'
    options?: string[]
    required?: boolean
}

interface SensorData {
    soil: Record<string, unknown>
    weather: Record<string, unknown>
    irrigation: Record<string, unknown>
}

interface PlanResult {
    plan: string
    sensor_data: SensorData
    audio_base64?: string
    audio_format?: string
    language: string
}

interface PlanGeneratorProps {
    isOpen: boolean
    onToggle: () => void
    language: string
    autoSpeak: boolean
    userProfile?: { name?: string; state?: string }
}

export default function PlanGenerator({ isOpen, onToggle, language, autoSpeak, userProfile }: PlanGeneratorProps) {
    const [questions, setQuestions] = useState<PlanQuestion[]>([])
    const [currentQ, setCurrentQ] = useState(0)
    const [answers, setAnswers] = useState<Record<string, string>>({})
    const [currentInput, setCurrentInput] = useState('')
    const [loading, setLoading] = useState(false)
    const [result, setResult] = useState<PlanResult | null>(null)
    const [isListening, setIsListening] = useState(false)
    const [phase, setPhase] = useState<'questions' | 'processing' | 'done'>('questions')

    useEffect(() => {
        if (isOpen && questions.length === 0) {
            api.get('/api/plan/questions').then(r => setQuestions(r.data.questions)).catch(() => { })
        }
    }, [isOpen])

    // Pre-fill location from profile
    useEffect(() => {
        if (userProfile?.state && !answers.location) {
            setAnswers(prev => ({ ...prev, location: userProfile.state! }))
        }
    }, [userProfile])

    const currentQuestion = questions[currentQ]
    const progress = questions.length > 0 ? Math.round((currentQ / questions.length) * 100) : 0

    const handleAnswer = (value: string) => {
        if (!currentQuestion) return
        const newAnswers = { ...answers, [currentQuestion.key]: value }
        setAnswers(newAnswers)
        setCurrentInput('')
        if (currentQ < questions.length - 1) {
            setCurrentQ(prev => prev + 1)
        } else {
            handleGenerate(newAnswers)
        }
    }

    const handleGenerate = async (finalAnswers: Record<string, string>) => {
        setPhase('processing')
        setLoading(true)
        try {
            const resp = await api.post('/api/plan/generate', {
                answers: finalAnswers,
                language,
                tts_enabled: autoSpeak,
            })
            setResult(resp.data)
            setPhase('done')
        } catch {
            setPhase('done')
        } finally {
            setLoading(false)
        }
    }

    const handleReset = () => {
        setCurrentQ(0)
        setAnswers({})
        setCurrentInput('')
        setResult(null)
        setPhase('questions')
    }

    return (
        <div className="border border-green-200 rounded-2xl overflow-hidden bg-white shadow-sm">
            {/* Header */}
            <button
                onClick={onToggle}
                className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-green-600 to-emerald-500 text-white hover:from-green-700 hover:to-emerald-600 transition-all"
            >
                <div className="flex items-center gap-2">
                    <Leaf size={20} />
                    <span className="font-semibold">🌱 Farm Plan Generator</span>
                </div>
                {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>

            {isOpen && (
                <div className="p-4 space-y-4">
                    {phase === 'questions' && questions.length > 0 && currentQuestion && (
                        <div className="space-y-4">
                            {/* Progress */}
                            <div className="space-y-1">
                                <div className="flex justify-between text-xs text-gray-500">
                                    <span>Question {currentQ + 1} of {questions.length}</span>
                                    <span>{progress}% complete</span>
                                </div>
                                <div className="w-full bg-gray-100 rounded-full h-2">
                                    <div className="bg-green-500 h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
                                </div>
                            </div>

                            {/* Current question */}
                            <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                                <p className="text-sm font-medium text-green-800">{currentQuestion.question_en}</p>
                            </div>

                            {/* Select or text input */}
                            {currentQuestion.type === 'select' && currentQuestion.options ? (
                                <div className="grid grid-cols-2 gap-2">
                                    {currentQuestion.options.map(opt => (
                                        <button
                                            key={opt}
                                            onClick={() => handleAnswer(opt)}
                                            className="text-sm border border-gray-200 rounded-xl px-3 py-2 hover:bg-green-50 hover:border-green-400 transition-all text-left"
                                        >
                                            {opt}
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex gap-2 items-end">
                                    <VoiceButton
                                        onTranscript={v => setCurrentInput(v)}
                                        isListening={isListening}
                                        setIsListening={setIsListening}
                                        language={language === 'hi' ? 'hi-IN' : `${language}-IN`}
                                    />
                                    <div className="flex-1 flex gap-2">
                                        <input
                                            type={currentQuestion.type === 'number' ? 'number' : 'text'}
                                            className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green-500"
                                            placeholder={currentQuestion.placeholder || 'Type your answer...'}
                                            value={currentInput}
                                            onChange={e => setCurrentInput(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && currentInput.trim() && handleAnswer(currentInput.trim())}
                                        />
                                        <button
                                            onClick={() => currentInput.trim() && handleAnswer(currentInput.trim())}
                                            className="bg-green-600 text-white px-4 rounded-xl hover:bg-green-700 transition-colors"
                                        >
                                            <Send size={16} />
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Skip optional */}
                            {!currentQuestion.required && (
                                <button
                                    onClick={() => handleAnswer('')}
                                    className="text-xs text-gray-400 hover:text-gray-600 underline"
                                >
                                    Skip this question
                                </button>
                            )}
                        </div>
                    )}

                    {phase === 'processing' && (
                        <div className="flex flex-col items-center gap-3 py-8">
                            <Sparkles size={32} className="text-green-600 animate-spin" />
                            <p className="text-sm text-gray-600">Analyzing soil, weather & generating your farm plan…</p>
                            <p className="text-xs text-gray-400">Reading IoT sensor data + AI planning…</p>
                        </div>
                    )}

                    {phase === 'done' && result && (
                        <div className="space-y-4">
                            {/* IoT Sensor Summary */}
                            {result.sensor_data && (
                                <div className="grid grid-cols-3 gap-2">
                                    {[
                                        { label: 'Soil pH', value: String(result.sensor_data.soil?.['soil_ph'] ?? '-') },
                                        { label: 'Moisture', value: `${result.sensor_data.soil?.['moisture_pct'] ?? '-'}%` },
                                        { label: 'N/P/K', value: `${Math.round(Number(result.sensor_data.soil?.['nitrogen_kg_ha']) || 0)}/${Math.round(Number(result.sensor_data.soil?.['phosphorus_kg_ha']) || 0)}/${Math.round(Number(result.sensor_data.soil?.['potassium_kg_ha']) || 0)}` },
                                        { label: 'Temp', value: `${result.sensor_data.weather?.['temperature_c'] ?? '-'}°C` },
                                        { label: 'Yield Est', value: `${result.sensor_data.irrigation?.['estimated_yield_q_per_acre'] ?? '-'} q/ac` },
                                        { label: 'Leaf', value: String(result.sensor_data.irrigation?.['leaf_color_status'] ?? '-').split(' ').slice(0, 2).join(' ') },
                                    ].map(s => (
                                        <div key={s.label} className="bg-green-50 rounded-lg p-2 text-center">
                                            <div className="text-xs text-gray-500">{s.label}</div>
                                            <div className="text-sm font-semibold text-green-700">{s.value}</div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Plan text */}
                            <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4 max-h-96 overflow-y-auto shadow-sm">
                                <div className="prose prose-sm max-w-none text-gray-800 space-y-3">
                                    <ReactMarkdown
                                        components={{
                                            h3: ({ children }) => <h3 className="text-base font-bold text-green-800 mt-4 mb-2 flex items-center gap-2">{children}</h3>,
                                            h4: ({ children }) => <h4 className="text-sm font-semibold text-green-700 mt-3 mb-1">{children}</h4>,
                                            p: ({ children }) => <p className="text-sm leading-relaxed mb-2">{children}</p>,
                                            ul: ({ children }) => <ul className="list-disc list-inside space-y-1 ml-2">{children}</ul>,
                                            ol: ({ children }) => <ol className="list-decimal list-inside space-y-1 ml-2">{children}</ol>,
                                            li: ({ children }) => <li className="text-sm">{children}</li>,
                                            strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
                                            em: ({ children }) => <em className="italic text-green-700">{children}</em>,
                                        }}
                                    >
                                        {result.plan}
                                    </ReactMarkdown>
                                </div>
                            </div>

                            {/* Audio */}
                            {result.audio_base64 && (
                                <AudioPlayer audioBase64={result.audio_base64} format={result.audio_format ?? 'wav'} />
                            )}

                            <button
                                onClick={handleReset}
                                className="flex items-center gap-1 text-xs text-green-600 hover:underline"
                            >
                                <RefreshCw size={12} /> Generate new plan
                            </button>
                        </div>
                    )}

                    {loading && phase === 'questions' && (
                        <div className="text-center py-4 text-sm text-gray-500">Loading questions…</div>
                    )}
                </div>
            )}
        </div>
    )
}

import { useState } from 'react'
import { ArrowLeftRight, Copy, Volume2, RotateCcw, Sparkles } from 'lucide-react'
import toast from 'react-hot-toast'
import { translateText } from '@/services/api'
import type { TranslationRequest } from '@/services/api'
import { SUPPORTED_LANGUAGES } from '@/utils/constants'
import LanguageSelector from '@/components/LanguageSelector'
import VoiceButton from '@/components/VoiceButton'
import LoadingSpinner from '@/components/LoadingSpinner'
import { useAppContext } from '@/context/AppContext'
import type { Language } from '@/context/AppContext'

const QUICK_PHRASE_KEYS = ['qPhrase1', 'qPhrase2', 'qPhrase3', 'qPhrase4', 'qPhrase5', 'qPhrase6']

export default function Translate() {
  const { state, t } = useAppContext()
  const [inputText, setInputText] = useState('')
  const [outputText, setOutputText] = useState('')
  const [sourceLang, setSourceLang] = useState('en')
  const [targetLang, setTargetLang] = useState(state.selectedLanguage.code)
  const [loading, setLoading] = useState(false)
  const [confidence, setConfidence] = useState<number | null>(null)
  const charLimit = 2000

  const handleTranslate = async () => {
    if (!inputText.trim()) {
      toast.error('Please enter text to translate')
      return
    }
    if (sourceLang === targetLang) {
      toast.error('Source and target languages cannot be the same')
      return
    }
    setLoading(true)
    try {
      const req: TranslationRequest = {
        text: inputText.trim(),
        source_language: sourceLang,
        target_language: targetLang,
      }
      const result = await translateText(req)
      setOutputText(result.translated_text)
      setConfidence(result.confidence)
    } catch (err) {
      toast.error('Translation failed. Please try again.')
      // Demo fallback
      setOutputText(`[Demo] Translation of: "${inputText.slice(0, 50)}..."`)
    } finally {
      setLoading(false)
    }
  }

  const swapLanguages = () => {
    setSourceLang(targetLang)
    setTargetLang(sourceLang)
    setInputText(outputText)
    setOutputText(inputText)
  }

  const copyOutput = () => {
    if (outputText) {
      navigator.clipboard.writeText(outputText)
      toast.success('Copied to clipboard')
    }
  }

  const speakOutput = () => {
    if (outputText && 'speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(outputText)
      const lang = SUPPORTED_LANGUAGES.find((l) => l.code === targetLang)
      utterance.lang = lang?.script === 'Devanagari' ? 'hi-IN' : `${targetLang}-IN`
      window.speechSynthesis.speak(utterance)
    }
  }

  const reset = () => {
    setInputText('')
    setOutputText('')
    setConfidence(null)
  }

  const sourceLangObj = SUPPORTED_LANGUAGES.find((l) => l.code === sourceLang)
  const targetLangObj = SUPPORTED_LANGUAGES.find((l) => l.code === targetLang)

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="section-title flex items-center gap-2">
          <span>🌐</span> {t('translateTitle')}
        </h1>
        <p className="section-subtitle">
          Translate agricultural content into 15 Indian languages powered by Sarvam Translate
        </p>
      </div>


      {/* Language Pair */}
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <LanguageSelector
            label="From"
            value={sourceLang}
            onChange={(l: Language) => setSourceLang(l.code)}
          />
        </div>
        <button
          onClick={swapLanguages}
          className="flex-shrink-0 mb-0.5 p-3 rounded-xl bg-primary-100 hover:bg-primary-200 
            text-primary-700 transition-all active:rotate-180 duration-300"
          title="Swap languages"
        >
          <ArrowLeftRight size={18} />
        </button>
        <div className="flex-1">
          <LanguageSelector
            label="To"
            value={targetLang}
            onChange={(l: Language) => setTargetLang(l.code)}
          />
        </div>
      </div>

      {/* Input Area */}
      <div className="card border-2 border-gray-200 focus-within:border-primary-400 transition-colors p-0 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 bg-gray-50">
          <span className="text-sm font-medium text-gray-600">
            {sourceLangObj?.flag} {sourceLangObj?.englishName}
          </span>
          <div className="flex items-center gap-2">
            <span className={`text-xs ${inputText.length > charLimit * 0.9 ? 'text-red-500' : 'text-gray-400'}`}>
              {inputText.length}/{charLimit}
            </span>
            {inputText && (
              <button onClick={reset} className="p-1 rounded-lg text-gray-400 hover:text-gray-600">
                <RotateCcw size={14} />
              </button>
            )}
          </div>
        </div>
        <div className="relative">
          <textarea
            className="w-full px-4 py-3 text-gray-800 resize-none focus:outline-none bg-white min-h-[140px]"
            placeholder={`Enter text in ${sourceLangObj?.englishName}... (supports ${sourceLangObj?.script} script)`}
            value={inputText}
            onChange={(e) => setInputText(e.target.value.slice(0, charLimit))}
          />
          {/* Voice input */}
          <div className="absolute bottom-3 right-3">
            <VoiceButton
              onTranscript={(t) => setInputText(t)}
              language={sourceLang}
              className="p-2.5"
            />
          </div>
        </div>
      </div>

      {/* Translate Button */}
      <button
        onClick={handleTranslate}
        disabled={loading || !inputText.trim()}
        className="btn-primary w-full flex items-center justify-center gap-2 py-3.5 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <LoadingSpinner size="sm" />
        ) : (
          <>
            <Sparkles size={18} />
            {t('translateBtn')}
          </>
        )}
      </button>

      {/* Output Area */}
      {outputText && (
        <div className="card border-2 border-primary-200 p-0 overflow-hidden animate-slide-up">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-primary-100 bg-primary-50">
            <span className="text-sm font-medium text-primary-700">
              {targetLangObj?.flag} {targetLangObj?.englishName} Translation
            </span>
            <div className="flex items-center gap-2">
              {confidence !== null && (
                <span className="badge-green text-xs">{Math.round(confidence * 100)}% confidence</span>
              )}
              <button
                onClick={speakOutput}
                className="p-1.5 rounded-lg text-primary-600 hover:bg-primary-100 transition-colors"
                title="Listen"
              >
                <Volume2 size={16} />
              </button>
              <button
                onClick={copyOutput}
                className="p-1.5 rounded-lg text-primary-600 hover:bg-primary-100 transition-colors"
                title="Copy"
              >
                <Copy size={16} />
              </button>
            </div>
          </div>
          <div className="px-4 py-3 min-h-[100px]">
            <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">{outputText}</p>
          </div>
        </div>
      )}

      {/* Quick Phrases */}
      <section>
        <h3 className="font-semibold text-gray-700 text-sm mb-3">💡 {t('quickPhrases')}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {QUICK_PHRASE_KEYS.map((key) => (
            <button
              key={key}
              onClick={() => setInputText(t(key))}
              className="text-left px-3 py-2.5 rounded-xl bg-gray-50 hover:bg-primary-50 
                border border-gray-200 hover:border-primary-300 text-sm text-gray-600 
                hover:text-primary-700 transition-all"
            >
              {t(key)}
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}

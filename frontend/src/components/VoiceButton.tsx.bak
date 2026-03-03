import { useState, useCallback } from 'react'
import { Mic, MicOff, Square } from 'lucide-react'
import toast from 'react-hot-toast'

interface VoiceButtonProps {
  onTranscript: (text: string) => void
  language?: string
  className?: string
}

export default function VoiceButton({ onTranscript, language = 'en', className = '' }: VoiceButtonProps) {
  const [listening, setListening] = useState(false)
  const [recognition, setRecognition] = useState<SpeechRecognition | null>(null)

  const startListening = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      toast.error('Voice input not supported in this browser')
      return
    }

    const rec = new SpeechRecognition()
    rec.continuous = false
    rec.interimResults = false
    rec.lang = getLocaleFromLanguage(language)
    rec.maxAlternatives = 1

    rec.onresult = (event) => {
      const transcript = event.results[0][0].transcript
      onTranscript(transcript)
      setListening(false)
    }

    rec.onerror = (event) => {
      if (event.error !== 'no-speech') {
        toast.error('Voice recognition error. Please try again.')
      }
      setListening(false)
    }

    rec.onend = () => setListening(false)
    rec.start()
    setRecognition(rec)
    setListening(true)
    toast('Listening... Speak now', { icon: '🎤' })
  }, [language, onTranscript])

  const stopListening = () => {
    recognition?.stop()
    setListening(false)
  }

  return (
    <button
      type="button"
      onClick={listening ? stopListening : startListening}
      className={`flex items-center justify-center rounded-xl transition-all duration-200 ${
        listening
          ? 'bg-red-500 hover:bg-red-600 text-white recording-pulse shadow-lg'
          : 'bg-primary-100 hover:bg-primary-200 text-primary-700'
      } ${className}`}
      title={listening ? 'Stop recording' : 'Start voice input'}
    >
      {listening ? <Square size={18} /> : <Mic size={18} />}
    </button>
  )
}

function getLocaleFromLanguage(code: string): string {
  const localeMap: Record<string, string> = {
    hi: 'hi-IN', bn: 'bn-IN', te: 'te-IN', mr: 'mr-IN', ta: 'ta-IN',
    gu: 'gu-IN', kn: 'kn-IN', ml: 'ml-IN', pa: 'pa-IN', or: 'or-IN',
    en: 'en-IN', ur: 'ur-PK', ne: 'ne-NP', si: 'si-LK',
  }
  return localeMap[code] || 'en-IN'
}

// Extend browser types
declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition
    webkitSpeechRecognition: typeof SpeechRecognition
  }
}

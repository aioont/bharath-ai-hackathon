import { useRef } from 'react'
import { motion } from 'framer-motion'
import { Mic, MicOff } from 'lucide-react'
import toast from 'react-hot-toast'

interface VoiceButtonProps {
  onTranscript: (text: string) => void
  isListening: boolean
  setIsListening: (val: boolean) => void
  language?: string
  className?: string
  disabled?: boolean
  onDetectedLanguage?: (langCode: string) => void  // called after transcript with detected 2-letter code
}

export default function VoiceButton({
  onTranscript,
  isListening,
  setIsListening,
  language = 'en-IN',
  className = '',
  disabled = false,
  onDetectedLanguage,
}: VoiceButtonProps) {
  const recognitionRef = useRef<SpeechRecognition | null>(null)

  const startListening = () => {
    // Check browser support
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      toast.error('Voice input not supported in this browser')
      return
    }

    if (isListening) {
      stopListening()
      return
    }

    try {
      const rec = new SpeechRecognition()
      rec.continuous = false
      rec.interimResults = true // improved feedback
      rec.lang = language
      rec.maxAlternatives = 1

      rec.onstart = () => {
        setIsListening(true)
      }

      rec.onresult = (event) => {
        const transcript = event.results[0][0].transcript
        if (event.results[0].isFinal) {
          onTranscript(transcript)
          // Detect language from recognition and forward it
          if (onDetectedLanguage) {
            const recLang: string = (rec as unknown as { lang: string }).lang || language
            // Convert BCP-47 (e.g. 'hi-IN') → 2-letter code (e.g. 'hi')
            const twoLetter = recLang.split('-')[0].toLowerCase()
            onDetectedLanguage(twoLetter)
          }
          stopListening()
        }
      }

      rec.onerror = (event) => {
        console.error('Speech recognition error', event.error)
        if (event.error === 'not-allowed') {
          toast.error('Microphone permission denied')
        } else if (event.error === 'network') {
          toast.error('Voice input network error. Check connection or try Chrome.')
        } else if (event.error === 'no-speech') {
            // Ignore no-speech errors, just stop listening silently
        } else {
            toast.error(`Voice error: ${event.error}`)
        }
        stopListening()
      }

      rec.onend = () => {
        setIsListening(false)
      }

      rec.start()
      recognitionRef.current = rec
    } catch (err) {
      console.error(err)
      setIsListening(false)
    }
  }

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
    }
    setIsListening(false)
  }

  return (
    <motion.button
      whileTap={{ scale: 0.9 }}
      onClick={startListening}
      disabled={disabled}
      className={`relative p-3 rounded-full transition-all duration-300 shadow-lg ${isListening
        ? 'bg-red-500 text-white hover:bg-red-600 shadow-red-500/30'
        : 'bg-green-600 text-white hover:bg-green-700 shadow-green-600/30'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
      aria-label={isListening ? 'Stop recording' : 'Start voice input'}
    >
      {isListening && (
        <span className="absolute inset-0 rounded-full border-4 border-red-200 animate-ping opacity-75"></span>
      )}

      {isListening ? <MicOff className="w-6 h-6 z-10 relative" /> : <Mic className="w-6 h-6 z-10 relative" />}
    </motion.button>
  )
}

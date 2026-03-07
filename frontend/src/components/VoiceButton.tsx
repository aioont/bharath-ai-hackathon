import { useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Mic, MicOff } from 'lucide-react'
import toast from 'react-hot-toast'

interface VoiceButtonProps {
  onTranscript: (text: string) => void
  onInterimTranscript?: (text: string) => void // live preview while speaking
  onStart?: () => void                          // called right before recording starts
  isListening: boolean
  setIsListening: (val: boolean) => void
  language?: string
  className?: string
  disabled?: boolean
  onDetectedLanguage?: (langCode: string) => void
}

export default function VoiceButton({
  onTranscript,
  onInterimTranscript,
  onStart,
  isListening,
  setIsListening,
  language = 'en-IN',
  className = '',
  disabled = false,
  onDetectedLanguage,
}: VoiceButtonProps) {
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const finalizedRef = useRef(false) // guard against duplicate onTranscript calls

  // When the parent drives isListening to false (e.g. on message send), stop the
  // active recognition session so the mic actually turns off.
  useEffect(() => {
    if (!isListening && recognitionRef.current) {
      try { recognitionRef.current.stop() } catch { /* already stopped */ }
      recognitionRef.current = null
    }
  }, [isListening])

  const stopListening = (silent = false) => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop() } catch { /* already stopped */ }
      recognitionRef.current = null
    }
    if (!silent) setIsListening(false)
  }

  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      toast.error('Voice input not supported in this browser. Try Chrome or Edge.')
      return
    }

    // Toggle off if already listening
    if (isListening) {
      stopListening()
      return
    }

    // Clear input box first before we start
    onStart?.()

    finalizedRef.current = false

    try {
      const rec = new SpeechRecognition()
      rec.continuous = true        // keep open until user stops or sentence finishes
      rec.interimResults = true    // stream partial results
      rec.lang = language
      rec.maxAlternatives = 3      // pick best alternative

      rec.onstart = () => {
        setIsListening(true)
      }

      rec.onresult = (event) => {
        // Walk ALL results (0..length) to build accumulated text — not just
        // event.resultIndex onwards, which would miss earlier finalized words
        // and cause the preview to jump/reset mid-sentence.
        let accumulatedFinal = ''
        let interimText = ''
        let newFinalText = '' // only segments that became final in THIS event

        for (let i = 0; i < event.results.length; i++) {
          const result = event.results[i]
          if (result.isFinal) {
            // Pick the highest-confidence alternative
            let best = result[0].transcript
            let bestConf = result[0].confidence ?? 0
            for (let j = 1; j < result.length; j++) {
              const conf = result[j].confidence ?? 0
              if (conf > bestConf) { bestConf = conf; best = result[j].transcript }
            }
            accumulatedFinal += best
            // Track segments that are *newly* final in this event
            if (i >= event.resultIndex) newFinalText += best
          } else {
            interimText += result[0].transcript
          }
        }

        // Live preview = everything recognised so far (finals + current interim)
        if (onInterimTranscript) {
          const preview = (accumulatedFinal + (interimText ? ' ' + interimText : '')).trim()
          if (preview) onInterimTranscript(preview)
        }

        // Commit once a new final segment arrives, then stop
        if (newFinalText && !finalizedRef.current) {
          finalizedRef.current = true
          onTranscript(accumulatedFinal.trim()) // send full accumulated text
          if (onDetectedLanguage) {
            const twoLetter = language.split('-')[0].toLowerCase()
            onDetectedLanguage(twoLetter)
          }
          stopListening()
        }
      }

      rec.onerror = (event) => {
        if (event.error === 'not-allowed') {
          toast.error('Microphone permission denied. Please allow mic access.')
          stopListening()
        } else if (event.error === 'network') {
          toast.error('Voice input network error. Check your connection.')
          stopListening()
        } else if (event.error === 'no-speech') {
          // Clean up current session
          if (recognitionRef.current) {
            try { recognitionRef.current.stop() } catch { /* ignore */ }
            recognitionRef.current = null
          }
          // IMPORTANT: reset isListening to false BEFORE restarting.
          // Without this, startListening() sees isListening=true, treats it as
          // a toggle-off, calls stopListening(), and returns — mic never restarts.
          setIsListening(false)
          setTimeout(() => {
            if (!finalizedRef.current) startListening()
          }, 350)
        } else if (event.error !== 'aborted') {
          toast.error(`Voice error: ${event.error}`)
          stopListening()
        }
      }

      rec.onend = () => {
        // Only set not-listening if we haven't already scheduled a restart
        if (finalizedRef.current || recognitionRef.current === null) {
          setIsListening(false)
        }
      }

      rec.start()
      recognitionRef.current = rec
    } catch (err) {
      console.error(err)
      setIsListening(false)
    }
  }

  return (
    <motion.button
      whileTap={{ scale: 0.9 }}
      onClick={startListening}
      disabled={disabled}
      className={`relative p-3 rounded-full transition-all duration-300 shadow-lg ${
        isListening
          ? 'bg-red-500 text-white hover:bg-red-600 shadow-red-500/30'
          : 'bg-green-600 text-white hover:bg-green-700 shadow-green-600/30'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
      title={isListening ? 'Tap to stop recording' : 'Tap to speak in ' + language}
      aria-label={isListening ? 'Stop recording' : 'Start voice input'}
    >
      {/* Outer pulse ring */}
      {isListening && (
        <span className="absolute inset-0 rounded-full border-4 border-red-300 animate-ping opacity-60" />
      )}
      {/* Second slower ring for depth */}
      {isListening && (
        <span className="absolute inset-0 rounded-full border-2 border-red-200 animate-pulse opacity-40" />
      )}

      {isListening ? <MicOff className="w-6 h-6 z-10 relative" /> : <Mic className="w-6 h-6 z-10 relative" />}
    </motion.button>
  )
}

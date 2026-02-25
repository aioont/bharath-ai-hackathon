import { User, Copy, Volume2 } from 'lucide-react'
import toast from 'react-hot-toast'
import type { ChatMessage } from '@/services/api'

interface ChatMessageProps {
  message: ChatMessage
  isLatest?: boolean
}

export default function ChatMessageBubble({ message }: ChatMessageProps) {
  const isUser = message.role === 'user'

  const copyText = () => {
    navigator.clipboard.writeText(message.content)
    toast.success('Copied to clipboard')
  }

  const speak = () => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(message.content)
      window.speechSynthesis.speak(utterance)
    }
  }

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'} items-end mb-4`}>
      {/* Avatar */}
      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
        isUser ? 'bg-primary-600 text-white' : message.isError ? 'bg-red-100' : 'bg-earth-100'
      }`}>
        {isUser ? <User size={16} /> : message.isError ? <span className="text-base">⚠️</span> : <span className="text-base">🌾</span>}
      </div>

      <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-[80%]`}>
        {/* Bubble */}
        <div className={isUser ? 'chat-bubble-user' : message.isError ? 'bg-red-50 border border-red-200 text-red-800 rounded-2xl rounded-bl-none px-4 py-3' : 'chat-bubble-ai'}>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
          {message.isError && (
            <p className="text-xs text-red-500 mt-1">Please ensure the backend is running and try again.</p>
          )}
        </div>

        {/* Actions */}
        <div className={`flex items-center gap-2 mt-1 ${isUser ? 'flex-row-reverse' : ''}`}>
          {message.timestamp && (
            <span className="text-[10px] text-gray-400">
              {new Date(message.timestamp).toLocaleTimeString('en-IN', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          )}
          {!isUser && (
            <>
              <button
                onClick={copyText}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                title="Copy"
              >
                <Copy size={12} />
              </button>
              <button
                onClick={speak}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                title="Read aloud"
              >
                <Volume2 size={12} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export function TypingIndicator() {
  return (
    <div className="flex gap-3 items-end mb-4">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-earth-100 flex items-center justify-center text-base">
        🌾
      </div>
      <div className="chat-bubble-ai">
        <div className="flex gap-1.5 items-center py-0.5">
          {[0, 150, 300].map((delay) => (
            <span
              key={delay}
              className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"
              style={{ animationDelay: `${delay}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

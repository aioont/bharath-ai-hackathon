import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { User, Copy, Volume2 } from 'lucide-react'
import toast from 'react-hot-toast'
import type { ChatMessage } from '@/services/api'
import AudioPlayer from './AudioPlayer'

interface ChatMessageProps {
  message: ChatMessage & { audioBase64?: string; audioFormat?: string }
  isLatest?: boolean
}

// ── Strip markdown syntax for TTS so the AI doesn't read "asterisk asterisk"
function stripMarkdown(text: string): string {
  return text
    .replace(/#{1,6}\s*/g, '')          // headings
    .replace(/\*\*([^*]+)\*\*/g, '$1') // bold
    .replace(/\*([^*]+)\*/g, '$1')     // italic
    .replace(/__([^_]+)__/g, '$1')     // bold
    .replace(/_([^_]+)_/g, '$1')       // italic
    .replace(/~~([^~]+)~~/g, '$1')     // strikethrough
    .replace(/`{1,3}[^`]*`{1,3}/g, '') // inline code + code blocks
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links → label only
    .replace(/^[-*+]\s+/gm, '')        // unordered list bullets
    .replace(/^\d+\.\s+/gm, '')        // ordered list numbers
    .replace(/^>\s+/gm, '')            // blockquotes
    .replace(/[-]{3,}/g, '')           // horizontal rules
    .replace(/\n{2,}/g, ' ')           // collapse blank lines
    .trim()
}

export default function ChatMessageBubble({ message }: ChatMessageProps) {
  const isUser = message.role === 'user'

  const copyText = () => {
    navigator.clipboard.writeText(message.content)
    toast.success('Copied to clipboard')
  }

  const speak = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      const clean = stripMarkdown(message.content)
      const utterance = new SpeechSynthesisUtterance(clean)
      utterance.lang = 'hi-IN'           // adjust if you have lang on message
      window.speechSynthesis.speak(utterance)
    }
  }

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'} items-end mb-4`}>
      {/* Avatar */}
      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${isUser ? 'bg-primary-600 text-white' : message.isError ? 'bg-red-100' : 'bg-earth-100'
        }`}>
        {isUser ? <User size={16} /> : message.isError ? <span className="text-base">⚠️</span> : <span className="text-base">🌾</span>}
      </div>

      <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-[80%]`}>
        {/* Bubble */}
        <div className={
          isUser
            ? 'chat-bubble-user'
            : message.isError
              ? 'bg-red-50 border border-red-200 text-red-800 rounded-2xl rounded-bl-none px-4 py-3'
              : 'chat-bubble-ai'
        }>
          {isUser ? (
            // User messages: plain text (no markdown needed)
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
          ) : (
            // AI messages: rendered markdown
            <div className="text-sm leading-relaxed prose prose-sm prose-green max-w-none
              prose-headings:font-semibold prose-headings:text-gray-800 prose-headings:mb-1 prose-headings:mt-2
              prose-p:mb-2 prose-p:leading-relaxed
              prose-ul:pl-4 prose-ul:list-disc prose-ul:mb-2
              prose-ol:pl-4 prose-ol:list-decimal prose-ol:mb-2
              prose-li:mb-0.5
              prose-strong:text-gray-800 prose-strong:font-semibold
              prose-em:italic
              prose-code:bg-gray-100 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:text-gray-700
              prose-pre:bg-gray-800 prose-pre:text-gray-100 prose-pre:rounded-xl prose-pre:text-xs prose-pre:p-3
              prose-blockquote:border-l-2 prose-blockquote:border-green-400 prose-blockquote:pl-3 prose-blockquote:text-gray-600
              prose-a:text-green-700 prose-a:underline
              prose-hr:border-gray-200
            ">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.content}
              </ReactMarkdown>
            </div>
          )}

          {message.isError && (
            <p className="text-xs text-red-500 mt-1">Please ensure the backend is running and try again.</p>
          )}

          {/* Audio Player (WhatsApp style) */}
          {message.audioBase64 && (
            <div className="mt-3 -mx-2 mb-[-6px]">
              <AudioPlayer 
                audioBase64={message.audioBase64} 
                format={message.audioFormat} 
              />
            </div>
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
              {!message.audioBase64 && (
                <button
                  onClick={speak}
                  className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                  title="Read aloud"
                >
                  <Volume2 size={12} />
                </button>
              )}
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

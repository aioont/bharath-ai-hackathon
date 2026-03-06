import { useState } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { SUPPORTED_LANGUAGES } from '@/utils/constants'
import { useAppContext } from '@/context/AppContext'
import type { Language } from '@/context/AppContext'

interface LanguageSelectorProps {
  compact?: boolean
  value?: string
  onChange?: (lang: Language) => void
  label?: string
}

export default function LanguageSelector({ compact, value, onChange, label }: LanguageSelectorProps) {
  const { state, setLanguage } = useAppContext()
  const [open, setOpen] = useState(false)

  const currentCode = value ?? state.selectedLanguage.code
  const current = SUPPORTED_LANGUAGES.find((l) => l.code === currentCode) || SUPPORTED_LANGUAGES[0]

  const handleSelect = (lang: Language) => {
    setOpen(false)
    if (onChange) {
      onChange(lang)
    } else {
      setLanguage(lang)
    }
  }

  return (
    <div className="relative">
      {label && <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1 w-full bg-white border-2 border-gray-200 rounded-xl 
          hover:border-primary-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 
          transition-all duration-200 ${compact ? 'px-2 py-1 text-sm' : 'px-3 py-2'}`}
      >
        <div className="flex-1 text-left min-w-0">
          <div className="font-sm text-gray-800 truncate text-sm leading-none mb-0.5">{current.englishName}</div>
          <div className="text-gray-500 text-xs truncate">{current.name}</div>
        </div>
        <ChevronDown size={16} className={`text-gray-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 top-full left-0 right-0 mt-1.5 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden max-h-72 overflow-y-auto">
            {SUPPORTED_LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                type="button"
                onClick={() => handleSelect(lang)}
                className={`flex items-center gap-3 w-full px-4 py-3 text-left hover:bg-primary-50 
                  transition-colors text-sm ${lang.code === currentCode ? 'bg-primary-50' : ''}`}
              >
                <span className="text-xl">{lang.flag}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-800 text-sm">{lang.englishName}</div>
                  <div className="text-gray-500 text-xs">{lang.name}</div>
                </div>
                {lang.code === currentCode && <Check size={16} className="text-primary-600 flex-shrink-0" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

import { useState, useRef, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { ShieldCheck, RefreshCw } from 'lucide-react'
import { verifyEmail, resendVerification } from '@/services/api'
import { useAppContext } from '@/context/AppContext'
import toast from 'react-hot-toast'

export default function VerifyEmail() {
  const { setAuth } = useAppContext()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const email = params.get('email') || ''

  const [code, setCode] = useState<string[]>(Array(6).fill(''))
  const inputRefs = useRef<Array<HTMLInputElement | null>>(Array(6).fill(null))
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)

  // Focus first input on mount
  useEffect(() => inputRefs.current[0]?.focus(), [])

  const handleChange = (idx: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1)
    const next = [...code]
    next[idx] = digit
    setCode(next)
    if (digit && idx < 5) inputRefs.current[idx + 1]?.focus()
    // Auto-submit when all 6 digits entered
    if (digit && idx === 5 && next.every(Boolean)) {
      handleVerify(next.join(''))
    }
  }

  const handleKeyDown = (idx: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[idx] && idx > 0) {
      inputRefs.current[idx - 1]?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (pasted.length === 6) {
      const next = pasted.split('')
      setCode(next)
      inputRefs.current[5]?.focus()
      handleVerify(pasted)
    }
  }

  const handleVerify = async (codeStr: string) => {
    if (codeStr.length !== 6) return toast.error('Please enter all 6 digits.')
    if (!email) return toast.error('Email address is missing. Please register again.')
    setLoading(true)
    try {
      const res = await verifyEmail(email, codeStr)
      setAuth(res.user, res.access_token)
      toast.success('Email verified! Welcome to Agri-Translate AI 🌾')
      navigate('/profile')
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Invalid or expired code.'
      toast.error(msg)
      setCode(Array(6).fill(''))
      inputRefs.current[0]?.focus()
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    if (!email) return
    setResending(true)
    try {
      await resendVerification(email)
      toast.success('A new code has been sent to your email.')
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Could not resend code.'
      toast.error(msg)
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 animate-fade-in">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-2xl mb-3">
            <ShieldCheck size={32} className="text-green-700" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Verify your email</h1>
          <p className="text-sm text-gray-500 mt-1">
            We sent a 6-digit code to<br />
            <span className="font-semibold text-gray-800">{email}</span>
          </p>
        </div>

        <div className="card space-y-6">
          {/* 6-digit OTP input */}
          <div
            className="flex gap-2 justify-center"
            onPaste={handlePaste}
          >
            {code.map((digit, idx) => (
              <input
                key={idx}
                ref={(el) => { inputRefs.current[idx] = el }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(idx, e.target.value)}
                onKeyDown={(e) => handleKeyDown(idx, e)}
                className={`w-11 h-13 text-center text-xl font-bold rounded-xl border-2 outline-none transition-colors
                  ${digit ? 'border-primary-500 bg-primary-50' : 'border-gray-200 bg-gray-50'}
                  focus:border-primary-500 focus:bg-white`}
                style={{ height: '52px' }}
              />
            ))}
          </div>

          <button
            onClick={() => handleVerify(code.join(''))}
            disabled={loading || code.filter(Boolean).length < 6}
            className="btn-primary w-full flex items-center justify-center gap-2 py-3"
          >
            {loading ? (
              <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
            ) : null}
            {loading ? 'Verifying…' : 'Verify Email'}
          </button>

          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>Didn't receive the code?</span>
            <button
              onClick={handleResend}
              disabled={resending}
              className="flex items-center gap-1 text-primary-600 font-semibold hover:underline disabled:opacity-50"
            >
              <RefreshCw size={12} className={resending ? 'animate-spin' : ''} />
              {resending ? 'Sending…' : 'Resend'}
            </button>
          </div>

          <p className="text-center text-xs text-gray-400">
            Wrong email?{' '}
            <Link to="/register" className="text-primary-600 hover:underline">Register again</Link>
          </p>
        </div>
      </div>
    </div>
  )
}

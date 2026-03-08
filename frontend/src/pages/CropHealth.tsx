import { useState, useCallback, useEffect, useRef } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, ImageIcon, AlertTriangle, CheckCircle, Leaf, Lightbulb, Zap } from 'lucide-react'
import toast from 'react-hot-toast'
import { analyzeCropHealth, getCropModelStatus, startCropModel } from '@/services/api'
import type { CropHealthResponse } from '@/services/api'
import LoadingSpinner from '@/components/LoadingSpinner'
import { DISEASE_SEVERITY, CROP_CATEGORIES } from '@/utils/constants'
import { useAppContext } from '@/context/AppContext'

export default function CropHealth() {
  const { state, t } = useAppContext()
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<CropHealthResponse | null>(null)
  const [selectedCrop, setSelectedCrop] = useState('')
  const [modelStatus, setModelStatus] = useState<string>('UNKNOWN')
  const [modelMessage, setModelMessage] = useState<string>('Checking model…')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
  }

  const fetchModelStatus = useCallback(async () => {
    try {
      const s = await getCropModelStatus()
      setModelStatus(s.status)
      setModelMessage(s.message)
      if (s.status === 'RUNNING' || s.status === 'FAILED' || s.status === 'UNAVAILABLE') {
        stopPolling()
      }
    } catch { /* silent */ }
  }, [])

  // On mount: fetch status + start polling while not RUNNING
  useEffect(() => {
    fetchModelStatus()
    pollRef.current = setInterval(fetchModelStatus, 8000)
    return () => stopPolling()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleStartModel = async () => {
    try {
      await startCropModel()
      setModelStatus('STARTING')
      setModelMessage('🟡 Model warming up — takes 2-3 min (AI fallback active)')
      if (!pollRef.current) pollRef.current = setInterval(fetchModelStatus, 8000)
    } catch { toast.error('Could not start model') }
  }

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image too large. Please upload an image under 10MB.')
      return
    }
    setImageFile(file)
    const preview = URL.createObjectURL(file)
    setImagePreview(preview)
    setResult(null)
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.webp', '.heic'] },
    maxFiles: 1,
  })

  const analyzeImage = async () => {
    if (!imageFile) {
      toast.error('Please upload a crop image first')
      return
    }
    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('image', imageFile)
      formData.append('language', state.selectedLanguage.code)
      if (selectedCrop) formData.append('crop_name', selectedCrop)
      const data = await analyzeCropHealth(formData)
      setResult(data)
      // Refresh model status badge after successful analysis
      fetchModelStatus()
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number; data?: { detail?: string } } }
      if (axiosErr?.response?.status === 503) {
        toast('Custom model warming up — showing AI analysis fallback', { icon: '⚡' })
      } else if (axiosErr?.response?.status === 400) {
        toast.error(axiosErr.response.data?.detail ?? 'Invalid image')
      } else {
        // Demo fallback
        setResult({
          disease_name: 'Early Blight (Demo)',
          confidence: 0.87,
          severity: 'medium',
          description: 'Early blight is a common fungal disease caused by Alternaria solani. This is a demo response — connect to Sarvam Vision for real analysis.',
          symptoms: [
            'Brown circular spots with concentric rings (target-like appearance)',
            'Yellow halo surrounding the lesions',
            'Premature leaf drop in severe cases',
            'Dark brown lesions on stem and fruit',
          ],
          treatment: [
            'Apply copper-based fungicides (Copper Oxychloride @ 3g/L)',
            'Use Mancozeb 75% WP @ 2g/L spray every 7-10 days',
            'Remove and destroy infected plant debris',
            'Ensure proper plant spacing for air circulation',
          ],
          prevention: [
            'Use certified disease-resistant varieties',
            'Practice crop rotation (avoid planting solanaceous crops in same field)',
            'Avoid overhead irrigation; use drip irrigation',
            'Maintain proper field sanitation',
            'Apply balanced nutrition to strengthen plants',
          ],
          affected_crops: ['Tomato', 'Potato', 'Brinjal', 'Pepper'],
        })
        toast('Demo analysis shown. Add SARVAM_API_KEY for real AI diagnosis.', { icon: 'ℹ️' })
      }
    } finally {
      setLoading(false)
    }
  }

  const severityConfig = result ? DISEASE_SEVERITY[result.severity] : null

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="section-title flex items-center gap-2">
          <span>🌿</span> {t('cropHealthTitle')}
        </h1>
        <p className="section-subtitle">
          Upload a photo of your crop to identify diseases and get AI-powered treatment recommendations
        </p>
      </div>

      {/* Model Status Banner */}
      <div className={`flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl border text-xs font-medium ${
        modelStatus === 'RUNNING' ? 'bg-green-50 border-green-200 text-green-800' :
        modelStatus === 'STARTING' ? 'bg-amber-50 border-amber-200 text-amber-800' :
        modelStatus === 'UNAVAILABLE' ? 'bg-gray-50 border-gray-200 text-gray-500' :
        modelStatus === 'FAILED' ? 'bg-red-50 border-red-200 text-red-700' :
        'bg-gray-50 border-gray-200 text-gray-600'
      }`}>
        <span className="flex items-center gap-2">
          {modelStatus === 'STARTING' && <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />}
          {modelStatus === 'RUNNING' && <span className="w-2 h-2 rounded-full bg-green-500" />}
          {!['RUNNING','STARTING'].includes(modelStatus) && <span className="w-2 h-2 rounded-full bg-gray-300" />}
          {modelMessage}
        </span>
        {(modelStatus === 'STOPPED' || modelStatus === 'UNKNOWN') && (
          <button
            onClick={handleStartModel}
            className="flex items-center gap-1 px-2.5 py-1 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Zap size={11} /> Start Model
          </button>
        )}
      </div>

      {/* Crop Type Selector */}
      <div>
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block">
          Select Crop Type (Optional - for better accuracy)
        </label>
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
          {CROP_CATEGORIES.flatMap((cat) => cat.crops.slice(0, 3)).slice(0, 10).map((crop) => (
            <button
              key={crop}
              onClick={() => setSelectedCrop(crop === selectedCrop ? '' : crop)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium border-2 transition-all ${
                selectedCrop === crop
                  ? 'bg-primary-600 text-white border-primary-600'
                  : 'bg-white text-gray-500 border-gray-200 hover:border-primary-300'
              }`}
            >
              {crop}
            </button>
          ))}
        </div>
      </div>

      {/* Upload Area */}
      <div
        {...getRootProps()}
        className={`relative border-3 border-dashed rounded-2xl transition-all cursor-pointer ${
          isDragActive
            ? 'border-primary-500 bg-primary-50 scale-[1.01]'
            : 'border-gray-300 bg-gray-50 hover:border-primary-400 hover:bg-primary-50/50'
        }`}
      >
        <input {...getInputProps()} />
        {imagePreview ? (
          <div className="p-4">
            <div className="relative">
              <img
                src={imagePreview}
                alt="Crop preview"
                className="w-full max-h-72 object-cover rounded-xl shadow-md"
              />
              <div className="absolute top-2 right-2">
                <span className="badge-green text-xs">📷 {imageFile?.name}</span>
              </div>
            </div>
            <p className="text-center text-sm text-gray-500 mt-3">Click or drag to replace image</p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
            <div className="w-16 h-16 bg-primary-100 rounded-2xl flex items-center justify-center mb-4">
              {isDragActive ? <Upload size={32} className="text-primary-600 animate-bounce" /> : <ImageIcon size={32} className="text-primary-500" />}
            </div>
            <h3 className="font-semibold text-gray-700 mb-2">
              {isDragActive ? 'Drop your crop image here' : t('uploadPhoto')}
            </h3>
            <p className="text-sm text-gray-500 max-w-xs">
              Drag & drop or click to select. Take a clear photo of the affected leaf, stem, or fruit.
            </p>
            <p className="text-xs text-gray-400 mt-2">Supports JPG, PNG, WebP • Max 10MB</p>
          </div>
        )}
      </div>

      {/* Camera capture on mobile */}
      <label className="btn-secondary w-full flex items-center justify-center gap-2 cursor-pointer">
        📷 {t('takePhoto')}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) {
              setImageFile(file)
              setImagePreview(URL.createObjectURL(file))
              setResult(null)
            }
          }}
        />
      </label>

      {/* Analyze Button */}
      <button
        onClick={analyzeImage}
        disabled={loading || !imageFile}
        className="btn-primary w-full flex items-center justify-center gap-2 py-3.5 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <LoadingSpinner size="sm" text="Analyzing with Sarvam Vision..." />
        ) : (
          <>
            <Leaf size={18} />
            {t('analyzeCropHealth')}
          </>
        )}
      </button>

      {/* Results */}
      {result && (
        <div className="space-y-4 animate-slide-up">
          {/* Raw Custom Label Detections */}
          {result.raw_labels && result.raw_labels.length > 0 && (
            <div className="card border border-violet-100 bg-violet-50">
              <h3 className="font-semibold text-violet-800 flex items-center gap-2 mb-3">
                <Zap size={16} className="text-violet-600" /> Custom Model Detections
                <span className="ml-auto text-xs font-normal text-violet-500">AWS Rekognition</span>
              </h3>
              <div className="space-y-2">
                {result.raw_labels.map((lbl, i) => (
                  <div key={i}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium text-violet-900">{lbl.name}</span>
                      <span className="text-violet-600">{Math.round(lbl.confidence * 100)}%</span>
                    </div>
                    <div className="h-1.5 bg-violet-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-violet-500 to-purple-600 rounded-full transition-all"
                        style={{ width: `${Math.round(lbl.confidence * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Analysis source badge */}
          {result.model_source && (
            <div className="flex items-center gap-2 text-xs text-gray-400 px-1">
              <span className={`w-2 h-2 rounded-full ${
                result.model_source === 'rekognition_custom' ? 'bg-violet-500' :
                result.model_source === 'rekognition_general' ? 'bg-blue-400' : 'bg-gray-300'
              }`} />
              {result.model_source === 'rekognition_custom' && 'Analysed by Rekognition Custom Disease Model + Nova AI'}
              {result.model_source === 'rekognition_general' && 'Analysed by Rekognition General Labels + Nova AI'}
              {result.model_source === 'fallback' && 'AI text analysis (model offline)'}
            </div>
          )}

          {/* Disease Header */}
          <div className={`card border-2 ${severityConfig?.color.split('bg-')[1] ? 'border-' + severityConfig?.color.split('border-')[1] : 'border-gray-200'}`}>
            <div className="flex items-start gap-4">
              <div className="text-4xl">
                {result.severity === 'high' ? '🚨' : result.severity === 'medium' ? '⚠️' : '✅'}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <h2 className="text-lg font-bold text-gray-900">{result.disease_name}</h2>
                  <span className={`badge border text-xs ${severityConfig?.color}`}>
                    {severityConfig?.label} Severity
                  </span>
                  <span className="badge-blue text-xs">
                    {Math.round(result.confidence * 100)}% confidence
                  </span>
                </div>
                <p className="text-sm text-gray-600">{result.description}</p>
                {result.affected_crops.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {result.affected_crops.map((c) => (
                      <span key={c} className="badge bg-gray-100 text-gray-600 text-xs">{c}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Symptoms */}
          <div className="card">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2 mb-3">
              <AlertTriangle size={16} className="text-orange-500" /> Symptoms
            </h3>
            <ul className="space-y-2">
              {result.symptoms.map((s, i) => (
                <li key={i} className="flex gap-2 text-sm text-gray-700">
                  <span className="text-orange-400 flex-shrink-0">•</span>
                  {s}
                </li>
              ))}
            </ul>
          </div>

          {/* Treatment */}
          <div className="card border-l-4 border-l-primary-500">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2 mb-3">
              <CheckCircle size={16} className="text-primary-600" /> Treatment Plan
            </h3>
            <ul className="space-y-2">
              {result.treatment.map((t, i) => (
                <li key={i} className="flex gap-2 text-sm text-gray-700">
                  <span className="w-5 h-5 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {i + 1}
                  </span>
                  {t}
                </li>
              ))}
            </ul>
          </div>

          {/* Prevention */}
          <div className="card bg-primary-50 border border-primary-100">
            <h3 className="font-semibold text-primary-800 flex items-center gap-2 mb-3">
              <Lightbulb size={16} className="text-primary-600" /> Prevention Measures
            </h3>
            <ul className="space-y-2">
              {result.prevention.map((p, i) => (
                <li key={i} className="flex gap-2 text-sm text-primary-700">
                  <span className="text-primary-500 flex-shrink-0">✓</span>
                  {p}
                </li>
              ))}
            </ul>
          </div>

          {/* Share button */}
          <button
            onClick={() => {
              const text = `Crop Disease Detected: ${result.disease_name}\nSeverity: ${result.severity}\n\nTreatment:\n${result.treatment.join('\n')}`
              if (navigator.share) {
                navigator.share({ title: 'Crop Health Report', text })
              } else {
                navigator.clipboard.writeText(text)
                toast.success('Health report copied to clipboard')
              }
            }}
            className="btn-secondary w-full"
          >
            📤 {t('shareHealthReport')}
          </button>
        </div>
      )}

      {/* Tips */}
      {!result && (
        <div className="card bg-gradient-to-br from-primary-50 to-earth-50 border border-primary-100">
          <h3 className="font-semibold text-gray-800 mb-3">📸 {t('tipsBetterDiagnosis')}</h3>
          <ul className="space-y-2 text-sm text-gray-600">
            {[
              'Take photos in good natural daylight',
              'Focus on affected leaves, stems, or fruits',
              'Include both healthy and diseased parts for comparison',
              'Remove dirt or water droplets before photographing',
              'Take multiple photos from different angles',
            ].map((tip, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-primary-500">💡</span>
                {tip}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

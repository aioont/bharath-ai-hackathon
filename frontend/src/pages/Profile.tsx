import { useState, useEffect, useCallback } from 'react'
import {
  User, Phone, MapPin, Sprout, LayoutGrid, CheckCircle,
  Edit3, Save, Trash2, Mail, Plus, Star, StarOff, PenLine,
  Droplets, Calendar, Leaf, X, ChevronDown, ChevronUp, Loader2, Ruler, Globe,
} from 'lucide-react'
import { useAppContext, type UserProfile } from '@/context/AppContext'
import LanguageSelector from '@/components/LanguageSelector'
import { MARKET_STATES, SOIL_TYPES, CROP_CATEGORIES } from '@/utils/constants'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  getCrops, addCrop, updateCrop, deleteCrop, setPrimaryCrop,
  type FarmerCrop, type CropCreate,
} from '@/services/api'

const FARMING_TYPE_OPTIONS = [
  { value: 'conventional', label: 'Conventional', icon: '🚜', desc: 'Chemical inputs' },
  { value: 'organic', label: 'Organic', icon: '🌿', desc: 'Natural only' },
  { value: 'mixed', label: 'Mixed', icon: '♻️', desc: 'Both approaches' },
]

const SEASON_OPTIONS = [
  { value: 'kharif', label: 'Kharif (Jun–Nov)', icon: '🌧️' },
  { value: 'rabi', label: 'Rabi (Oct–Apr)', icon: '❄️' },
  { value: 'zaid', label: 'Zaid (Mar–Jun)', icon: '☀️' },
  { value: 'perennial', label: 'Perennial', icon: '🌳' },
  { value: 'all-season', label: 'All Season', icon: '🗓️' },
]

const IRRIGATION_OPTIONS = [
  { value: 'rainfed', label: 'Rainfed', icon: '🌧️' },
  { value: 'canal', label: 'Canal', icon: '🏞️' },
  { value: 'drip', label: 'Drip', icon: '💧' },
  { value: 'sprinkler', label: 'Sprinkler', icon: '🚿' },
  { value: 'borewell', label: 'Borewell', icon: '⛽' },
  { value: 'other', label: 'Other', icon: '🔧' },
]

// Completion now only counts: name, phone, state, district, farmingType
const COMPLETION_FIELDS: (keyof UserProfile)[] = ['name', 'phone', 'state', 'district', 'farmingType']

const EMPTY_CROP_FORM: CropCreate = {
  crop_name: '',
  area_acres: undefined,
  soil_type: '',
  season: undefined,
  irrigation: undefined,
  variety: '',
  notes: '',
  is_primary: false,
}

// ─── Crop Form Modal ──────────────────────────────────────────────────────────
function CropFormModal({
  initial,
  onSave,
  onClose,
  loading,
}: {
  initial: CropCreate
  onSave: (data: CropCreate) => void
  onClose: () => void
  loading: boolean
}) {
  const [form, setForm] = useState<CropCreate>(initial)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const set = (k: keyof CropCreate, v: unknown) => setForm(p => ({ ...p, [k]: v }))

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="font-bold text-lg text-gray-900 flex items-center gap-2">
            <Sprout size={20} className="text-primary-500" />
            {initial.crop_name ? 'Edit Crop' : 'Add New Crop'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Crop Name */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Crop Name *</label>
            <select
              className="select-field"
              value={form.crop_name}
              onChange={e => set('crop_name', e.target.value)}
            >
              <option value="">Select Crop</option>
              {CROP_CATEGORIES.map(cat => (
                <optgroup key={cat.id} label={`${cat.icon} ${cat.name}`}>
                  {cat.crops.map(crop => <option key={crop} value={crop}>{crop}</option>)}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Area + Soil */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Area <span className="text-gray-400">(acres)</span>
              </label>
              <div className="relative">
                <Ruler size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  placeholder="e.g. 2.5"
                  className="input-field pl-8"
                  value={form.area_acres ?? ''}
                  onChange={e => set('area_acres', parseFloat(e.target.value) || undefined)}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Soil Type</label>
              <select className="select-field" value={form.soil_type ?? ''} onChange={e => set('soil_type', e.target.value)}>
                <option value="">Select Soil</option>
                {SOIL_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {/* Season */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              <Calendar size={13} className="inline mr-1" />Season
            </label>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {SEASON_OPTIONS.map(s => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => set('season', form.season === s.value ? undefined : s.value)}
                  className={`flex flex-col items-center gap-0.5 p-2 rounded-xl border-2 text-center transition-all text-xs ${form.season === s.value
                    ? 'border-primary-400 bg-primary-50 text-primary-700 font-semibold'
                    : 'border-gray-200 hover:border-primary-200 bg-white text-gray-600'
                    }`}
                >
                  <span className="text-lg">{s.icon}</span>
                  <span className="leading-tight">{s.label.split(' ')[0]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Irrigation */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              <Droplets size={13} className="inline mr-1" />Irrigation
            </label>
            <div className="grid grid-cols-3 gap-2">
              {IRRIGATION_OPTIONS.map(ir => (
                <button
                  key={ir.value}
                  type="button"
                  onClick={() => set('irrigation', form.irrigation === ir.value ? undefined : ir.value)}
                  className={`flex items-center gap-1.5 p-2 rounded-xl border-2 text-xs transition-all ${form.irrigation === ir.value
                    ? 'border-blue-400 bg-blue-50 text-blue-700 font-semibold'
                    : 'border-gray-200 hover:border-blue-200 bg-white text-gray-600'
                    }`}
                >
                  <span>{ir.icon}</span> {ir.label}
                </button>
              ))}
            </div>
          </div>

          {/* Advanced Toggle */}
          <button
            type="button"
            onClick={() => setShowAdvanced(p => !p)}
            className="flex items-center gap-1 text-xs text-primary-600 font-medium hover:underline"
          >
            {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {showAdvanced ? 'Hide' : 'Show'} advanced details
          </button>

          {showAdvanced && (
            <div className="space-y-3 border-t border-gray-100 pt-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  <Leaf size={13} className="inline mr-1" />Variety / Cultivar
                </label>
                <input
                  type="text"
                  placeholder="e.g. IR-64, HD-2967"
                  className="input-field"
                  value={form.variety ?? ''}
                  onChange={e => set('variety', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                <textarea
                  placeholder="Any additional notes about this crop..."
                  className="input-field resize-none"
                  rows={3}
                  value={form.notes ?? ''}
                  onChange={e => set('notes', e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Primary toggle */}
          <label className="flex items-center gap-3 p-3 bg-amber-50 rounded-xl border border-amber-100 cursor-pointer">
            <input
              type="checkbox"
              className="w-4 h-4 accent-amber-500"
              checked={form.is_primary}
              onChange={e => set('is_primary', e.target.checked)}
            />
            <div>
              <span className="text-sm font-semibold text-amber-800">Set as Primary Crop</span>
              <p className="text-xs text-amber-600">Used for AI advice, weather alerts &amp; market prices</p>
            </div>
          </label>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-5 border-t border-gray-100">
          <button
            onClick={() => {
              if (!form.crop_name) { toast.error('Please select a crop'); return }
              onSave(form)
            }}
            disabled={loading}
            className="btn-primary flex items-center gap-2 flex-1 justify-center"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {initial.crop_name ? 'Save Changes' : 'Add Crop'}
          </button>
          <button onClick={onClose} className="btn-secondary">Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ─── Crop Card ────────────────────────────────────────────────────────────────
function CropCard({
  crop,
  onEdit,
  onDelete,
  onSetPrimary,
}: {
  crop: FarmerCrop
  onEdit: () => void
  onDelete: () => void
  onSetPrimary: () => void
}) {
  const seasonLabel = SEASON_OPTIONS.find(s => s.value === crop.season)
  const irrigationLabel = IRRIGATION_OPTIONS.find(i => i.value === crop.irrigation)

  return (
    <div className={`relative rounded-2xl border-2 p-4 transition-all ${crop.is_primary
      ? 'border-amber-400 bg-amber-50/60 shadow-md'
      : 'border-gray-200 bg-white hover:border-primary-200'
      }`}>
      {crop.is_primary && (
        <span className="absolute -top-2.5 left-4 bg-amber-400 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
          <Star size={9} fill="white" /> PRIMARY
        </span>
      )}

      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center text-xl">🌾</div>
          <div>
            <h3 className="font-bold text-gray-900">{crop.crop_name}</h3>
            {crop.variety && <p className="text-xs text-gray-500">Variety: {crop.variety}</p>}
          </div>
        </div>
        <div className="flex gap-1 shrink-0">
          {!crop.is_primary && (
            <button
              onClick={onSetPrimary}
              title="Set as primary"
              className="p-1.5 rounded-lg hover:bg-amber-100 text-amber-500 transition-colors"
            >
              <StarOff size={15} />
            </button>
          )}
          <button onClick={onEdit} className="p-1.5 rounded-lg hover:bg-blue-100 text-blue-500 transition-colors">
            <PenLine size={15} />
          </button>
          <button onClick={onDelete} className="p-1.5 rounded-lg hover:bg-red-100 text-red-400 transition-colors">
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {crop.area_acres != null && (
          <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded-lg">
            <Ruler size={11} /> {crop.area_acres} acres
          </span>
        )}
        {crop.soil_type && (
          <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded-lg">
            🪨 {crop.soil_type}
          </span>
        )}
        {seasonLabel && (
          <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-xs px-2 py-1 rounded-lg">
            {seasonLabel.icon} {seasonLabel.label}
          </span>
        )}
        {irrigationLabel && (
          <span className="inline-flex items-center gap-1 bg-cyan-50 text-cyan-700 text-xs px-2 py-1 rounded-lg">
            {irrigationLabel.icon} {irrigationLabel.label}
          </span>
        )}
      </div>
      {crop.notes && (
        <p className="mt-2 text-xs text-gray-400 italic">{crop.notes}</p>
      )}
    </div>
  )
}

// ─── Main Profile Page ────────────────────────────────────────────────────────
export default function Profile() {
  const { state, setProfile } = useAppContext()
  const existingProfile = state.userProfile
  const authUser = state.authUser
  const navigate = useNavigate()
  const [authChecked, setAuthChecked] = useState(false)

  // ── Profile form ──
  const [editing, setEditing] = useState(!existingProfile?.isProfileComplete)
  const [form, setForm] = useState<Omit<UserProfile, 'isProfileComplete'>>({
    name: existingProfile?.name || authUser?.full_name || '',
    phone: existingProfile?.phone || '',
    state: existingProfile?.state || '',
    district: existingProfile?.district || '',
    farmingType: existingProfile?.farmingType || 'conventional',
  })

  // Update form when profile or auth loads from localStorage
  useEffect(() => {
    if (existingProfile || authUser) {
      setForm({
        name: existingProfile?.name || authUser?.full_name || '',
        phone: existingProfile?.phone || '',
        state: existingProfile?.state || '',
        district: existingProfile?.district || '',
        farmingType: existingProfile?.farmingType || 'conventional',
      })
      setEditing(!existingProfile?.isProfileComplete)
    }
  }, [existingProfile, authUser])

  // ── Multi-crop state ──
  const [crops, setCrops] = useState<FarmerCrop[]>([])
  const [cropsLoading, setCropsLoading] = useState(false)
  const [showCropModal, setShowCropModal] = useState(false)
  const [editingCrop, setEditingCrop] = useState<FarmerCrop | null>(null)
  const [cropSaving, setCropSaving] = useState(false)

  const loadCrops = useCallback(async () => {
    if (!authUser) return
    setCropsLoading(true)
    try {
      const data = await getCrops()
      setCrops(data)
    } catch {
      // silently fail — user might not have crops yet
    } finally {
      setCropsLoading(false)
    }
  }, [authUser])

  useEffect(() => {
    loadCrops()
  }, [loadCrops])

  // Redirect unauthenticated users (with delay to allow auth to load from localStorage)
  useEffect(() => {
    // Give auth context time to initialize from localStorage
    const timer = setTimeout(() => {
      setAuthChecked(true)
      if (!authUser) {
        toast.error('Please sign in to view your profile.')
        navigate('/login')
      }
    }, 100)
    
    return () => clearTimeout(timer)
  }, [authUser, navigate])

  // Don't render until auth is checked
  if (!authChecked) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="animate-spin text-primary-600" size={32} />
      </div>
    )
  }

  // If not authenticated after check, don't render (navigation in progress)
  if (!authUser) {
    return null
  }

  // ── Profile completion — name, phone, state, district, farmingType ──
  const completionScore = () => {
    let filled = 0
    if (form.name.trim()) filled++
    if (form.phone.trim()) filled++
    if (form.state) filled++
    if (form.district.trim()) filled++
    if (form.farmingType) filled++
    // Bonus: has at least one crop
    const base = Math.round((filled / COMPLETION_FIELDS.length) * 80) // 80% from profile fields
    const cropBonus = crops.length > 0 ? 20 : 0
    return Math.min(100, base + cropBonus)
  }

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Please enter your name'); return }
    if (!form.state) { toast.error('Please select your state'); return }
    
    try {
      const { updateProfile } = await import('@/services/api')
      await updateProfile({
        full_name: form.name,
        state: form.state,
        district: form.district,
        farming_type: form.farmingType,
        language: state.selectedLanguage.code
      })
      
      const score = completionScore()
      const profile: UserProfile = { ...form, isProfileComplete: score >= 75 }
      setProfile(profile)
      setEditing(false)
      toast.success(`Profile saved! ${score}% complete`)
    } catch {
      toast.error('Failed to save profile')
    }
  }

  const handleDelete = () => {
    setProfile(null)
    setForm({ name: '', phone: '', state: '', district: '', farmingType: 'conventional' })
    setEditing(true)
    toast('Profile cleared', { icon: '🗑️' })
  }

  // ── Crop handlers ──
  const handleAddCrop = async (data: CropCreate) => {
    setCropSaving(true)
    try {
      const newCrop = await addCrop(data)
      setCrops(prev => {
        const updated = data.is_primary ? prev.map(c => ({ ...c, is_primary: false })) : prev
        return [...updated, newCrop]
      })
      setShowCropModal(false)
      toast.success(`${data.crop_name} added!`)
    } catch {
      toast.error('Failed to add crop')
    } finally {
      setCropSaving(false)
    }
  }

  const handleEditCrop = async (data: CropCreate) => {
    if (!editingCrop) return
    setCropSaving(true)
    try {
      const updated = await updateCrop(editingCrop.id, data)
      setCrops(prev => {
        let list = prev.map(c => c.id === editingCrop.id ? updated : c)
        if (data.is_primary) list = list.map(c => c.id === updated.id ? c : { ...c, is_primary: false })
        return list
      })
      setEditingCrop(null)
      setShowCropModal(false)
      toast.success('Crop updated!')
    } catch {
      toast.error('Failed to update crop')
    } finally {
      setCropSaving(false)
    }
  }

  const handleDeleteCrop = async (cropId: string, cropName: string) => {
    if (!confirm(`Remove "${cropName}" from your crops?`)) return
    try {
      await deleteCrop(cropId)
      setCrops(prev => prev.filter(c => c.id !== cropId))
      toast('Crop removed', { icon: '🗑️' })
    } catch {
      toast.error('Failed to remove crop')
    }
  }

  const handleSetPrimary = async (cropId: string) => {
    try {
      const updated = await setPrimaryCrop(cropId)
      setCrops(prev => prev.map(c => ({ ...c, is_primary: c.id === updated.id })))
      toast.success('Primary crop updated!')
    } catch {
      toast.error('Failed to update primary crop')
    }
  }

  const score = completionScore()
  const barColor = score >= 75 ? 'bg-green-500' : score >= 40 ? 'bg-amber-500' : 'bg-red-400'

  if (!authUser) return null

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="section-title flex items-center gap-2 mb-0">
            <span>👤</span> Farmer Profile
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">Personalise your experience — weather, market &amp; AI advice</p>
        </div>
        {existingProfile && !editing && (
          <button onClick={() => setEditing(true)} className="btn-secondary flex items-center gap-2 text-sm">
            <Edit3 size={15} /> Edit
          </button>
        )}
      </div>

      {/* Profile Completion */}
      <div className="card">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-gray-700">Profile Completion</span>
          <span className={`text-sm font-bold ${score >= 75 ? 'text-green-600' : score >= 40 ? 'text-amber-600' : 'text-red-500'}`}>{score}%</span>
        </div>
        <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${score}%` }} />
        </div>
        <div className="flex items-center justify-between mt-1.5">
          {score >= 75 ? (
            <p className="text-xs text-green-600 flex items-center gap-1">
              <CheckCircle size={12} /> Great! Your profile is fully personalised
            </p>
          ) : (
            <p className="text-xs text-gray-500">
              Fill in your details and add crops to reach 100%
            </p>
          )}
          <p className="text-[10px] text-gray-400">Profile 80% + Crops 20%</p>
        </div>
      </div>

      {/* ── View Mode ─── */}
      {!editing && existingProfile && (
        <div className="card space-y-4">
          <div className="flex items-center gap-4 pb-4 border-b border-gray-100">
            <div className="w-16 h-16 bg-agri-gradient rounded-2xl flex items-center justify-center text-3xl shadow-md">
              👨‍🌾
            </div>
            <div>
              <h2 className="font-bold text-lg text-gray-900">{existingProfile.name || 'Farmer'}</h2>
              {existingProfile.state && (
                <p className="text-sm text-gray-500">
                  {existingProfile.district ? `${existingProfile.district}, ` : ''}{existingProfile.state}
                </p>
              )}
              {existingProfile.phone && <p className="text-xs text-gray-400">{existingProfile.phone}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Farming Type', value: existingProfile.farmingType, icon: '🚜' },
              { label: 'Total Crops', value: `${crops.length} crop${crops.length !== 1 ? 's' : ''}`, icon: '🌾' },
              { label: 'Primary Crop', value: crops.find(c => c.is_primary)?.crop_name || '—', icon: '⭐' },
              {
                label: 'Total Area',
                value: crops.reduce((sum, c) => sum + (c.area_acres || 0), 0) > 0
                  ? `${crops.reduce((sum, c) => sum + (c.area_acres || 0), 0).toFixed(1)} acres`
                  : '—',
                icon: '📐',
              },
              { label: 'Language', value: `${state.selectedLanguage.flag} ${state.selectedLanguage.englishName}`, icon: '🌐' },
            ].map(item => (
              <div key={item.label} className="bg-gray-50 rounded-xl p-3">
                <div className="text-lg mb-1">{item.icon}</div>
                <div className="text-xs text-gray-500">{item.label}</div>
                <div className="text-sm font-semibold text-gray-800 capitalize">{item.value || '—'}</div>
              </div>
            ))}
          </div>
          <button
            onClick={handleDelete}
            className="text-xs text-red-400 hover:text-red-600 flex items-center gap-1 transition-colors"
          >
            <Trash2 size={12} /> Clear profile
          </button>
        </div>
      )}

      {/* ── Edit Form ─── */}
      {editing && (
        <div className="card space-y-5">
          {/* Personal Info */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <User size={15} className="text-primary-500" /> Personal Information
            </h3>
            <div className="space-y-3">
              {authUser?.email && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Email Address</label>
                  <div className="relative">
                    <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input type="email" value={authUser.email} readOnly className="input-field pl-9 bg-gray-50 text-gray-500 cursor-not-allowed" />
                  </div>
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Full Name *</label>
                <input type="text" placeholder="e.g. Ramesh Patil" className="input-field" value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Phone Number</label>
                <div className="relative">
                  <Phone size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="tel" placeholder="10-digit mobile number" className="input-field pl-9" value={form.phone}
                    onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
                </div>
              </div>
            </div>
          </section>

          {/* Location */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <MapPin size={15} className="text-primary-500" /> Location
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">State *</label>
                <select className="select-field" value={form.state} onChange={e => setForm(p => ({ ...p, state: e.target.value }))}>
                  <option value="">Select State</option>
                  {MARKET_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">District</label>
                <input type="text" placeholder="e.g. Nashik" className="input-field" value={form.district}
                  onChange={e => setForm(p => ({ ...p, district: e.target.value }))} />
              </div>
            </div>
          </section>

          {/* Farming Type */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <LayoutGrid size={15} className="text-primary-500" /> Farming Approach
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {FARMING_TYPE_OPTIONS.map(opt => (
                <button key={opt.value} type="button"
                  onClick={() => setForm(p => ({ ...p, farmingType: opt.value as UserProfile['farmingType'] }))}
                  className={`flex flex-col items-start gap-1 p-3 rounded-xl border-2 text-left transition-all ${form.farmingType === opt.value
                    ? 'border-primary-400 bg-primary-50'
                    : 'border-gray-200 hover:border-primary-200 bg-white'
                    }`}
                >
                  <span className="text-xl">{opt.icon}</span>
                  <span className="text-xs font-semibold text-gray-800">{opt.label}</span>
                  <span className="text-[10px] text-gray-500">{opt.desc}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Language Selection */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <Globe size={15} className="text-primary-500" /> Preferred Language
            </h3>
            <p className="text-xs text-gray-500 mb-2">
               Used for translations, AI responses &amp; voice.
            </p>
            <LanguageSelector />
          </section>

          {/* Crops reminder */}
          <div className="bg-green-50 border border-green-100 rounded-xl p-3 flex items-start gap-2 text-xs text-green-800">
            <Sprout size={14} className="shrink-0 mt-0.5" />
            <span>Add your crops in the <strong>My Crops</strong> section below — each crop can have its own area, season, soil type and irrigation details.</span>
          </div>

          {/* Save */}
          <div className="flex gap-3 pt-2">
            <button onClick={handleSave} className="btn-primary flex items-center gap-2">
              <Save size={16} /> Save Profile
            </button>
            {existingProfile && (
              <button onClick={() => setEditing(false)} className="btn-secondary">Cancel</button>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* ── My Crops Section ──────────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════ */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="section-title flex items-center gap-2 mb-0 text-base">
              <span>🌾</span> My Crops
            </h2>
            <p className="text-xs text-gray-500">Each crop tracks its own area, soil, season &amp; irrigation</p>
          </div>
          <button
            onClick={() => { setEditingCrop(null); setShowCropModal(true) }}
            className="btn-primary flex items-center gap-2 text-sm py-2 px-4"
          >
            <Plus size={15} /> Add Crop
          </button>
        </div>

        {cropsLoading ? (
          <div className="card flex items-center justify-center py-10 gap-3 text-gray-400">
            <Loader2 size={22} className="animate-spin" />
            <span className="text-sm">Loading your crops...</span>
          </div>
        ) : crops.length === 0 ? (
          <div className="card text-center py-10 border-2 border-dashed border-gray-200">
            <div className="text-4xl mb-3">🌱</div>
            <p className="font-semibold text-gray-700">No crops added yet</p>
            <p className="text-xs text-gray-400 mt-1 mb-4">Add the crops you grow to get tailored AI advice</p>
            <button
              onClick={() => { setEditingCrop(null); setShowCropModal(true) }}
              className="btn-primary mx-auto flex items-center gap-2 text-sm"
            >
              <Plus size={15} /> Add Your First Crop
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {crops.map(crop => (
              <CropCard
                key={crop.id}
                crop={crop}
                onEdit={() => { setEditingCrop(crop); setShowCropModal(true) }}
                onDelete={() => handleDeleteCrop(crop.id, crop.crop_name)}
                onSetPrimary={() => handleSetPrimary(crop.id)}
              />
            ))}
            <p className="text-xs text-gray-400 text-center">
              {crops.length} crop{crops.length !== 1 ? 's' : ''} · Tap ☆ on any crop to set it as primary
            </p>
          </div>
        )}
      </div>

      {/* Crop Modal */}
      {showCropModal && (
        <CropFormModal
          initial={editingCrop
            ? {
              crop_name: editingCrop.crop_name,
              area_acres: editingCrop.area_acres,
              soil_type: editingCrop.soil_type ?? '',
              season: editingCrop.season,
              irrigation: editingCrop.irrigation,
              variety: editingCrop.variety ?? '',
              notes: editingCrop.notes ?? '',
              is_primary: editingCrop.is_primary,
            }
            : EMPTY_CROP_FORM}
          onSave={editingCrop ? handleEditCrop : handleAddCrop}
          onClose={() => { setShowCropModal(false); setEditingCrop(null) }}
          loading={cropSaving}
        />
      )}
    </div>
  )
}

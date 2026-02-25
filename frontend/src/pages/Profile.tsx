import { useState } from 'react'
import { User, Phone, MapPin, Sprout, LayoutGrid, Ruler, CheckCircle, Edit3, Save, Trash2 } from 'lucide-react'
import { useAppContext, type UserProfile } from '@/context/AppContext'
import { MARKET_STATES, SOIL_TYPES, CROP_CATEGORIES } from '@/utils/constants'
import toast from 'react-hot-toast'

const FARMING_TYPE_OPTIONS = [
  { value: 'conventional', label: 'Conventional Farming', icon: '🚜', desc: 'Traditional methods with chemical inputs' },
  { value: 'organic', label: 'Organic Farming', icon: '🌿', desc: 'Natural inputs only, no chemicals' },
  { value: 'mixed', label: 'Mixed / Integrated', icon: '♻️', desc: 'Combination of both approaches' },
]

const COMPLETION_FIELDS: (keyof UserProfile)[] = ['name', 'phone', 'state', 'district', 'primaryCrop', 'soilType', 'farmSizeAcres', 'farmingType']

export default function Profile() {
  const { state, setProfile } = useAppContext()
  const existingProfile = state.userProfile

  const [editing, setEditing] = useState(!existingProfile?.isProfileComplete)
  const [form, setForm] = useState<Omit<UserProfile, 'isProfileComplete'>>({
    name: existingProfile?.name || '',
    phone: existingProfile?.phone || '',
    state: existingProfile?.state || '',
    district: existingProfile?.district || '',
    primaryCrop: existingProfile?.primaryCrop || '',
    soilType: existingProfile?.soilType || '',
    farmSizeAcres: existingProfile?.farmSizeAcres || 0,
    farmingType: existingProfile?.farmingType || 'conventional',
  })

  const completionScore = () => {
    let filled = 0
    if (form.name.trim()) filled++
    if (form.phone.trim()) filled++
    if (form.state) filled++
    if (form.district.trim()) filled++
    if (form.primaryCrop) filled++
    if (form.soilType) filled++
    if (form.farmSizeAcres > 0) filled++
    if (form.farmingType) filled++
    return Math.round((filled / COMPLETION_FIELDS.length) * 100)
  }

  const handleSave = () => {
    if (!form.name.trim()) {
      toast.error('Please enter your name')
      return
    }
    if (!form.state) {
      toast.error('Please select your state')
      return
    }
    const score = completionScore()
    const profile: UserProfile = {
      ...form,
      isProfileComplete: score >= 75,
    }
    setProfile(profile)
    setEditing(false)
    toast.success(`Profile saved! ${score}% complete`)
  }

  const handleDelete = () => {
    setProfile(null)
    setForm({ name: '', phone: '', state: '', district: '', primaryCrop: '', soilType: '', farmSizeAcres: 0, farmingType: 'conventional' })
    setEditing(true)
    toast('Profile cleared', { icon: '🗑️' })
  }

  const score = completionScore()
  const barColor = score >= 75 ? 'bg-green-500' : score >= 40 ? 'bg-amber-500' : 'bg-red-400'

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl mx-auto">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="section-title flex items-center gap-2 mb-0">
            <span>👤</span> Farmer Profile
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">Personalise your experience — weather, market & AI advice</p>
        </div>
        {existingProfile && !editing && (
          <button
            onClick={() => setEditing(true)}
            className="btn-secondary flex items-center gap-2 text-sm"
          >
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
          <div
            className={`h-full rounded-full transition-all duration-500 ${barColor}`}
            style={{ width: `${score}%` }}
          />
        </div>
        {score >= 75 && (
          <p className="text-xs text-green-600 mt-1.5 flex items-center gap-1">
            <CheckCircle size={12} /> Great! Your profile helps us personalise all features for you
          </p>
        )}
        {score < 75 && (
          <p className="text-xs text-gray-500 mt-1.5">Complete your profile to get personalised weather, market prices & AI advice</p>
        )}
      </div>

      {/* View Mode */}
      {!editing && existingProfile && (
        <div className="card space-y-4">
          <div className="flex items-center gap-4 pb-4 border-b border-gray-100">
            <div className="w-16 h-16 bg-agri-gradient rounded-2xl flex items-center justify-center text-3xl shadow-md">
              👨‍🌾
            </div>
            <div>
              <h2 className="font-bold text-lg text-gray-900">{existingProfile.name || 'Farmer'}</h2>
              {existingProfile.state && <p className="text-sm text-gray-500">{existingProfile.district ? `${existingProfile.district}, ` : ''}{existingProfile.state}</p>}
              {existingProfile.phone && <p className="text-xs text-gray-400">{existingProfile.phone}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Primary Crop', value: existingProfile.primaryCrop, icon: '🌾' },
              { label: 'Soil Type', value: existingProfile.soilType, icon: '🪨' },
              { label: 'Farm Size', value: existingProfile.farmSizeAcres ? `${existingProfile.farmSizeAcres} acres` : '—', icon: '📐' },
              { label: 'Farming Type', value: existingProfile.farmingType, icon: '🚜' },
            ].map((item) => (
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

      {/* Edit Form */}
      {editing && (
        <div className="card space-y-5">
          {/* Personal Info */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <User size={15} className="text-primary-500" /> Personal Information
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Full Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Ramesh Patil"
                  className="input-field"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Phone Number</label>
                <div className="relative">
                  <Phone size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="tel"
                    placeholder="10-digit mobile number"
                    className="input-field pl-9"
                    value={form.phone}
                    onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                  />
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
                <select
                  className="select-field"
                  value={form.state}
                  onChange={(e) => setForm((p) => ({ ...p, state: e.target.value }))}
                >
                  <option value="">Select State</option>
                  {MARKET_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">District</label>
                <input
                  type="text"
                  placeholder="e.g. Nashik"
                  className="input-field"
                  value={form.district}
                  onChange={(e) => setForm((p) => ({ ...p, district: e.target.value }))}
                />
              </div>
            </div>
          </section>

          {/* Farm Details */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Sprout size={15} className="text-primary-500" /> Farm Details
            </h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Primary Crop</label>
                  <select
                    className="select-field"
                    value={form.primaryCrop}
                    onChange={(e) => setForm((p) => ({ ...p, primaryCrop: e.target.value }))}
                  >
                    <option value="">Select Crop</option>
                    {CROP_CATEGORIES.map((cat) => (
                      <optgroup key={cat.id} label={`${cat.icon} ${cat.name}`}>
                        {cat.crops.map((crop) => <option key={crop} value={crop}>{crop}</option>)}
                      </optgroup>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Soil Type</label>
                  <select
                    className="select-field"
                    value={form.soilType}
                    onChange={(e) => setForm((p) => ({ ...p, soilType: e.target.value }))}
                  >
                    <option value="">Select Soil</option>
                    {SOIL_TYPES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Farm Size <span className="text-gray-400">(acres)</span>
                </label>
                <div className="relative">
                  <Ruler size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    placeholder="e.g. 5"
                    className="input-field pl-9"
                    value={form.farmSizeAcres || ''}
                    onChange={(e) => setForm((p) => ({ ...p, farmSizeAcres: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Farming Type */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <LayoutGrid size={15} className="text-primary-500" /> Farming Approach
            </h3>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {FARMING_TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, farmingType: opt.value as UserProfile['farmingType'] }))}
                  className={`flex flex-col items-start gap-1 p-3 rounded-xl border-2 text-left transition-all ${
                    form.farmingType === opt.value
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

          {/* Save */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={handleSave}
              className="btn-primary flex items-center gap-2"
            >
              <Save size={16} />
              Save Profile
            </button>
            {existingProfile && (
              <button
                onClick={() => setEditing(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

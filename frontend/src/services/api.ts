import axios from 'axios'
import { API_BASE_URL } from '@/utils/constants'

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use(
  (config) => {
    const lang = localStorage.getItem('selectedLanguage')
    if (lang) {
      try {
        const parsedLang = JSON.parse(lang)
        config.headers['X-User-Language'] = parsedLang.code
      } catch (_) { }
    }
    // Attach JWT token if available
    const token = localStorage.getItem('auth_token')
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!error.response) {
      console.warn('Network error - possibly offline')
    }
    return Promise.reject(error)
  }
)

// ─── Translation ───────────────────────────────────────────────────────────────
export interface TranslationRequest {
  text: string
  source_language: string
  target_language: string
  domain?: 'agriculture' | 'general' | 'market' | 'weather'
}

export interface TranslationResponse {
  translated_text: string
  source_language: string
  target_language: string
  confidence: number
  domain: string
}

export const translateText = (data: TranslationRequest) =>
  api.post<TranslationResponse>('/api/translate', data).then((r) => r.data)

export const translateBatch = (texts: TranslationRequest[]) =>
  api.post<TranslationResponse[]>('/api/translate/batch', { translations: texts }).then((r) => r.data)

// ─── AI Chat ───────────────────────────────────────────────────────────────────
export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp?: string
  isError?: boolean
  isDemo?: boolean
}

export interface ChatRequest {
  message: string
  language: string
  conversation_history?: ChatMessage[]
  conversation_uuid?: string  // For continuing existing conversations
  category?: string
  tts_enabled?: boolean
  farmer_profile?: {
    state?: string
    district?: string
    farming_type?: string
    // Legacy
    crop?: string
    soil_type?: string
    season?: string
    // Full crop list
    crops?: Array<{
      crop_name: string
      area_acres?: number
      soil_type?: string
      season?: string
      irrigation?: string
      variety?: string
      notes?: string
      is_primary: boolean
    }>
  }
}

export interface ChatResponse {
  response: string
  language: string
  model?: string
  tokens_used?: number
  suggestions?: string[]
  related_topics?: string[]
  confidence?: number
  audio_base64?: string   // base64 WAV from Sarvam TTS (present only when tts_enabled=true)
  audio_format?: string
}

export const sendChatMessage = (data: ChatRequest) =>
  api.post<ChatResponse>('/api/chat', data).then((r) => r.data)

// ─── Chat History ──────────────────────────────────────────────────────────────
export interface Conversation {
  id: number
  conversation_uuid: string
  title: string
  language: string
  category: string
  message_count: number
  created_at: string
  updated_at: string
}

export interface ConversationDetail {
  conversation: Conversation
  messages: Array<ChatMessage & {
    id?: number
    model_used?: string
    tokens_used?: number
    cached_response?: boolean
    created_at: string
    audio_base64?: string
    audio_format?: string
  }>
  message_count: number
}

export interface ChatAnalytics {
  user_id: string
  period_days: number
  total_messages: number
  conversations: number
  cache_hit_rate: number
  total_tokens: number
  avg_response_time_ms: number
  total_audio_kb?: number
}

export const getConversations = (category?: string, limit = 20, offset = 0) => {
  const params = new URLSearchParams()
  if (category) params.append('category', category)
  params.append('limit', String(limit))
  params.append('offset', String(offset))
  return api.get<{ conversations: Conversation[]; total: number }>(`/api/chat/conversations?${params}`).then((r) => r.data)
}

export const getConversation = (conversationUuid: string, includeAudio = false) =>
  api.get<ConversationDetail>(`/api/chat/conversations/${conversationUuid}?include_audio=${includeAudio}`).then((r) => r.data)

export const getChatAnalytics = (days = 7) =>
  api.get<ChatAnalytics>(`/api/chat/analytics?days=${days}`).then((r) => r.data)

export const getChatHistory = (includeAudio = false) =>
  api.get<ConversationDetail>(`/api/chat/history?include_audio=${includeAudio}`).then((r) => r.data)

export const clearChatHistory = () =>
  api.delete<{ success: boolean; message: string }>('/api/chat/history').then((r) => r.data)

// ─── Crop Health ───────────────────────────────────────────────────────────────
export interface CropHealthResponse {
  disease_name: string
  confidence: number
  severity: 'low' | 'medium' | 'high'
  description: string
  symptoms: string[]
  treatment: string[]
  prevention: string[]
  affected_crops: string[]
  image_url?: string
}

export const analyzeCropHealth = (formData: FormData) =>
  api.post<CropHealthResponse>('/api/crop-health/analyze', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then((r) => r.data)

export const getCropDiseaseInfo = (cropName: string, diseaseName: string, language: string) =>
  api.get<CropHealthResponse>(`/api/crop-health/disease/${cropName}/${diseaseName}`, {
    params: { language },
  }).then((r) => r.data)

// ─── Weather ───────────────────────────────────────────────────────────────────
export interface WeatherData {
  location: string
  date: string
  temperature: { min: number; max: number; current: number }
  humidity: number
  rainfall: number
  wind_speed: number
  condition: string
  farming_advice: string
  alerts: Array<{ type: string; message: string; severity: string }>
}

export interface WeatherForecast {
  location: string
  current: WeatherData
  forecast: WeatherData[]
  agricultural_insights: string[]
}

export const getWeatherForecast = (location: string, language: string, days = 7) =>
  api.get<WeatherForecast>('/api/weather/forecast', { params: { location, language, days } }).then((r) => r.data)

export const getWeatherByCoords = (lat: number, lon: number, language: string) =>
  api.get<WeatherForecast>('/api/weather/forecast/coords', { params: { lat, lon, language } }).then((r) => r.data)

// ─── Market Prices ─────────────────────────────────────────────────────────────
export interface MarketPrice {
  commodity: string
  variety: string
  market: string
  state: string
  min_price: number
  max_price: number
  modal_price: number
  unit: string
  date: string
  trend: 'up' | 'down' | 'stable'
  trend_percentage: number
}

export interface MarketResponse {
  prices: MarketPrice[]
  last_updated: string
  total_count: number
}

export const getMarketPrices = (
  commodity_id = 3,
  state_id = 17,
  from_date = '',
  to_date = '',
  language = 'en'
) =>
  api.get<MarketResponse>('/api/market/prices', {
    params: { commodity_id, state_id, from_date, to_date, language }
  }).then((r) => r.data)

export const getMarketFilters = () =>
  api.get<{
    last_updated: string
    data: {
      cmdt_data: Array<{ cmdt_id: number; cmdt_name: string; cmdt_group_id: number }>
      state_data: Array<{ state_id: number; state_name: string }>
      district_data?: Array<{ district_id: number; district_name: string; state_id: number }>
      market_data?: Array<{ market_id: number; market_name: string; district_id: number }>
    }
  }>('/api/market/filters').then((r) => r.data)

export const getMarketTrends = (commodity: string, days = 30) =>
  api.get<{ dates: string[]; prices: number[]; commodity: string }>('/api/market/trends', {
    params: { commodity, days },
  }).then((r) => r.data)

// ─── Forum ─────────────────────────────────────────────────────────────────────
export interface ForumPost {
  id: string
  title: string
  content: string
  author: string
  language: string
  category: string
  tags: string[]
  upvotes: number
  answers_count: number
  created_at: string
  is_resolved: boolean
  image_url?: string
}

export interface ForumListResponse {
  posts: ForumPost[]
  total: number
  page: number
  per_page: number
}

export const getForumPosts = (page = 1, category?: string, language?: string, search?: string, user_id?: string, user_email?: string) =>
  api.get<ForumPost[]>('/api/forum/posts', { params: { page, category, language, search, user_id, user_email } }).then((r) => r.data)

export const createForumPost = (data: Partial<ForumPost> & { user_id?: string; user_email?: string }) =>
  api.post<ForumPost>('/api/forum/posts', data).then((r) => r.data)

export const getForumPost = (id: string) =>
  api.get<ForumPost & { answers: Array<{ id: string; content: string; author: string; upvotes: number; created_at: string }> }>(`/api/forum/posts/${id}`).then((r) => r.data)

export const voteForumPost = (id: string) =>
  api.post<{ upvotes: number }>(`/api/forum/posts/${id}/vote`).then((r) => r.data)

export interface ForumAnswer {
  id: string
  post_id: string
  content: string
  author: string
  user_id?: string
  upvotes: number
  is_accepted: boolean
  created_at: string
}

export const getForumAnswers = (postId: string) =>
  api.get<ForumAnswer[]>(`/api/forum/posts/${postId}/answers`).then((r) => r.data)

export const createForumAnswer = (postId: string, data: { content: string; author: string; user_id?: string; user_email?: string }) =>
  api.post<ForumAnswer>(`/api/forum/posts/${postId}/answers`, data).then((r) => r.data)

// ─── Authentication ────────────────────────────────────────────────────────────
export interface AuthUser {
  id: string
  email: string
  full_name?: string
  is_verified: boolean
  state?: string
  district?: string
  farming_type?: string
  language?: string
}

export interface AuthResponse {
  access_token: string
  token_type: string
  user: AuthUser
}

export const signup = (email: string, password: string, full_name?: string) =>
  api.post<{ message: string }>('/api/auth/signup', { email, password, full_name }).then((r) => r.data)

export const verifyEmail = (email: string, code: string) =>
  api.post<AuthResponse>('/api/auth/verify', { email, code }).then((r) => r.data)

export const login = (email: string, password: string) =>
  api.post<AuthResponse>('/api/auth/login', { email, password }).then((r) => r.data)

export const getMe = () =>
  api.get<AuthUser>('/api/auth/me').then((r) => r.data)

export const updateProfile = (data: Partial<AuthUser>) =>
  api.put<AuthUser>('/api/auth/profile', data).then((r) => r.data)

export const resendVerification = (email: string) =>
  api.post<{ message: string }>('/api/auth/resend-verification', { email }).then((r) => r.data)

// ─── News Feed ─────────────────────────────────────────────────────────────────
export interface NewsItem {
  title: string
  link: string
  description: string
  pub_date?: string
  author?: string
  image_url?: string
  guid?: string
}

export const getNewsFeed = (limit = 6) =>
  api.get<NewsItem[]>('/api/news/feed', { params: { limit } }).then((r) => r.data)

// ─── Farmer Crops ──────────────────────────────────────────────────────────────
export interface FarmerCrop {
  id: string
  user_id: string
  crop_name: string
  area_acres?: number
  soil_type?: string
  season?: 'kharif' | 'rabi' | 'zaid' | 'perennial' | 'all-season'
  irrigation?: 'rainfed' | 'canal' | 'drip' | 'sprinkler' | 'borewell' | 'other'
  variety?: string
  notes?: string
  is_primary: boolean
  created_at: string
  updated_at: string
}

export interface CropCreate {
  crop_name: string
  area_acres?: number
  soil_type?: string
  season?: 'kharif' | 'rabi' | 'zaid' | 'perennial' | 'all-season'
  irrigation?: 'rainfed' | 'canal' | 'drip' | 'sprinkler' | 'borewell' | 'other'
  variety?: string
  notes?: string
  is_primary?: boolean
}

export const getCrops = () =>
  api.get<FarmerCrop[]>('/api/crops').then((r) => r.data)

export const addCrop = (data: CropCreate) =>
  api.post<FarmerCrop>('/api/crops', data).then((r) => r.data)

export const updateCrop = (cropId: string, data: Partial<CropCreate>) =>
  api.put<FarmerCrop>(`/api/crops/${cropId}`, data).then((r) => r.data)

export const deleteCrop = (cropId: string) =>
  api.delete(`/api/crops/${cropId}`)

export const setPrimaryCrop = (cropId: string) =>
  api.patch<FarmerCrop>(`/api/crops/${cropId}/set-primary`).then((r) => r.data)

// ─── Admin Cache Management ────────────────────────────────────────────────────
export interface CacheStats {
  available: boolean
  performance?: {
    hit_rate?: string
    cache_hits?: number
    cache_misses?: number
  }
  memory?: {
    used_memory?: string
    peak_memory?: string
    fragmentation_ratio?: string
  }
  clients?: {
    connected_clients?: number
  }
  commands?: {
    total_commands_processed?: number
  }
  recommendations?: string[]
}

export interface CacheHealth {
  available: boolean
  message: string
}

export interface CacheClearResponse {
  cleared: boolean
  keys_deleted: number
  pattern: string
}

export const getCacheStats = () =>
  api.get<CacheStats>('/admin/cache/stats').then((r) => r.data)

export const getCacheHealth = () =>
  api.get<CacheHealth>('/admin/cache/health').then((r) => r.data)

export const clearCache = (pattern = '*') =>
  api.post<CacheClearResponse>('/admin/cache/clear', null, { params: { pattern } }).then((r) => r.data)

export default api


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
      } catch (_) {}
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
  category?: string
  farmer_profile?: {
    state?: string
    crop?: string
    soil_type?: string
    season?: string
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
}

export const sendChatMessage = (data: ChatRequest) =>
  api.post<ChatResponse>('/api/chat', data).then((r) => r.data)

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

export const getMarketPrices = (state?: string, commodity?: string, language = 'en') =>
  api.get<MarketResponse>('/api/market/prices', { params: { state, commodity, language } }).then((r) => r.data)

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

export const getForumPosts = (page = 1, category?: string, language?: string, search?: string) =>
  api.get<ForumPost[]>('/api/forum/posts', { params: { page, category, language, search } }).then((r) => r.data)

export const createForumPost = (data: Partial<ForumPost>) =>
  api.post<ForumPost>('/api/forum/posts', data).then((r) => r.data)

export const getForumPost = (id: string) =>
  api.get<ForumPost & { answers: Array<{ id: string; content: string; author: string; upvotes: number; created_at: string }> }>(`/api/forum/posts/${id}`).then((r) => r.data)

export const voteForumPost = (id: string) =>
  api.post<{ upvotes: number }>(`/api/forum/posts/${id}/vote`).then((r) => r.data)

export default api

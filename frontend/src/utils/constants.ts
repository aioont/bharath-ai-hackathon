// Sarvam AI officially supports 15 Indian languages + English
// Language order: English first, then by speaker population in India
export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English', englishName: 'English', flag: '🇬🇧', script: 'Latin' },
  { code: 'hi', name: 'हिंदी', englishName: 'Hindi', flag: '🇮🇳', script: 'Devanagari' },
  { code: 'bn', name: 'বাংলা', englishName: 'Bengali', flag: '🇮🇳', script: 'Bengali' },
  { code: 'te', name: 'తెలుగు', englishName: 'Telugu', flag: '🇮🇳', script: 'Telugu' },
  { code: 'mr', name: 'मराठी', englishName: 'Marathi', flag: '🇮🇳', script: 'Devanagari' },
  { code: 'ta', name: 'தமிழ்', englishName: 'Tamil', flag: '🇮🇳', script: 'Tamil' },
  { code: 'gu', name: 'ગુજરાતી', englishName: 'Gujarati', flag: '🇮🇳', script: 'Gujarati' },
  { code: 'ur', name: 'اردو', englishName: 'Urdu', flag: '🇮🇳', script: 'Nastaliq' },
  { code: 'kn', name: 'ಕನ್ನಡ', englishName: 'Kannada', flag: '🇮🇳', script: 'Kannada' },
  { code: 'ml', name: 'മലയാളം', englishName: 'Malayalam', flag: '🇮🇳', script: 'Malayalam' },
  { code: 'or', name: 'ଓଡ଼ିଆ', englishName: 'Odia', flag: '🇮🇳', script: 'Odia' },
  { code: 'pa', name: 'ਪੰਜਾਬੀ', englishName: 'Punjabi', flag: '🇮🇳', script: 'Gurmukhi' },
  { code: 'as', name: 'অসমীয়া', englishName: 'Assamese', flag: '🇮🇳', script: 'Bengali' },
  { code: 'ne', name: 'नेपाली', englishName: 'Nepali', flag: '🇳🇵', script: 'Devanagari' },
  { code: 'sa', name: 'संस्कृत', englishName: 'Sanskrit', flag: '🇮🇳', script: 'Devanagari' },
]

export const CROP_CATEGORIES = [
  { id: 'cereals', name: 'Cereals & Grains', icon: '🌾', crops: ['Wheat', 'Rice', 'Maize', 'Barley', 'Sorghum', 'Millet'] },
  { id: 'pulses', name: 'Pulses & Legumes', icon: '🫘', crops: ['Lentils', 'Chickpea', 'Black Gram', 'Green Gram', 'Pigeon Pea'] },
  { id: 'vegetables', name: 'Vegetables', icon: '🥦', crops: ['Tomato', 'Potato', 'Onion', 'Brinjal', 'Cabbage', 'Cauliflower', 'Bitter Gourd'] },
  { id: 'fruits', name: 'Fruits', icon: '🍎', crops: ['Mango', 'Banana', 'Papaya', 'Guava', 'Pomegranate', 'Watermelon'] },
  { id: 'cash-crops', name: 'Cash Crops', icon: '🌿', crops: ['Cotton', 'Sugarcane', 'Tobacco', 'Jute', 'Tea', 'Coffee'] },
  { id: 'oilseeds', name: 'Oilseeds', icon: '🌻', crops: ['Sunflower', 'Mustard', 'Groundnut', 'Soybean', 'Sesame', 'Flaxseed'] },
  { id: 'spices', name: 'Spices & Herbs', icon: '🌶️', crops: ['Chilli', 'Turmeric', 'Ginger', 'Coriander', 'Cumin', 'Cardamom'] },
]

export const MARKET_STATES = [
  'Andhra Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Gujarat', 'Haryana',
  'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh',
  'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha',
  'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
]

export const WEATHER_ICONS: Record<string, string> = {
  'clear': '☀️',
  'partly-cloudy': '⛅',
  'cloudy': '☁️',
  'rain': '🌧️',
  'heavy-rain': '⛈️',
  'thunderstorm': '🌩️',
  'fog': '🌫️',
  'wind': '💨',
  'snow': '❄️',
  'hail': '🌨️',
}

export const SOIL_TYPES = [
  'Alluvial Soil', 'Black Cotton Soil', 'Red Laterite Soil', 'Mountain Soil',
  'Desert Soil', 'Peaty Soil', 'Forest Soil', 'Saline Soil', 'Loamy Soil', 'Sandy Soil',
]

export const FARMING_SEASONS = [
  { id: 'kharif', name: 'Kharif (खरीफ)', period: 'June–November', crops: ['Rice', 'Maize', 'Cotton', 'Soybean', 'Millet'] },
  { id: 'rabi', name: 'Rabi (रबी)', period: 'October–April', crops: ['Wheat', 'Barley', 'Mustard', 'Peas', 'Chickpea'] },
  { id: 'zaid', name: 'Zaid (जायद)', period: 'March–June', crops: ['Watermelon', 'Muskmelon', 'Cucumber', 'Bitter Gourd'] },
]

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://agri-backend.makeasite.in'

export const DISEASE_SEVERITY = {
  low: { label: 'Low', color: 'text-yellow-600 bg-yellow-50 border-yellow-200' },
  medium: { label: 'Medium', color: 'text-orange-600 bg-orange-50 border-orange-200' },
  high: { label: 'High', color: 'text-red-600 bg-red-50 border-red-200' },
}

export const EXPERT_CATEGORIES = [
  { id: 'crop-management', label: 'Crop Management', labelKey: 'catCropManagement', icon: '🌾' },
  { id: 'pest-control', label: 'Pest Control', labelKey: 'catPestControl', icon: '🐛' },
  { id: 'soil-health', label: 'Soil Health', labelKey: 'catSoilHealth', icon: '🌱' },
  { id: 'water-management', label: 'Water Management', labelKey: 'catWaterManagement', icon: '💧' },
  { id: 'market-advisory', label: 'Market Advisory', labelKey: 'catMarketAdvisory', icon: '📈' },
  { id: 'weather-advice', label: 'Weather Advice', labelKey: 'catWeatherAdvice', icon: '🌤️' },
  { id: 'organic-farming', label: 'Organic Farming', labelKey: 'catOrganicFarming', icon: '♻️' },
  { id: 'government-schemes', label: 'Govt. Schemes', labelKey: 'catGovtSchemes', icon: '🏛️' },
]

import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react'
import { SUPPORTED_LANGUAGES } from '@/utils/constants'
import type { AuthUser } from '@/services/api'

export interface Language {
  code: string
  name: string
  englishName: string
  flag: string
  script: string
}

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

export interface UserProfile {
  name: string
  phone: string
  state: string
  district: string
  farmingType: 'organic' | 'conventional' | 'mixed'
  isProfileComplete: boolean
}

export const GREETINGS: Record<string, string> = {
  en: 'Namaste',
  hi: 'नमस्ते',
  mr: 'नमस्कार',
  bn: 'নমস্কার',
  te: 'నమస్కారం',
  ta: 'வணக்கம்',
  kn: 'ನಮಸ್ಕಾರ',
  ml: 'നമസ്കാരം',
  gu: 'નમસ્તે',
  pa: 'ਸਤ ਸ੍ਰੀ ਅਕਾਲ',
  or: 'ନମସ୍କାର',
  as: 'নমস্কাৰ',
  ur: 'السلام علیکم',
}

export const UI_LABELS: Record<string, Record<string, string>> = {
  en: {
    // Nav / Sidebar
    askExpert: 'Ask AgriSaarthi', translateNow: 'Translate Now', features: 'Features', yourFarm: 'Your Farm',
    community: 'Community', settings: 'Settings', help: 'Help', profile: 'My Profile',
    // Weather
    weatherTitle: 'Weather & Forecasts', weatherSubtitle: 'Localized weather with farming-specific insights',
    selectLocation: 'Select State / Location', refresh: 'Refresh', loadingWeather: 'Fetching weather data...',
    humidity: 'Humidity', wind: 'Wind', rain: 'Rain', feels: 'Feels',
    farmingAdvice: "Today's Farming Advice", forecast7day: '7-Day Forecast',
    agriInsights: 'Agricultural Insights', today: 'Today',
    // Forum
    forumTitle: 'Community Forum', forumSubtitle: 'Share knowledge • Solve problems together',
    askQuestion: 'Ask Question', postQuestion: 'Post a New Question',
    posting: 'Posting...', post: 'Post Question', cancel: 'Cancel',
    // Common
    loading: 'Loading...', online: 'Online', offline: 'Offline',
    chatTitle: 'AgriSaarthi', marketTitle: 'Market Prices', translateTitle: 'Translate',
  },
  hi: {
    askExpert: 'AI विशेषज्ञ से पूछें', translateNow: 'अभी अनुवाद करें', features: 'विशेषताएं', yourFarm: 'आपका खेत',
    community: 'समुदाय', settings: 'सेटिंग्स', help: 'सहायता', profile: 'मेरी प्रोफाइल',
    weatherTitle: 'मौसम और पूर्वानुमान', weatherSubtitle: 'कृषि-विशिष्ट जानकारी के साथ स्थानीय मौसम',
    selectLocation: 'राज्य / स्थान चुनें', refresh: 'ताज़ा करें', loadingWeather: 'मौसम डेटा प्राप्त हो रहा है...',
    humidity: 'नमी', wind: 'हवा', rain: 'बारिश', feels: 'महसूस',
    farmingAdvice: 'आज की खेती सलाह', forecast7day: '7-दिन का पूर्वानुमान',
    agriInsights: 'कृषि अंतर्दृष्टि', today: 'आज',
    forumTitle: 'सामुदायिक मंच', forumSubtitle: 'ज्ञान साझा करें • समस्याएं मिलकर सुलझाएं',
    askQuestion: 'प्रश्न पूछें', postQuestion: 'नया प्रश्न पोस्ट करें',
    posting: 'पोस्ट हो रहा है...', post: 'प्रश्न पोस्ट करें', cancel: 'रद्द करें',
    loading: 'लोड हो रहा है...', online: 'ऑनलाइन', offline: 'ऑफलाइन',
    chatTitle: 'AI विशेषज्ञ चैट', marketTitle: 'बाज़ार भाव', translateTitle: 'अनुवाद',
  },
  mr: {
    askExpert: 'AI तज्ञाला विचारा', translateNow: 'आता भाषांतर करा', features: 'वैशिष्ट्ये', yourFarm: 'तुमचे शेत',
    community: 'समुदाय', settings: 'सेटिंग्ज', help: 'मदत', profile: 'माझी प्रोफाइल',
    weatherTitle: 'हवामान आणि अंदाज', weatherSubtitle: 'शेतीसाठी विशिष्ट स्थानिक हवामान',
    selectLocation: 'राज्य / स्थान निवडा', refresh: 'रिफ्रेश करा', loadingWeather: 'हवामान माहिती मिळवत आहे...',
    humidity: 'आर्द्रता', wind: 'वारा', rain: 'पाऊस', feels: 'जाणवते',
    farmingAdvice: 'आजचा शेती सल्ला', forecast7day: '७-दिवसांचा अंदाज',
    agriInsights: 'कृषी अंतर्दृष्टी', today: 'आज',
    forumTitle: 'सामुदायिक मंच', forumSubtitle: 'ज्ञान वाटा • एकत्र समस्या सोडवा',
    askQuestion: 'प्रश्न विचारा', postQuestion: 'नवीन प्रश्न पोस्ट करा',
    posting: 'पोस्ट होत आहे...', post: 'प्रश्न पोस्ट करा', cancel: 'रद्द करा',
    loading: 'लोड होत आहे...', online: 'ऑनलाइन', offline: 'ऑफलाइन',
    chatTitle: 'AI तज्ञ चॅट', marketTitle: 'बाजार भाव', translateTitle: 'भाषांतर',
  },
  bn: {
    askExpert: 'AI বিশেষজ্ঞকে জিজ্ঞেস করুন', translateNow: 'এখন অনুবাদ করুন', features: 'বৈশিষ্ট্য', yourFarm: 'আপনার খামার',
    community: 'সম্প্রদায়', settings: 'সেটিংস', help: 'সাহায্য', profile: 'আমার প্রোফাইল',
    weatherTitle: 'আবহাওয়া ও পূর্বাভাস', weatherSubtitle: 'কৃষি-নির্দিষ্ট তথ্য সহ স্থানীয় আবহাওয়া',
    selectLocation: 'রাজ্য / স্থান নির্বাচন করুন', refresh: 'রিফ্রেশ করুন', loadingWeather: 'আবহাওয়া ডেটা আনা হচ্ছে...',
    humidity: 'আর্দ্রতা', wind: 'বাতাস', rain: 'বৃষ্টি', feels: 'অনুভব',
    farmingAdvice: 'আজকের কৃষি পরামর্শ', forecast7day: '৭-দিনের পূর্বাভাস',
    agriInsights: 'কৃষি অন্তর্দৃষ্টি', today: 'আজ',
    forumTitle: 'সামুদায়িক ফোরাম', forumSubtitle: 'জ্ঞান ভাগ করুন • একসাথে সমস্যা সমাধান করুন',
    askQuestion: 'প্রশ্ন করুন', postQuestion: 'নতুন প্রশ্ন পোস্ট করুন',
    posting: 'পোস্ট হচ্ছে...', post: 'প্রশ্ন পোস্ট করুন', cancel: 'বাতিল করুন',
    loading: 'লোড হচ্ছে...', online: 'অনলাইন', offline: 'অফলাইন',
    chatTitle: 'AI বিশেষজ্ঞ চ্যাট', marketTitle: 'বাজার মূল্য', translateTitle: 'অনুবাদ',
  },
  te: {
    askExpert: 'AI నిపుణుడిని అడగండి', translateNow: 'ఇప్పుడు అనువదించండి', features: 'లక్షణాలు', yourFarm: 'మీ వ్యవసాయం',
    community: 'కమ్యూనిటీ', settings: 'సెట్టింగ్లు', help: 'సహాయం', profile: 'నా ప్రొఫైల్',
    weatherTitle: 'వాతావరణం & అంచనాలు', weatherSubtitle: 'వ్యవసాయ-నిర్దిష్ట అంతర్దృష్టితో స్థానిక వాతావరణం',
    selectLocation: 'రాష్ట్రం / స్థానం ఎంచుకోండి', refresh: 'రిఫ్రెష్ చేయండి', loadingWeather: 'వాతావరణ డేటా తీసుకుంటున్నారు...',
    humidity: 'తేమ', wind: 'గాలి', rain: 'వర్షం', feels: 'అనుభవం',
    farmingAdvice: 'నేటి వ్యవసాయ సలహా', forecast7day: '7-రోజుల అంచనా',
    agriInsights: 'వ్యవసాయ అంతర్దృష్టి', today: 'నేడు',
    forumTitle: 'కమ్యూనిటీ ఫోరమ్', forumSubtitle: 'జ్ఞానాన్ని పంచుకోండి • కలిసి సమస్యలు పరిష్కరించండి',
    askQuestion: 'ప్రశ్న అడగండి', postQuestion: 'కొత్త ప్రశ్న పోస్ట్ చేయండి',
    posting: 'పోస్ట్ అవుతున్నది...', post: 'ప్రశ్న పోస్ట్ చేయండి', cancel: 'రద్దు చేయండి',
    loading: 'లోడ్ అవుతున్నది...', online: 'ఆన్‌లైన్', offline: 'ఆఫ్‌లైన్',
    chatTitle: 'AI నిపుణుడి చాట్', marketTitle: 'మార్కెట్ ధరలు', translateTitle: 'అనువాదం',
  },
  ta: {
    askExpert: 'AI நிபுணரிடம் கேளுங்கள்', translateNow: 'இப்போது மொழிபெயர்க்கவும்', features: 'அம்சங்கள்', yourFarm: 'உங்கள் பண்ணை',
    community: 'சமூகம்', settings: 'அமைப்புகள்', help: 'உதவி', profile: 'என் சுயவிவரம்',
    weatherTitle: 'வானிலை & முன்னறிவிப்புகள்', weatherSubtitle: 'விவசாய-குறிப்பிட்ட நுண்ணறிவுடன் உள்ளூர் வானிலை',
    selectLocation: 'மாநிலம் / இடம் தேர்ந்தெடுக்கவும்', refresh: 'புதுப்பிக்கவும்', loadingWeather: 'வானிலை தரவு பெறுகிறோம்...',
    humidity: 'ஈரப்பதம்', wind: 'காற்று', rain: 'மழை', feels: 'உணர்வு',
    farmingAdvice: 'இன்றைய விவசாய ஆலோசனை', forecast7day: '7-நாள் முன்னறிவிப்பு',
    agriInsights: 'விவசாய நுண்ணறிவு', today: 'இன்று',
    forumTitle: 'சமூக மன்றம்', forumSubtitle: 'அறிவை பகிர்ந்து கொள்ளுங்கள் • சேர்ந்து சிக்கல்களை தீர்க்குங்கள்',
    askQuestion: 'கேள்வி கேளுங்கள்', postQuestion: 'புதிய கேள்வி பதிவிடவும்',
    posting: 'பதிவிடப்படுகிறது...', post: 'கேள்வி பதிவிடவும்', cancel: 'ரத்து செய்யவும்',
    loading: 'ஏற்றுகிறது...', online: 'ஆன்லைன்', offline: 'ஆஃப்லைன்',
    chatTitle: 'AI நிபுண அரட்டை', marketTitle: 'சந்தை விலைகள்', translateTitle: 'மொழிபெயர்ப்பு',
  },
  kn: {
    askExpert: 'AI ತಜ್ಞರನ್ನು ಕೇಳಿ', translateNow: 'ಈಗ ಅನುವಾದಿಸಿ', features: 'ವೈಶಿಷ್ಟ್ಯಗಳು', yourFarm: 'ನಿಮ್ಮ ಜಮೀನು',
    community: 'ಸಮುದಾಯ', settings: 'ಸೆಟ್ಟಿಂಗ್ಗಳು', help: 'ಸಹಾಯ', profile: 'ನನ್ನ ಪ್ರೊಫೈಲ್',
    weatherTitle: 'ಹವಾಮಾನ & ಮುನ್ಸೂಚನೆಗಳು', weatherSubtitle: 'ಕೃಷಿ-ನಿರ್ದಿಷ್ಟ ಒಳನೋಟಗಳೊಂದಿಗೆ ಸ್ಥಳೀಯ ಹವಾಮಾನ',
    selectLocation: 'ರಾಜ್ಯ / ಸ್ಥಳ ಆಯ್ಕೆ ಮಾಡಿ', refresh: 'ರಿಫ್ರೆಶ್ ಮಾಡಿ', loadingWeather: 'ಹವಾಮಾನ ಡೇಟಾ ತರುತ್ತಿದ್ದೇವೆ...',
    humidity: 'ಆರ್ದ್ರತೆ', wind: 'ಗಾಳಿ', rain: 'ಮಳೆ', feels: 'ಅನುಭವ',
    farmingAdvice: 'ಇಂದಿನ ಕೃಷಿ ಸಲಹೆ', forecast7day: '7-ದಿನದ ಮುನ್ಸೂಚನೆ',
    agriInsights: 'ಕೃಷಿ ಒಳನೋಟ', today: 'ಇಂದು',
    forumTitle: 'ಸಮುದಾಯ ವೇದಿಕೆ', forumSubtitle: 'ಜ್ಞಾನ ಹಂಚಿಕೊಳ್ಳಿ • ಒಟ್ಟಾಗಿ ಸಮಸ್ಯೆಗಳನ್ನು ಪರಿಹರಿಸಿ',
    askQuestion: 'ಪ್ರಶ್ನೆ ಕೇಳಿ', postQuestion: 'ಹೊಸ ಪ್ರಶ್ನೆ ಪೋಸ್ಟ್ ಮಾಡಿ',
    posting: 'ಪೋಸ್ಟ್ ಆಗುತ್ತಿದೆ...', post: 'ಪ್ರಶ್ನೆ ಪೋಸ್ಟ್ ಮಾಡಿ', cancel: 'ರದ್ದು ಮಾಡಿ',
    loading: 'ಲೋಡ್ ಆಗುತ್ತಿದೆ...', online: 'ಆನ್‌ಲೈನ್', offline: 'ಆಫ್‌ಲೈನ್',
    chatTitle: 'AI ತಜ್ಞ ಚಾಟ್', marketTitle: 'ಮಾರುಕಟ್ಟೆ ಬೆಲೆಗಳು', translateTitle: 'ಅನುವಾದ',
  },
  ml: {
    askExpert: 'AI വിദഗ്ദ്ധനോട് ചോദിക്കൂ', translateNow: 'ഇപ്പോൾ വിവർത്തനം ചെയ്യൂ', features: 'സവിശേഷതകൾ', yourFarm: 'നിങ്ങളുടെ കൃഷി',
    community: 'കമ്മ്യൂണിറ്റി', settings: 'ക്രമീകരണങ്ങൾ', help: 'സഹായം', profile: 'എന്റെ പ്രൊഫൈൽ',
    weatherTitle: 'കാലാവസ്ഥ & പ്രവചനങ്ങൾ', weatherSubtitle: 'കൃഷി-നിർദ്ദിഷ്ട ഉൾക്കാഴ്‌ചകളോടൊപ്പം പ്രാദേശിക കാലാവസ്ഥ',
    selectLocation: 'സംസ്ഥാനം / സ്ഥലം തിരഞ്ഞെടുക്കൂ', refresh: 'പുതുക്കുക', loadingWeather: 'കാലാവസ്ഥ ഡേറ്റ ലഭ്യമാക്കുന്നു...',
    humidity: 'ആർദ്രത', wind: 'കാറ്റ്', rain: 'മഴ', feels: 'അനുഭവം',
    farmingAdvice: 'ഇന്നത്തെ കൃഷി ഉപദേശം', forecast7day: '7-ദിവസ പ്രവചനം',
    agriInsights: 'കൃഷി ഉൾക്കാഴ്‌ച', today: 'ഇന്ന്',
    forumTitle: 'കമ്മ്യൂണിറ്റി ഫോറം', forumSubtitle: 'അറിവ് പങ്കിടൂ • ഒന്നിച്ച് പ്രശ്‌നങ്ങൾ പരിഹരിക്കൂ',
    askQuestion: 'ചോദ്യം ചോദിക്കൂ', postQuestion: 'പുതിയ ചോദ്യം പോസ്റ്റ് ചെയ്യൂ',
    posting: 'പോസ്റ്റ് ചെയ്യുന്നു...', post: 'ചോദ്യം പോസ്റ്റ് ചെയ്യൂ', cancel: 'റദ്ദാക്കൂ',
    loading: 'ലോഡ് ചെയ്യുന്നു...', online: 'ഓൺലൈൻ', offline: 'ഓഫ്‌ലൈൻ',
    chatTitle: 'AI വിദഗ്ദ്ധ ചാറ്റ്', marketTitle: 'മാർക്കറ്റ് വിലകൾ', translateTitle: 'വിവർത്തനം',
  },
  gu: {
    askExpert: 'AI નિષ્ણાંતને પૂછો', translateNow: 'હવે અનુવાદ કરો', features: 'સુવિધાઓ', yourFarm: 'તમારી ખેતી',
    community: 'સમુદાય', settings: 'સેટિંગ્સ', help: 'મદદ', profile: 'મારી પ્રોફાઇલ',
    weatherTitle: 'હવામાન અને પૂર્વાનુમાન', weatherSubtitle: 'ખેતી-વિશિષ્ટ સ્થળ-ભ awed હવામાન',
    selectLocation: 'રાજ્ય / સ્થળ પસંદ કરો', refresh: 'રિફ્રેશ કરો', loadingWeather: 'હવામાન ડેટા મળી રહ્યો છે...',
    humidity: 'ભેજ', wind: 'પવન', rain: 'વરસાદ', feels: 'અનુભૂતિ',
    farmingAdvice: 'આજની ખેતી સલાહ', forecast7day: '7-દિવસનું પૂર્વાનુમાન',
    agriInsights: 'કૃષિ અંતર્દ્રષ્ટિ', today: 'આજે',
    forumTitle: 'સામુદાયિક મંચ', forumSubtitle: 'જ્ઞાન વહેંચો • સાથે સમસ્યાઓ ઉકેલો',
    askQuestion: 'પ્રશ્ન પૂછો', postQuestion: 'નવો પ્રશ્ન પોસ્ટ કરો',
    posting: 'પોસ્ટ થઈ રહ્યો છે...', post: 'પ્રશ્ન પોસ્ટ કરો', cancel: 'રદ કરો',
    loading: 'લોડ થઈ રહ્યો છે...', online: 'ઓનલાઇન', offline: 'ઓફલાઇન',
    chatTitle: 'AI નિષ્ણાંત ચેટ', marketTitle: 'બજાર ભાવ', translateTitle: 'અનુવાદ',
  },
  pa: {
    askExpert: 'AI ਮਾਹਿਰ ਨੂੰ ਪੁੱਛੋ', translateNow: 'ਹੁਣੇ ਅਨੁਵਾਦ ਕਰੋ', features: 'ਵਿਸ਼ੇਸ਼ਤਾਵਾਂ', yourFarm: 'ਤੁਹਾਡਾ ਖੇਤ',
    community: 'ਸਮੁਦਾਇ', settings: 'ਸੈਟਿੰਗਾਂ', help: 'ਮਦਦ', profile: 'ਮੇਰੀ ਪ੍ਰੋਫਾਈਲ',
    weatherTitle: 'ਮੌਸਮ ਅਤੇ ਭਵਿੱਖਬਾਣੀ', weatherSubtitle: 'ਖੇਤੀ-ਵਿਸ਼ੇਸ਼ ਜਾਣਕਾਰੀ ਸਹਿਤ ਸਥਾਨਕ ਮੌਸਮ',
    selectLocation: 'ਰਾਜ / ਸਥਾਨ ਚੁਣੋ', refresh: 'ਤਾਜ਼ਾ ਕਰੋ', loadingWeather: 'ਮੌਸਮ ਡੇਟਾ ਲੱਭ ਰਿਹਾ ਹੈ...',
    humidity: 'ਨਮੀ', wind: 'ਹਵਾ', rain: 'ਮੀਂਹ', feels: 'ਮਹਿਸੂਸ',
    farmingAdvice: 'ਅੱਜ ਦੀ ਖੇਤੀ ਸਲਾਹ', forecast7day: '7-ਦਿਨਾਂ ਦੀ ਭਵਿੱਖਬਾਣੀ',
    agriInsights: 'ਖੇਤੀਬਾੜੀ ਅੰਤਰਦ੍ਰਿਸ਼ਟੀ', today: 'ਅੱਜ',
    forumTitle: 'ਸਮੁਦਾਇ ਮੰਚ', forumSubtitle: 'ਗਿਆਨ ਸਾਂਝਾ ਕਰੋ • ਮਿਲ ਕੇ ਸਮੱਸਿਆਵਾਂ ਹੱਲ ਕਰੋ',
    askQuestion: 'ਸਵਾਲ ਪੁੱਛੋ', postQuestion: 'ਨਵਾਂ ਸਵਾਲ ਪੋਸਟ ਕਰੋ',
    posting: 'ਪੋਸਟ ਹੋ ਰਿਹਾ ਹੈ...', post: 'ਸਵਾਲ ਪੋਸਟ ਕਰੋ', cancel: 'ਰੱਦ ਕਰੋ',
    loading: 'ਲੋਡ ਹੋ ਰਿਹਾ ਹੈ...', online: 'ਔਨਲਾਈਨ', offline: 'ਔਫਲਾਈਨ',
    chatTitle: 'AI ਮਾਹਿਰ ਚੈਟ', marketTitle: 'ਮੰਡੀ ਭਾਅ', translateTitle: 'ਅਨੁਵਾਦ',
  },
}

function getUILabel(langCode: string, key: string): string {
  return UI_LABELS[langCode]?.[key] || UI_LABELS['en'][key] || key
}

export { getUILabel }

interface AppState {
  selectedLanguage: Language
  userProfile: UserProfile | null
  authUser: AuthUser | null
  authToken: string | null
  isOnline: boolean
  installPromptEvent: BeforeInstallPromptEvent | null
  isInstalled: boolean
  sidebarOpen: boolean
  theme: 'light' | 'dark'
  offlineQueue: Array<{ id: string; type: string; data: unknown }>
}

type AppAction =
  | { type: 'SET_LANGUAGE'; payload: Language }
  | { type: 'SET_PROFILE'; payload: UserProfile | null }
  | { type: 'SET_AUTH'; payload: { user: AuthUser; token: string } }
  | { type: 'LOGOUT' }
  | { type: 'SET_ONLINE'; payload: boolean }
  | { type: 'SET_INSTALL_PROMPT'; payload: BeforeInstallPromptEvent | null }
  | { type: 'SET_INSTALLED'; payload: boolean }
  | { type: 'TOGGLE_SIDEBAR' }
  | { type: 'SET_SIDEBAR'; payload: boolean }
  | { type: 'SET_THEME'; payload: 'light' | 'dark' }
  | { type: 'ADD_OFFLINE_QUEUE'; payload: { id: string; type: string; data: unknown } }
  | { type: 'CLEAR_OFFLINE_QUEUE' }

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
  prompt(): Promise<void>
}

const initialState: AppState = {
  selectedLanguage: SUPPORTED_LANGUAGES[0],
  userProfile: null,
  authUser: null,
  authToken: null,
  isOnline: navigator.onLine,
  installPromptEvent: null,
  isInstalled: window.matchMedia('(display-mode: standalone)').matches,
  sidebarOpen: false,
  theme: 'light',
  offlineQueue: [],
}

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_LANGUAGE':
      return { ...state, selectedLanguage: action.payload }
    case 'SET_PROFILE':
      return { ...state, userProfile: action.payload }
    case 'SET_AUTH':
      return { ...state, authUser: action.payload.user, authToken: action.payload.token }
    case 'LOGOUT':
      return { ...state, authUser: null, authToken: null }
    case 'SET_ONLINE':
      return { ...state, isOnline: action.payload }
    case 'SET_INSTALL_PROMPT':
      return { ...state, installPromptEvent: action.payload }
    case 'SET_INSTALLED':
      return { ...state, isInstalled: action.payload }
    case 'TOGGLE_SIDEBAR':
      return { ...state, sidebarOpen: !state.sidebarOpen }
    case 'SET_SIDEBAR':
      return { ...state, sidebarOpen: action.payload }
    case 'SET_THEME':
      return { ...state, theme: action.payload }
    case 'ADD_OFFLINE_QUEUE':
      return { ...state, offlineQueue: [...state.offlineQueue, action.payload] }
    case 'CLEAR_OFFLINE_QUEUE':
      return { ...state, offlineQueue: [] }
    default:
      return state
  }
}

interface AppContextValue {
  state: AppState
  dispatch: React.Dispatch<AppAction>
  setLanguage: (lang: Language) => void
  setProfile: (profile: UserProfile | null) => void
  setAuth: (user: AuthUser, token: string) => void
  logout: () => void
  installApp: () => Promise<void>
  t: (key: string) => string
}

const AppContext = createContext<AppContextValue | undefined>(undefined)

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState)

  useEffect(() => {
    const savedLang = localStorage.getItem('selectedLanguage')
    if (savedLang) {
      try {
        const lang = JSON.parse(savedLang)
        dispatch({ type: 'SET_LANGUAGE', payload: lang })
        document.documentElement.lang = lang.code
      } catch (_) { }
    }
    const savedProfile = localStorage.getItem('userProfile')
    if (savedProfile) {
      try {
        dispatch({ type: 'SET_PROFILE', payload: JSON.parse(savedProfile) })
      } catch (_) { }
    }
    const savedToken = localStorage.getItem('auth_token')
    const savedAuthUser = localStorage.getItem('auth_user')
    if (savedToken && savedAuthUser) {
      try {
        dispatch({ type: 'SET_AUTH', payload: { user: JSON.parse(savedAuthUser), token: savedToken } })
      } catch (_) { }
    }
  }, [])

  useEffect(() => {
    const handleOnline = () => dispatch({ type: 'SET_ONLINE', payload: true })
    const handleOffline = () => dispatch({ type: 'SET_ONLINE', payload: false })
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault()
      dispatch({ type: 'SET_INSTALL_PROMPT', payload: e as BeforeInstallPromptEvent })
    }
    window.addEventListener('beforeinstallprompt', handleBeforeInstall)
    window.addEventListener('appinstalled', () => {
      dispatch({ type: 'SET_INSTALLED', payload: true })
      dispatch({ type: 'SET_INSTALL_PROMPT', payload: null })
    })
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
  }, [])

  const setLanguage = (lang: Language) => {
    dispatch({ type: 'SET_LANGUAGE', payload: lang })
    localStorage.setItem('selectedLanguage', JSON.stringify(lang))
    document.documentElement.lang = lang.code
  }

  const setProfile = (profile: UserProfile | null) => {
    dispatch({ type: 'SET_PROFILE', payload: profile })
    if (profile) {
      localStorage.setItem('userProfile', JSON.stringify(profile))
    } else {
      localStorage.removeItem('userProfile')
    }
  }

  const setAuth = (user: AuthUser, token: string) => {
    dispatch({ type: 'SET_AUTH', payload: { user, token } })
    localStorage.setItem('auth_token', token)
    localStorage.setItem('auth_user', JSON.stringify(user))
  }

  const logout = () => {
    dispatch({ type: 'LOGOUT' })
    localStorage.removeItem('auth_token')
    localStorage.removeItem('auth_user')
  }

  const t = (key: string): string => getUILabel(state.selectedLanguage.code, key)

  const installApp = async () => {
    if (state.installPromptEvent) {
      await state.installPromptEvent.prompt()
      const { outcome } = await state.installPromptEvent.userChoice
      if (outcome === 'accepted') {
        dispatch({ type: 'SET_INSTALLED', payload: true })
        dispatch({ type: 'SET_INSTALL_PROMPT', payload: null })
      }
    }
  }

  return (
    <AppContext.Provider value={{ state, dispatch, setLanguage, setProfile, setAuth, logout, installApp, t }}>
      {children}
    </AppContext.Provider>
  )
}

export function useAppContext() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useAppContext must be used within AppProvider')
  return ctx
}

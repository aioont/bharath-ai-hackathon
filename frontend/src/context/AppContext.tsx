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
    home: 'Home', weather: 'Weather', cropHealth: 'Crop Health', insurance: 'Insurance',
    allQuestions: 'All Questions', myQuestions: 'My Questions',
    yourLanguage: 'Your Language', adminPanel: 'Admin Panel',
    whatCanIHelp: 'What can I help you with?', tapFeature: 'Tap any feature to get started',
    cropCategories: 'Crop Categories', whyAI: 'Why AI for Agriculture?',
    latestNews: 'Latest Agri News', viewAll: 'View all',
    cropHealthTitle: 'Crop Health Diagnostics', uploadPhoto: 'Upload Crop Photo',
    takePhoto: 'Take Photo with Camera', analyzeCropHealth: 'Analyze Crop Health',
    shareHealthReport: 'Share Health Report', tipsBetterDiagnosis: 'Tips for Better Diagnosis',
    translateBtn: 'Translate with Sarvam AI', quickPhrases: 'Quick Phrases for Farmers',
    farmerProfile: 'Farmer Profile', editBtn: 'Edit', saveProfile: 'Save Profile',
    clearProfile: 'Clear profile', myCrops: 'My Crops', addCrop: 'Add Crop', noCrops: 'No crops added yet',
    insuranceTitle: 'Insurance Advisor', findSchemes: 'Find My Best Insurance Schemes',
    enableVoice: 'Enable Voice', loadingHistory: 'Loading chat history...',
    askAnyLang: 'Ask in any language…', sortedByLatest: 'Sorted by Latest',
    // Chat UI
    thinkingVoice: 'Thinking & preparing voice…', researching: 'Researching…',
    aiModules: 'AI Decision Modules:', cultivationAdvisor: 'Cultivation Advisor', marketIntelligence: 'Market Intelligence',
    audioMode: 'Audio', textMode: 'Text',
    // Home
    completeProfile: 'Complete your profile', findCropAdvice: 'Find specific advice for your crop type',
    realTimeAdaptation: 'Real-time Adaptation', realTimeAdaptationDesc: 'AI continuously learns and adapts to market prices, weather conditions, and pest outbreaks',
    contextualIntelligence: 'Contextual Intelligence', contextualIntelligenceDesc: 'Recommendations consider soil type, local weather, and market trends for personalized advice',
    unmatchedScale: 'Unmatched Scale', unmatchedScaleDesc: 'Foundation models efficiently handle 15+ languages and 100+ crop types simultaneously',
    langSupported: '15+ languages supported',
    agentHeading: 'Autonomous Multilingual Farm Decision & Risk Intelligence Agent',
    agentSubCaption: 'Revolutionary AI agent that understands 15+ Indian languages through voice & text. Autonomous decision-making system combining real-time IoT sensor data, market intelligence, weather patterns & government schemes — delivering personalized farm guidance without human intervention.',
    talkToAgent: 'Talk to AI Agent',
    // Insurance form
    enterDetails: 'Enter Details', step1: 'Step 1', step2: 'Step 2', step3: 'Step 3',
    personalDetails: 'Personal Details', locationLabel: 'Location', farmCropDetails: 'Farm & Crop Details',
    fullName: 'Full Name', ageLabel: 'Age', genderLabel: 'Gender', categoryLabel: 'Category',
    stateLabel: 'State', districtLabel: 'District', primaryCrop: 'Primary Crop',
    landAcres: 'Land (acres)', farmingType: 'Farming Type', incomeLevel: 'Income Level',
    analysingAI: 'Analysing with AI + AWS…', bestSchemes: 'Best Matching Schemes',
    aiAnalysis: 'AI Strategic Analysis', startOver: 'Start over', voiceFeedbackOn: 'Voice Feedback ON',
    prefillNote: 'We pre-filled this form from your profile. Update fields if needed to get the most accurate insurance suggestions.',
    // Profile / Crop modal
    profileCompletion: 'Profile Completion', cropName: 'Crop Name', areaAcres: 'Area (acres)',
    soilType: 'Soil Type', seasonLabel: 'Season', irrigationLabel: 'Irrigation',
    showAdvanced: 'Show advanced details', hideAdvanced: 'Hide advanced details',
    varietyCultivar: 'Variety / Cultivar', notesLabel: 'Notes',
    setPrimary: 'Set as Primary Crop', setPrimaryDesc: 'Used for AI advice, weather alerts & market prices',
    saveChanges: 'Save Changes', addNewCrop: 'Add New Crop', editCrop: 'Edit Crop',
    personalInfo: 'Personal Information', locationSection: 'Location', farmingApproach: 'Farming Approach',
    emailAddress: 'Email Address', fullNameRequired: 'Full Name *', phoneNumber: 'Phone Number',
    stateRequired: 'State *', districtField: 'District', preferredLanguage: 'Preferred Language',
    loadingCrops: 'Loading your crops...', primaryBadge: 'PRIMARY',
    profileComplete: 'Great! Your profile is fully personalised',
    profileIncomplete: 'Fill in your details and add crops to reach 100%',
    cropSubtitle: 'Each crop tracks its own area, soil, season & irrigation',
    addCropsReminder: 'Add your crops in the My Crops section below — each crop can have its own area, season, soil type and irrigation details.',
    selectCrop: 'Select Crop', selectSoil: 'Select Soil', selectState: 'Select State',
    appName: 'AgriSaarthi', appTagline: "AI for Bharat's Farmers",
    homeCardDesc: 'Your intelligent farming companion for {state}. Access AI-powered crop guidance, real-time market intelligence, weather alerts, and community wisdom — all in your preferred language.',
    homeCardDescGeneral: "Welcome to India's most comprehensive agricultural platform. Get personalized AI assistance, market insights, weather forecasts, crop diagnostics, and connect with farmers nationwide — all powered by cutting-edge technology.",
    topicGeneral: 'General Expert', topicCropDoctor: 'Crop Doctor', topicMarket: 'Market Prices', topicWeather: 'Weather', topicSchemes: 'Govt Schemes',
    forumAll: 'All', catCropManagement: 'Crop Management', catPestControl: 'Pest Control', catSoilHealth: 'Soil Health', catWaterManagement: 'Water Management', catMarketAdvisory: 'Market Advisory', catWeatherAdvice: 'Weather Advice', catOrganicFarming: 'Organic Farming', catGovtSchemes: 'Govt. Schemes',
    govtSchemesAI: 'Expert AI analysis of government schemes using AWS Knowledge Base & myscheme.gov.in real-time data.',
    qPhrase1: 'What is the best fertilizer for wheat?', qPhrase2: 'How to control pests in rice crops?', qPhrase3: 'What is the current price of onion in the market?', qPhrase4: 'When should I sow the seeds for kharif season?', qPhrase5: 'How to improve soil quality for better yield?', qPhrase6: 'What are the symptoms of rust disease in wheat?',
    tapSetPrimary: 'Tap ☆ on any crop to set it as primary', cropSingular: 'crop', cropsPlural: 'crops',
    seasonKharif: 'Kharif (Jun–Nov)', seasonRabi: 'Rabi (Oct–Apr)', seasonZaid: 'Zaid (Mar–Jun)', seasonPerennial: 'Perennial', seasonAllSeason: 'All Season',
    irrigRainfed: 'Rainfed', irrigCanal: 'Canal', irrigDrip: 'Drip', irrigSprinkler: 'Sprinkler', irrigBorewell: 'Borewell', irrigOther: 'Other',
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
    home: 'होम', weather: 'मौसम', cropHealth: 'फसल स्वास्थ्य', insurance: 'बीमा',
    allQuestions: 'सभी प्रश्न', myQuestions: 'मेरे प्रश्न',
    yourLanguage: 'आपकी भाषा', adminPanel: 'एडमिन पैनल',
    whatCanIHelp: 'मैं आपकी कैसे मदद करूं?', tapFeature: 'शुरू करने के लिए कोई सुविधा चुनें',
    cropCategories: 'फसल श्रेणियां', whyAI: 'कृषि में AI क्यों?',
    latestNews: 'ताजा कृषि समाचार', viewAll: 'सभी देखें',
    cropHealthTitle: 'फसल स्वास्थ्य निदान', uploadPhoto: 'फसल फोटो अपलोड करें',
    takePhoto: 'कैमरे से फोटो लें', analyzeCropHealth: 'फसल स्वास्थ्य विश्लेषण करें',
    shareHealthReport: 'स्वास्थ्य रिपोर्ट शेयर करें', tipsBetterDiagnosis: 'बेहतर निदान के लिए सुझाव',
    translateBtn: 'Sarvam AI से अनुवाद करें', quickPhrases: 'किसानों के लिए त्वरित वाक्यांश',
    farmerProfile: 'किसान प्रोफाइल', editBtn: 'संपादित करें', saveProfile: 'प्रोफाइल सेव करें',
    clearProfile: 'प्रोफाइल साफ़ करें', myCrops: 'मेरी फसलें', addCrop: 'फसल जोड़ें', noCrops: 'अभी तक कोई फसल नहीं जोड़ी',
    insuranceTitle: 'बीमा सलाहकार', findSchemes: 'मेरी सर्वोत्तम बीमा योजनाएं खोजें',
    enableVoice: 'आवाज़ सक्षम करें', loadingHistory: 'चैट इतिहास लोड हो रहा है...',
    askAnyLang: 'किसी भी भाषा में पूछें…', sortedByLatest: 'नवीनतम क्रम में',
    thinkingVoice: 'सोच रहा है और आवाज़ तैयार कर रहा है…', researching: 'खोज रहा है…',
    aiModules: 'AI निर्णय मॉड्यूल:', cultivationAdvisor: 'खेती सलाहकार', marketIntelligence: 'बाज़ार ज्ञान',
    audioMode: 'ऑडियो', textMode: 'टेक्स्ट',
    completeProfile: 'अपनी प्रोफाइल पूरी करें', findCropAdvice: 'अपनी फसल के लिए विशेष सलाह पाएं',
    realTimeAdaptation: 'रियल-टाइम अनुकूलन', realTimeAdaptationDesc: 'AI बाजार कीमतों, मौसम और कीट प्रकोप के अनुसार सीखता और अनुकूल होता है',
    contextualIntelligence: 'संदर्भ बुद्धिमत्ता', contextualIntelligenceDesc: 'मिट्टी, स्थानीय मौसम और बाजार प्रवृत्तियों को ध्यान में रखते हुए सलाह',
    unmatchedScale: 'बेजोड़ पैमाना', unmatchedScaleDesc: 'फाउंडेशन मॉडल 15+ भाषाओं और 100+ फसलों को कुशलतापूर्वक संभालते हैं',
    langSupported: '15+ भाषाएं समर्थित',
    agentHeading: 'स्वायत्त बहुभाषी कृषि निर्णय और जोखिम बुद्धिमत्ता एजेंट',
    agentSubCaption: 'क्रांतिकारी AI एजेंट जो आवाज़ और पाठ के माध्यम से 15+ भारतीय भाषाएं समझता है। वास्तविक समय डेटा, बाज़ार ज्ञान, मौसम और सरकारी योजनाओं को मिलाकर व्यक्तिगत खेती मार्गदर्शन प्रदान करता है।',
    talkToAgent: 'AI एजेंट से बात करें',
    enterDetails: 'विवरण दर्ज करें', step1: 'चरण 1', step2: 'चरण 2', step3: 'चरण 3',
    personalDetails: 'व्यक्तिगत विवरण', locationLabel: 'स्थान', farmCropDetails: 'खेत और फसल विवरण',
    fullName: 'पूरा नाम', ageLabel: 'उम्र', genderLabel: 'लिंग', categoryLabel: 'श्रेणी',
    stateLabel: 'राज्य', districtLabel: 'जिला', primaryCrop: 'प्राथमिक फसल',
    landAcres: 'भूमि (एकड़)', farmingType: 'खेती का प्रकार', incomeLevel: 'आय स्तर',
    analysingAI: 'AI + AWS से विश्लेषण हो रहा है…', bestSchemes: 'सर्वोत्तम मिलान योजनाएं',
    aiAnalysis: 'AI रणनीतिक विश्लेषण', startOver: 'फिर से शुरू करें', voiceFeedbackOn: 'आवाज़ चालू है',
    prefillNote: 'हमने आपकी प्रोफाइल से यह फॉर्म भर दिया है। सटीक सुझावों के लिए जरूरी फ़ील्ड अपडेट करें।',
    profileCompletion: 'प्रोफाइल पूर्णता', cropName: 'फसल का नाम', areaAcres: 'क्षेत्र (एकड़)',
    soilType: 'मिट्टी का प्रकार', seasonLabel: 'मौसम', irrigationLabel: 'सिंचाई',
    showAdvanced: 'उन्नत विवरण दिखाएं', hideAdvanced: 'उन्नत विवरण छुपाएं',
    varietyCultivar: 'किस्म / प्रजाति', notesLabel: 'नोट्स',
    setPrimary: 'प्राथमिक फसल बनाएं', setPrimaryDesc: 'AI सलाह, मौसम अलर्ट और बाजार कीमतों के लिए उपयोग',
    saveChanges: 'बदलाव सेव करें', addNewCrop: 'नई फसल जोड़ें', editCrop: 'फसल संपादित करें',
    personalInfo: 'व्यक्तिगत जानकारी', locationSection: 'स्थान', farmingApproach: 'खेती का तरीका',
    emailAddress: 'ईमेल पता', fullNameRequired: 'पूरा नाम *', phoneNumber: 'फोन नंबर',
    stateRequired: 'राज्य *', districtField: 'जिला', preferredLanguage: 'पसंदीदा भाषा',
    loadingCrops: 'फसलें लोड हो रही हैं...', primaryBadge: 'प्राथमिक',
    profileComplete: 'बढ़िया! आपकी प्रोफाइल पूरी तरह व्यक्तिगत है',
    profileIncomplete: '100% तक पहुंचने के लिए विवरण भरें और फसलें जोड़ें',
    cropSubtitle: 'हर फसल का अपना क्षेत्र, मिट्टी, मौसम और सिंचाई ट्रैक होता है',
    addCropsReminder: 'नीचे मेरी फसलें अनुभाग में फसलें जोड़ें — प्रत्येक फसल में क्षेत्र, मौसम, मिट्टी के प्रकार और सिंचाई शामिल हो सकती है।',
    selectCrop: 'फसल चुनें', selectSoil: 'मिट्टी चुनें', selectState: 'राज्य चुनें',
    appName: 'AgriSaarthi', appTagline: 'भारत के किसानों के लिए AI',
    homeCardDesc: '{state} के लिए आपका बुद्धिमान खेती साथी। AI-संचालित फसल मार्गदर्शन, रियल-टाइम बाजार ज्ञान, मौसम चेतावनी — आपकी पसंदीदा भाषा में।',
    homeCardDescGeneral: 'भारत के सबसे व्यापक कृषि प्लेटफॉर्म में आपका स्वागत है। व्यक्तिगत AI सहायता, बाजार जानकारी, मौसम पूर्वानुमान, फसल निदान — अत्याधुनिक तकनीक से।',
    topicGeneral: 'सामान्य विशेषज्ञ', topicCropDoctor: 'फसल डॉक्टर', topicMarket: 'बाज़ार भाव', topicWeather: 'मौसम', topicSchemes: 'सरकारी योजनाएं',
    forumAll: 'सभी', catCropManagement: 'फसल प्रबंधन', catPestControl: 'कीट नियंत्रण', catSoilHealth: 'मिट्टी स्वास्थ्य', catWaterManagement: 'जल प्रबंधन', catMarketAdvisory: 'बाजार सलाह', catWeatherAdvice: 'मौसम सलाह', catOrganicFarming: 'जैविक खेती', catGovtSchemes: 'सरकारी योजनाएं',
    govtSchemesAI: 'AWS ज्ञान आधार और myscheme.gov.in वास्तविक समय डेटा का उपयोग करके सरकारी योजनाओं का AI विशेषज्ञ विश्लेषण।',
    qPhrase1: 'गेहूं के लिए सबसे अच्छा उर्वरक कौन सा है?', qPhrase2: 'चावल की फसल में कीटों को कैसे नियंत्रित करें?', qPhrase3: 'बाजार में प्याज का वर्तमान मूल्य क्या है?', qPhrase4: 'खरीफ सीज़न के बीज कब बोने चाहिए?', qPhrase5: 'बेहतर उपज के लिए मिट्टी की गुणवत्ता कैसे सुधारें?', qPhrase6: 'गेहूं में रस्ट रोग के लक्षण क्या हैं?',
    tapSetPrimary: 'किसी भी फसल पर ☆ टैप करें उसे प्राथमिक बनाने के लिए', cropSingular: 'फसल', cropsPlural: 'फसलें',
    seasonKharif: 'खरीफ (Jun–Nov)', seasonRabi: 'रबी (Oct–Apr)', seasonZaid: 'जायद (Mar–Jun)', seasonPerennial: 'बारहमासी', seasonAllSeason: 'सभी मौसम',
    irrigRainfed: 'वर्षा आधारित', irrigCanal: 'नहर', irrigDrip: 'ड्रिप', irrigSprinkler: 'स्प्रिंकलर', irrigBorewell: 'बोरवेल', irrigOther: 'अन्य',
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
    home: 'होम', weather: 'हवामान', cropHealth: 'पीक आरोग्य', insurance: 'विमा',
    allQuestions: 'सर्व प्रश्न', myQuestions: 'माझे प्रश्न',
    yourLanguage: 'तुमची भाषा', adminPanel: 'अडमिन पॅनल',
    whatCanIHelp: 'मी तुम्हाला कसे मदत करू?', tapFeature: 'सुरू करण्यासाठी कोणतेही वैशिष्ट्य निवडा',
    cropCategories: 'पीक श्रेणी', whyAI: 'शेतीसाठी AI का?',
    latestNews: 'ताजी कृषी बातमी', viewAll: 'सर्व पहा',
    cropHealthTitle: 'पीक आरोग्य निदान', uploadPhoto: 'पीक फोटो अपलोड करा',
    takePhoto: 'कॅमेऱ्याने फोटो घ्या', analyzeCropHealth: 'पीक आरोग्य विश्लेषण करा',
    shareHealthReport: 'आरोग्य अहवाल शेअर करा', tipsBetterDiagnosis: 'चांगल्या निदानासाठी टिप्स',
    translateBtn: 'Sarvam AI ने भाषांतर करा', quickPhrases: 'शेतकऱ्यांसाठी त्वरित वाक्ये',
    farmerProfile: 'शेतकरी प्रोफाइल', editBtn: 'संपादित करा', saveProfile: 'प्रोफाइल जतन करा',
    clearProfile: 'प्रोफाइल साफ करा', myCrops: 'माझी पिके', addCrop: 'पीक जोडा', noCrops: 'अजून कोणतेही पीक नाही',
    insuranceTitle: 'विमा सल्लागार', findSchemes: 'माझ्या सर्वोत्तम विमा योजना शोधा',
    enableVoice: 'आवाज सुरू करा', loadingHistory: 'चॅट इतिहास लोड होत आहे...',
    askAnyLang: 'कोणत्याही भाषेत विचारा…', sortedByLatest: 'नवीनतम क्रमानुसार',
    thinkingVoice: 'विचार करत आहे आणि आवाज तयार होत आहे…', researching: 'शोधत आहे…',
    aiModules: 'AI निर्णय मॉड्यूल:', cultivationAdvisor: 'शेती सल्लागार', marketIntelligence: 'बाजार बुद्धिमत्ता',
    audioMode: 'ऑडिओ', textMode: 'मजकूर',
    completeProfile: 'आपली प्रोफाइल पूर्ण करा', findCropAdvice: 'आपल्या पिकाসाठी विशेष सल्ला मिळवा',
    realTimeAdaptation: 'रियल-टाइम अनुकूलन', realTimeAdaptationDesc: 'AI बाजार किमती, हवामान आणि कीड प्रादुर्भावानुसार सतत शिकतो',
    contextualIntelligence: 'संदर्भ बुद्धिमत्ता', contextualIntelligenceDesc: 'मिट्टी, स्थानिक हवामान आणि बाजार कलानुसार वैयक्तिक सल्ला',
    unmatchedScale: 'अतुलनीय प्रमाण', unmatchedScaleDesc: 'फाउंडेशन मॉडेल 15+ भाषा आणि 100+ पीक प्रकार कार्यक्षमतेने हाताळतात',
    langSupported: '15+ भाषा समर्थित',
    agentHeading: 'स्वायत्त बहुभाषिक शेती निर्णय आणि जोखीम बुद्धिमत्ता एजंट',
    agentSubCaption: 'क्रांतिकारी AI एजंट जो आवाज आणि मजकूराद्वारे 15+ भारतीय भाषा समजतो। रिअल-टाइम डेटा, बाजार, हवामान आणि सरकारी योजना एकत्र करून वैयक्तिक शेती मार्गदर्शन देतो.',
    talkToAgent: 'AI एजंटशी बोला',
    enterDetails: 'तपशील प्रविष्ट करा', step1: 'चरण 1', step2: 'चरण 2', step3: 'चरण 3',
    personalDetails: 'वैयक्तिक तपशील', locationLabel: 'स्थान', farmCropDetails: 'शेत आणि पीक तपशील',
    fullName: 'पूर्ण नाव', ageLabel: 'वय', genderLabel: 'लिंग', categoryLabel: 'श्रेणी',
    stateLabel: 'राज्य', districtLabel: 'जिल्हा', primaryCrop: 'प्राथमिक पीक',
    landAcres: 'जमीन (एकर)', farmingType: 'शेतीचा प्रकार', incomeLevel: 'उत्पन्न पातळी',
    analysingAI: 'AI + AWS सह विश्लेषण होत आहे…', bestSchemes: 'सर्वोत्तम जुळणाऱ्या योजना',
    aiAnalysis: 'AI धोरणात्मक विश्लेषण', startOver: 'पुन्हा सुरू करा', voiceFeedbackOn: 'आवाज चालू आहे',
    prefillNote: 'आम्ही आपल्या प्रोफाइलवरून हा फॉर्म भरला आहे. अचूक सूचनांसाठी आवश्यक असल्यास फील्ड अपडेट करा.',
    profileCompletion: 'प्रोफाइल पूर्णता', cropName: 'पिकाचे नाव', areaAcres: 'क्षेत्र (एकर)',
    soilType: 'मातीचा प्रकार', seasonLabel: 'हंगाम', irrigationLabel: 'सिंचन',
    showAdvanced: 'प्रगत तपशील दाखवा', hideAdvanced: 'प्रगत तपशील लपवा',
    varietyCultivar: 'वाण / कल्टीव्हर', notesLabel: 'नोट्स',
    setPrimary: 'प्राथमिक पीक बनवा', setPrimaryDesc: 'AI सल्ला, हवामान सूचना आणि बाजार किमतींसाठी वापरले जाते',
    saveChanges: 'बदल जतन करा', addNewCrop: 'नवीन पीक जोडा', editCrop: 'पीक संपादित करा',
    personalInfo: 'वैयक्तिक माहिती', locationSection: 'स्थान', farmingApproach: 'शेतीचा दृष्टिकोन',
    emailAddress: 'ईमेल पत्ता', fullNameRequired: 'पूर्ण नाव *', phoneNumber: 'फोन नंबर',
    stateRequired: 'राज्य *', districtField: 'जिल्हा', preferredLanguage: 'पसंतीची भाषा',
    loadingCrops: 'पिके लोड होत आहेत...', primaryBadge: 'प्राथमिक',
    profileComplete: 'छान! तुमची प्रोफाइल पूर्णपणे वैयक्तिकृत आहे',
    profileIncomplete: '100% पर्यंत पोहोचण्यासाठी तपशील भरा आणि पिके जोडा',
    cropSubtitle: 'प्रत्येक पिकाचे स्वतःचे क्षेत्र, माती, हंगाम आणि सिंचन ट्रॅक होते',
    addCropsReminder: 'खाली माझी पिके विभागात पिके जोडा — प्रत्येक पिकाला स्वतःचे क्षेत्र, हंगाम, माती प्रकार आणि सिंचन असू शकते.',
    selectCrop: 'पीक निवडा', selectSoil: 'माती निवडा', selectState: 'राज्य निवडा',
    appName: 'AgriSaarthi', appTagline: 'भारताच्या शेतकऱ्यांसाठी AI',
    homeCardDesc: '{state} साठी तुमचा बुद्धिमान शेती मित्र। AI-चालित पीक मार्गदर्शन, रिअल-टाइम बाजार, हवामान सूचना — तुमच्या पसंतीच्या भाषेत।',
    homeCardDescGeneral: 'भारतातील सर्वात व्यापक कृषी प्लॅटफॉर्मवर आपले स्वागत आहे। AI सहाय्य, बाजार माहिती, हवामान अंदाज आणि पीक निदान मिळवा।',
    topicGeneral: 'सामान्य तज्ञ', topicCropDoctor: 'पीक डॉक्टर', topicMarket: 'बाजार भाव', topicWeather: 'हवामान', topicSchemes: 'सरकारी योजना',
    forumAll: 'सर्व', catCropManagement: 'पीक व्यवस्थापन', catPestControl: 'कीड नियंत्रण', catSoilHealth: 'माती आरोग्य', catWaterManagement: 'जल व्यवस्थापन', catMarketAdvisory: 'बाजार सल्ला', catWeatherAdvice: 'हवामान सल्ला', catOrganicFarming: 'सेंद्रिय शेती', catGovtSchemes: 'सरकारी योजना',
    govtSchemesAI: 'AWS ज्ञान आधार आणि myscheme.gov.in वास्तविक-वेळ डेटा वापरून सरकारी योजनांचे AI तज्ञ विश्लेषण।',
    qPhrase1: 'गव्हासाठी सर्वोत्तम खत कोणते?', qPhrase2: 'भात पिकातील कीड कशी नियंत्रित करावी?', qPhrase3: 'बाजारात कांद्याची सध्याची किंमत किती?', qPhrase4: 'खरीप हंगामाच्या बियाण्यांची पेरणी कधी करावी?', qPhrase5: 'चांगल्या उत्पादनासाठी मातीची गुणवत्ता कशी सुधारावी?', qPhrase6: 'गव्हातील गंज रोगाची लक्षणे कोणती?',
    tapSetPrimary: 'कोणत्याही पिकावर ☆ टॅप करा प्राथमिक पीक करण्यासाठी', cropSingular: 'पीक', cropsPlural: 'पिके',
    seasonKharif: 'खरीप (Jun–Nov)', seasonRabi: 'रब्बी (Oct–Apr)', seasonZaid: 'जायद (Mar–Jun)', seasonPerennial: 'बहुवार्षिक', seasonAllSeason: 'सर्व हंगाम',
    irrigRainfed: 'पावसावर अवलंबून', irrigCanal: 'कालवा', irrigDrip: 'ठिबक', irrigSprinkler: 'तुषार सिंचन', irrigBorewell: 'बोरवेल', irrigOther: 'इतर',
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
    home: 'হোম', weather: 'আবহাওয়া', cropHealth: 'ফসলের স্বাস্থ্য', insurance: 'বীমা',
    allQuestions: 'সব প্রশ্ন', myQuestions: 'আমার প্রশ্ন',
    yourLanguage: 'আপনার ভাষা', adminPanel: 'প্রশাসন প্যানেল',
    whatCanIHelp: 'আমি আপনাকে কীভাবে সাহায্য করতে পারি?', tapFeature: 'শুরু করতে যেকোনো বৈশিষ্ট্য চাপুন',
    cropCategories: 'ফসলের বিভাগ', whyAI: 'কৃষিতে AI কেন?',
    latestNews: 'সর্বশেষ কৃষি সংবাদ', viewAll: 'সব দেখুন',
    cropHealthTitle: 'ফসলের স্বাস্থ্য নির্ণয়', uploadPhoto: 'ফসলের ছবি আপলোড করুন',
    takePhoto: 'ক্যামেরা দিয়ে ছবি তুলুন', analyzeCropHealth: 'ফসলের স্বাস্থ্য বিশ্লেষণ করুন',
    shareHealthReport: 'স্বাস্থ্য রিপোর্ট শেয়ার করুন', tipsBetterDiagnosis: 'ভালো নির্ণয়ের টিপস',
    translateBtn: 'Sarvam AI দিয়ে অনুবাদ করুন', quickPhrases: 'কৃষকদের জন্য দ্রুত বাক্যাংশ',
    farmerProfile: 'কৃষকের প্রোফাইল', editBtn: 'সম্পাদনা করুন', saveProfile: 'প্রোফাইল সংরক্ষণ করুন',
    clearProfile: 'প্রোফাইল মুছুন', myCrops: 'আমার ফসল', addCrop: 'ফসল যোগ করুন', noCrops: 'এখনো কোনো ফসল যোগ নেই',
    insuranceTitle: 'বীমা পরামর্শদাতা', findSchemes: 'আমার সেরা বীমা প্রকল্প খুঁজুন',
    enableVoice: 'ভয়েস সক্রিয় করুন', loadingHistory: 'চ্যাট ইতিহাস লোড হচ্ছে...',
    askAnyLang: 'যেকোনো ভাষায় জিজ্ঞেস করুন…', sortedByLatest: 'সর্বশেষ ক্রমে',
    thinkingVoice: 'ভাবছি এবং কণ্ঠস্বর প্রস্তুত করছি…', researching: 'অনুসন্ধান করছি…',
    aiModules: 'AI সিদ্ধান্ত মডিউল:', cultivationAdvisor: 'চাষ পরামর্শদাতা', marketIntelligence: 'বাজার বুদ্ধিমত্তা',
    audioMode: 'অডিও', textMode: 'টেক্সট',
    completeProfile: 'আপনার প্রোফাইল সম্পূর্ণ করুন', findCropAdvice: 'আপনার ফসলের জন্য বিশেষ পরামর্শ পান',
    realTimeAdaptation: 'রিয়েল-টাইম অভিযোজন', realTimeAdaptationDesc: 'AI বাজার মূল্য, আবহাওয়া ও কীটপতঙ্গ প্রাদুর্ভাব অনুযায়ী শেখে',
    contextualIntelligence: 'প্রাসঙ্গিক বুদ্ধিমত্তা', contextualIntelligenceDesc: 'মাটির ধরন, স্থানীয় আবহাওয়া ও বাজারের প্রবণতা বিবেচনা করে পরামর্শ',
    unmatchedScale: 'অতুলনীয় মাত্রা', unmatchedScaleDesc: 'ফাউন্ডেশন মডেল দক্ষতার সাথে 15+ ভাষা ও 100+ ফসল পরিচালনা করে',
    langSupported: '15+ ভাষা সমর্থিত',
    agentHeading: 'স্বায়ত্তশাসিত বহুভাষিক কৃষি সিদ্ধান্ত ও ঝুঁকি বুদ্ধিমত্তা এজেন্ট',
    agentSubCaption: 'বিপ্লবী AI এজেন্ট যা কণ্ঠ ও পাঠ্যের মাধ্যমে 15+ ভারতীয় ভাষা বোঝে। রিয়েল-টাইম ডেটা, বাজার, আবহাওয়া ও সরকারি প্রকল্প একত্রিত করে ব্যক্তিগত কৃষি নির্দেশনা দেয়।',
    talkToAgent: 'AI এজেন্টের সাথে কথা বলুন',
    enterDetails: 'বিবরণ প্রবেশ করান', step1: 'ধাপ ১', step2: 'ধাপ ২', step3: 'ধাপ ৩',
    personalDetails: 'ব্যক্তিগত বিবরণ', locationLabel: 'অবস্থান', farmCropDetails: 'খামার ও ফসলের বিবরণ',
    fullName: 'পুরো নাম', ageLabel: 'বয়স', genderLabel: 'লিঙ্গ', categoryLabel: 'বিভাগ',
    stateLabel: 'রাজ্য', districtLabel: 'জেলা', primaryCrop: 'প্রধান ফসল',
    landAcres: 'জমি (একর)', farmingType: 'চাষের ধরন', incomeLevel: 'আয়ের স্তর',
    analysingAI: 'AI + AWS দিয়ে বিশ্লেষণ হচ্ছে…', bestSchemes: 'সবচেয়ে উপযুক্ত প্রকল্পসমূহ',
    aiAnalysis: 'AI কৌশলগত বিশ্লেষণ', startOver: 'আবার শুরু করুন', voiceFeedbackOn: 'ভয়েস চালু আছে',
    prefillNote: 'আমরা আপনার প্রোফাইল থেকে এই ফর্মটি পূরণ করেছি। সঠিক পরামর্শের জন্য প্রয়োজনীয় ক্ষেত্রগুলি আপডেট করুন।',
    profileCompletion: 'প্রোফাইল সম্পূর্ণতা', cropName: 'ফসলের নাম', areaAcres: 'এলাকা (একর)',
    soilType: 'মাটির ধরন', seasonLabel: 'মৌসুম', irrigationLabel: 'সেচ',
    showAdvanced: 'উন্নত বিবরণ দেখান', hideAdvanced: 'উন্নত বিবরণ লুকান',
    varietyCultivar: 'জাত / কালটিভার', notesLabel: 'নোট',
    setPrimary: 'প্রধান ফসল হিসেবে সেট করুন', setPrimaryDesc: 'AI পরামর্শ, আবহাওয়া সতর্কতা ও বাজার মূল্যের জন্য ব্যবহৃত',
    saveChanges: 'পরিবর্তন সংরক্ষণ করুন', addNewCrop: 'নতুন ফসল যোগ করুন', editCrop: 'ফসল সম্পাদনা করুন',
    personalInfo: 'ব্যক্তিগত তথ্য', locationSection: 'অবস্থান', farmingApproach: 'চাষের পদ্ধতি',
    emailAddress: 'ইমেইল ঠিকানা', fullNameRequired: 'পুরো নাম *', phoneNumber: 'ফোন নম্বর',
    stateRequired: 'রাজ্য *', districtField: 'জেলা', preferredLanguage: 'পছন্দের ভাষা',
    loadingCrops: 'ফসল লোড হচ্ছে...', primaryBadge: 'প্রধান',
    profileComplete: 'দারুণ! আপনার প্রোফাইল সম্পূর্ণরূপে ব্যক্তিগতকৃত',
    profileIncomplete: '100% পৌঁছাতে বিবরণ পূরণ করুন এবং ফসল যোগ করুন',
    cropSubtitle: 'প্রতিটি ফসলের নিজস্ব এলাকা, মাটি, মৌসুম ও সেচ ট্র্যাক হয়',
    addCropsReminder: 'নিচে আমার ফসল বিভাগে ফসল যোগ করুন — প্রতিটি ফসলে নিজস্ব এলাকা, মৌসুম, মাটির ধরন এবং সেচ থাকতে পারে।',
    selectCrop: 'ফসল বেছে নিন', selectSoil: 'মাটি বেছে নিন', selectState: 'রাজ্য বেছে নিন',
    appName: 'AgriSaarthi', appTagline: 'ভারতের কৃষকদের জন্য AI',
    homeCardDesc: '{state}-এর জন্য আপনার বুদ্ধিমান কৃষি সঙ্গী। AI-চালিত ফসল নির্দেশনা, রিয়েল-টাইম বাজার, আবহাওয়া সতর্কতা — আপনার পছন্দের ভাষায়।',
    homeCardDescGeneral: 'ভারতের সবচেয়ে ব্যাপক কৃষি প্ল্যাটফর্মে আপনাকে স্বাগতম। AI সহায়তা, বাজার তথ্য, আবহাওয়া পূর্বাভাস ও ফসল নির্ণয় পান।',
    topicGeneral: 'সাধারণ বিশেষজ্ঞ', topicCropDoctor: 'ফসল ডাক্তার', topicMarket: 'বাজার মূল্য', topicWeather: 'আবহাওয়া', topicSchemes: 'সরকারি প্রকল্প',
    forumAll: 'সব', catCropManagement: 'ফসল ব্যবস্থাপনা', catPestControl: 'কীটপতঙ্গ নিয়ন্ত্রণ', catSoilHealth: 'মাটির স্বাস্থ্য', catWaterManagement: 'জল ব্যবস্থাপনা', catMarketAdvisory: 'বাজার পরামর্শ', catWeatherAdvice: 'আবহাওয়া পরামর্শ', catOrganicFarming: 'জৈব চাষ', catGovtSchemes: 'সরকারি প্রকল্প',
    govtSchemesAI: 'AWS নলেজ বেস ও myscheme.gov.in রিয়েল-টাইম ডেটা ব্যবহার করে সরকারি প্রকল্পের AI বিশেষজ্ঞ বিশ্লেষণ।',
    qPhrase1: 'গমের জন্য সেরা সার কোনটি?', qPhrase2: 'ধানের ফসলে কীটপতঙ্গ কীভাবে নিয়ন্ত্রণ করবেন?', qPhrase3: 'বাজারে পেঁয়াজের বর্তমান মূল্য কত?', qPhrase4: 'খরিফ মৌসুমে বীজ বপনের সঠিক সময় কখন?', qPhrase5: 'ভালো ফলনের জন্য মাটির গুণগত মান কীভাবে উন্নত করবেন?', qPhrase6: 'গমে রাস্ট রোগের লক্ষণ কী?',
    tapSetPrimary: 'যেকোনো ফসলে ☆ ট্যাপ করুন প্রধান ফসল হিসেবে সেট করতে', cropSingular: 'ফসল', cropsPlural: 'ফসল',
    seasonKharif: 'খরিফ (Jun–Nov)', seasonRabi: 'রবি (Oct–Apr)', seasonZaid: 'জায়েদ (Mar–Jun)', seasonPerennial: 'বহুবর্ষজীবী', seasonAllSeason: 'সব মৌসুম',
    irrigRainfed: 'বৃষ্টিনির্ভর', irrigCanal: 'খাল', irrigDrip: 'ড্রিপ', irrigSprinkler: 'স্প্রিংকলার', irrigBorewell: 'বোরওয়েল', irrigOther: 'অন্যান্য',
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
    home: 'హోమ్', weather: 'వాతావరణం', cropHealth: 'పంట ఆరోగ్యం', insurance: 'బీమా',
    allQuestions: 'అన్ని ప్రశ్నలు', myQuestions: 'నా ప్రశ్నలు',
    yourLanguage: 'మీ భాష', adminPanel: 'అడ్మిన్ పానెల్',
    whatCanIHelp: 'నేను మీకు ఎలా సహాయం చేయగలను?', tapFeature: 'ప్రారంభించడానికి ఏదైనా వైశిష్ట్యాన్ని నొక్కండి',
    cropCategories: 'పంట వర్గాలు', whyAI: 'వ్యవసాయానికి AI ఎందుకు?',
    latestNews: 'తాజా వ్యవసాయ వార్తలు', viewAll: 'అన్నీ చూడండి',
    cropHealthTitle: 'పంట ఆరోగ్య వ్యాధి నిర్ధారణ', uploadPhoto: 'పంట ఫోటో అప్‌లోడ్ చేయండి',
    takePhoto: 'కెమెరాతో ఫోటో తీయండి', analyzeCropHealth: 'పంట ఆరోగ్యాన్ని విశ్లేషించండి',
    shareHealthReport: 'ఆరోగ్య నివేదిక స్ట్రీమ్ చేయండి', tipsBetterDiagnosis: 'మెరుగైన నిర్ధారణకు చిట్కాలు',
    translateBtn: 'Sarvam AI తో అనువదించండి', quickPhrases: 'రైతులకు త్వరిత వాక్యాలు',
    farmerProfile: 'రైతు ప్రొఫైల్', editBtn: 'సవరించు', saveProfile: 'ప్రొఫైల్ సేవ్ చేయండి',
    clearProfile: 'ప్రొఫైల్ తొలగించు', myCrops: 'నా పంటలు', addCrop: 'పంట జోడించు', noCrops: 'ఇంకా ధాన్యం జోడించలేదు',
    insuranceTitle: 'బీమా సలహాదారు', findSchemes: 'నా ఉత్తమ బీమా పథకాలు కనుగొనండి',
    enableVoice: 'వాయిస్ ఆన్ చేయండి', loadingHistory: 'చాట్ చరిత్ర లోడ్ అవుతున్నది...',
    askAnyLang: 'ఏ భాషలోనైనా అడగండి…', sortedByLatest: 'తాజా క్రమంలో',
    thinkingVoice: 'ఆలోచిస్తూ వాయిస్ సిద్ధం చేస్తున్నాను…', researching: 'పరిశోధిస్తున్నాను…',
    aiModules: 'AI నిర్ణయ మాడ్యూళ్లు:', cultivationAdvisor: 'సాగు సలహాదారు', marketIntelligence: 'మార్కెట్ మేధస్సు',
    audioMode: 'ఆడియో', textMode: 'టెక్స్ట్',
    completeProfile: 'మీ ప్రొఫైల్ పూర్తి చేయండి', findCropAdvice: 'మీ పంట కోసం ప్రత్యేక సలహా పొందండి',
    realTimeAdaptation: 'రియల్-టైమ్ అనుకూలత', realTimeAdaptationDesc: 'AI మార్కెట్ ధరలు, వాతావరణం మరియు తెగుళ్ల ప్రకోపం ఆధారంగా నేర్చుకుంటుంది',
    contextualIntelligence: 'సందర్భిక మేధస్సు', contextualIntelligenceDesc: 'మట్టి రకం, స్థానిక వాతావరణం మరియు మార్కెట్ ధోరణులను పరిగణించి సలహా',
    unmatchedScale: 'అసాధారణ స్థాయి', unmatchedScaleDesc: 'ఫౌండేషన్ మోడళ్లు 15+ భాషలు మరియు 100+ పంట రకాలను సమర్థంగా నిర్వహిస్తాయి',
    langSupported: '15+ భాషలు మద్దతు ఉన్నాయి',
    agentHeading: 'స్వతంత్ర బహుభాషా వ్యవసాయ నిర్ణయ మరియు రిస్క్ ఇంటెలిజెన్స్ ఏజెంట్',
    agentSubCaption: 'వాయిస్ మరియు టెక్స్ట్ ద్వారా 15+ భారతీయ భాషలు అర్థం చేసుకునే విప్లవాత్మక AI. రియల్-టైమ్ డేటా, మార్కెట్, వాతావరణం మరియు ప్రభుత్వ పథకాలు కలిపి వ్యక్తిగత మార్గదర్శకం అందిస్తుంది.',
    talkToAgent: 'AI ఏజెంట్‌తో మాట్లాడండి',
    enterDetails: 'వివరాలు నమోదు చేయండి', step1: 'దశ 1', step2: 'దశ 2', step3: 'దశ 3',
    personalDetails: 'వ్యక్తిగత వివరాలు', locationLabel: 'స్థానం', farmCropDetails: 'వ్యవసాయం మరియు పంట వివరాలు',
    fullName: 'పూర్తి పేరు', ageLabel: 'వయస్సు', genderLabel: 'లింగం', categoryLabel: 'వర్గం',
    stateLabel: 'రాష్ట్రం', districtLabel: 'జిల్లా', primaryCrop: 'ప్రాథమిక పంట',
    landAcres: 'భూమి (ఎకరాలు)', farmingType: 'వ్యవసాయ రకం', incomeLevel: 'ఆదాయ స్థాయి',
    analysingAI: 'AI + AWS తో విశ్లేషిస్తున్నాము…', bestSchemes: 'అత్యంత సరిపోయే పథకాలు',
    aiAnalysis: 'AI వ్యూహాత్మక విశ్లేషణ', startOver: 'మళ్ళీ ప్రారంభించండి', voiceFeedbackOn: 'వాయిస్ ఆన్ ఉంది',
    prefillNote: 'మీ ప్రొఫైల్ నుండి ఈ ఫారమ్ నింపాము. ఖచ్చితమైన సూచనల కోసం అవసరమైన ఫీల్డ్‌లను నవీకరించండి.',
    profileCompletion: 'ప్రొఫైల్ పూర్తి', cropName: 'పంట పేరు', areaAcres: 'విస్తీర్ణం (ఎకరాలు)',
    soilType: 'మట్టి రకం', seasonLabel: 'సీజన్', irrigationLabel: 'నీటి పారుదల',
    showAdvanced: 'అధునాతన వివరాలు చూపించు', hideAdvanced: 'అధునాతన వివరాలు దాచు',
    varietyCultivar: 'రకం / కల్టీవర్', notesLabel: 'గమనికలు',
    setPrimary: 'ప్రాథమిక పంటగా సెట్ చేయండి', setPrimaryDesc: 'AI సలహా, వాతావరణ హెచ్చరికలు మరియు మార్కెట్ ధరలకు వినియోగించబడుతుంది',
    saveChanges: 'మార్పులు సేవ్ చేయండి', addNewCrop: 'కొత్త పంట జోడించండి', editCrop: 'పంట సవరించండి',
    personalInfo: 'వ్యక్తిగత సమాచారం', locationSection: 'స్థానం', farmingApproach: 'వ్యవసాయ విధానం',
    emailAddress: 'ఇమెయిల్ చిరునామా', fullNameRequired: 'పూర్తి పేరు *', phoneNumber: 'ఫోన్ నంబర్',
    stateRequired: 'రాష్ట్రం *', districtField: 'జిల్లా', preferredLanguage: 'ఇష్టమైన భాష',
    loadingCrops: 'పంటలు లోడ్ అవుతున్నాయి...', primaryBadge: 'ప్రాథమిక',
    profileComplete: 'బాగుంది! మీ ప్రొఫైల్ పూర్తిగా వ్యక్తిగతీకరించబడింది',
    profileIncomplete: '100% చేరుకోవడానికి వివరాలు నింపండి మరియు పంటలు జోడించండి',
    cropSubtitle: 'ప్రతి పంపటికి స్వంత విస్తీర్ణం, మట్టి, సీజన్ మరియు నీటి పారుదల ట్రాక్ అవుతుంది',
    addCropsReminder: 'దిగువన నా పంటలు విభాగంలో పంటలు జోడించండి — ప్రతి పంటలో స్వంత విస్తీర్ణం, సీజన్, మట్టి రకం మరియు నీటి పారుదల ఉండవచ్చు.',
    selectCrop: 'పంట ఎంచుకోండి', selectSoil: 'మట్టి ఎంచుకోండి', selectState: 'రాష్ట్రం ఎంచుకోండి',
    appName: 'AgriSaarthi', appTagline: 'భారత్ రైతులకు AI',
    homeCardDesc: '{state} కోసం మీ తెలివైన వ్యవసాయ సహాయకుడు. AI-ఆధారిత పంట మార్గదర్శనం, రియల్-టైమ్ మార్కెట్, వాతావరణ హెచ్చరికలు — మీకు ఇష్టమైన భాషలో.',
    homeCardDescGeneral: 'భారత్ అత్యంత సమగ్ర వ్యవసాయ వేదికకు స్వాగతం. AI సహాయం, మార్కెట్ సమాచారం, వాతావరణ అంచనాలు, పంట నిర్ధారణ పొందండి.',
    topicGeneral: 'సాధారణ నిపుణుడు', topicCropDoctor: 'పంట డాక్టర్', topicMarket: 'మార్కెట్ ధరలు', topicWeather: 'వాతావరణం', topicSchemes: 'ప్రభుత్వ పథకాలు',
    forumAll: 'అన్ని', catCropManagement: 'పంట నిర్వహణ', catPestControl: 'తెగులు నియంత్రణ', catSoilHealth: 'మట్టి ఆరోగ్యం', catWaterManagement: 'జల నిర్వహణ', catMarketAdvisory: 'మార్కెట్ సలహా', catWeatherAdvice: 'వాతావరణ సలహా', catOrganicFarming: 'సేంద్రీయ వ్యవసాయం', catGovtSchemes: 'ప్రభుత్వ పథకాలు',
    govtSchemesAI: 'AWS నాలెడ్జ్ బేస్ & myscheme.gov.in రియల్-టైమ్ డేటా ఉపయోగించి ప్రభుత్వ పథకాల AI నిపుణ విశ్లేషణ.',
    qPhrase1: 'గోధుమలకు ఉత్తమ ఎరువు ఏది?', qPhrase2: 'వరి పంటలో తెగుళ్లను ఎలా నియంత్రించాలి?', qPhrase3: 'మార్కెట్లో ఉల్లిపాయ ప్రస్తుత ధర ఎంత?', qPhrase4: 'ఖరీఫ్ సీజన్ విత్తనాలు ఎప్పుడు నాటాలి?', qPhrase5: 'మెరుగైన దిగుబడికి మట్టి నాణ్యతను ఎలా మెరుగుపరచాలి?', qPhrase6: 'గోధుమలో రస్ట్ వ్యాధి లక్షణాలేమిటి?',
    tapSetPrimary: 'ఏ పంటపైనైనా ☆ నొక్కండి ప్రాథమికంగా సెట్ చేయడానికి', cropSingular: 'పంట', cropsPlural: 'పంటలు',
    seasonKharif: 'ఖరీఫ్ (Jun–Nov)', seasonRabi: 'రబీ (Oct–Apr)', seasonZaid: 'జైద్ (Mar–Jun)', seasonPerennial: 'బహువార్షిక', seasonAllSeason: 'అన్ని సీజన్లు',
    irrigRainfed: 'వర్షాధారిత', irrigCanal: 'కాలువ', irrigDrip: 'డ్రిప్', irrigSprinkler: 'స్ప్రింక్లర్', irrigBorewell: 'బోర్వెల్', irrigOther: 'ఇతర',
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
    home: 'முகப்பு', weather: 'வானிலை', cropHealth: 'பயிர் ஆரோக்கியம்', insurance: 'காப்பீடு',
    allQuestions: 'அனைத்து கேள்விகளும்', myQuestions: 'என் கேள்விகள்',
    yourLanguage: 'உங்கள் மொழி', adminPanel: 'நிர்வாக பலக்',
    whatCanIHelp: 'நான் உங்களுக்கு எவ்வாறு உதவ முடியும்?', tapFeature: 'தொடங்க எந்த அம்சத்தையும் தட்டுங்கள்',
    cropCategories: 'பயிர் வகைகள்', whyAI: 'விவசாயத்திற்கு AI ஏன்?',
    latestNews: 'சமீபத்திய விவசாய செய்திகள்', viewAll: 'அனைத்தும் காண்க',
    cropHealthTitle: 'பயிர் நலன் கண்டறிதல்', uploadPhoto: 'பயிர் படம் அப்‌லோடும்',
    takePhoto: 'கேமராவால் படம் எடுக்கவும்', analyzeCropHealth: 'பயிர் நலனை பகுப்பாய்வு செய்யவும்',
    shareHealthReport: 'நலன் அறிக்கை பகிர்வும்', tipsBetterDiagnosis: 'சிறந்த கண்டறிதலுக்கான உத்திகள்',
    translateBtn: 'Sarvam AI மூலம் மொழிபெயர்க்கவும்', quickPhrases: 'விவசாயிகளுக்கு விரைவு வாக்கியங்கள்',
    farmerProfile: 'விவசாயி சுயவிவரம்', editBtn: 'திருத்தவும்', saveProfile: 'சுயவிவரம் சேமிக்கவும்',
    clearProfile: 'சுயவிவரம் அழிக்கவும்', myCrops: 'என் பயிர்கள்', addCrop: 'பயிர் சேர்க்கவும்', noCrops: 'இன்சூது பயிர் சேர்க்கப்படவில்லை',
    insuranceTitle: 'காப்பீடு ஆலோசகர்', findSchemes: 'என் சிறந்த காப்பீட்டு திட்டங்களை கண்டறியவும்',
    enableVoice: 'குரலை இயக்கவும்', loadingHistory: 'அரட்டை வரலாறு ஏற்றுகிறது...',
    askAnyLang: 'எந்த மொழியிலும் கேளுங்கள்…', sortedByLatest: 'சமீபத்திய வரிசையில்',
    thinkingVoice: 'சிந்திக்கிறேன் மற்றும் குரலை தயார் செய்கிறேன்…', researching: 'ஆராய்கிறேன்…',
    aiModules: 'AI முடிவு தொகுதிகள்:', cultivationAdvisor: 'சாகுபடி ஆலோசகர்', marketIntelligence: 'சந்தை நுண்ணறிவு',
    audioMode: 'ஆடியோ', textMode: 'உரை',
    completeProfile: 'உங்கள் சுயவிவரத்தை நிறைவு செய்யுங்கள்', findCropAdvice: 'உங்கள் பயிருக்கான சிறப்பு ஆலோசனை பெறுங்கள்',
    realTimeAdaptation: 'நிகழ்நேர தகவமைப்பு', realTimeAdaptationDesc: 'AI சந்தை விலைகள், வானிலை மற்றும் பூச்சி தாக்குதலின்படி தொடர்ந்து கற்கிறது',
    contextualIntelligence: 'சூழல் நுண்ணறிவு', contextualIntelligenceDesc: 'மண் வகை, உள்ளூர் வானிலை மற்றும் சந்தை போக்குகளை கணக்கில் எடுத்து ஆலோசனை',
    unmatchedScale: 'இணையற்ற அளவு', unmatchedScaleDesc: 'அடிப்படை மாதிரிகள் 15+ மொழிகளையும் 100+ பயிர் வகைகளையும் திறமையாக கையாளுகின்றன',
    langSupported: '15+ மொழிகள் ஆதரிக்கப்படுகின்றன',
    agentHeading: 'தன்னாட்சி பன்மொழி விவசாய முடிவு மற்றும் ஆபத்து நுண்ணறிவு முகவர்',
    agentSubCaption: 'குரல் மற்றும் உரை மூலம் 15+ இந்திய மொழிகளை புரிந்துகொள்ளும் புரட்சிகர AI. நிகழ்நேர தரவு, சந்தை, வானிலை மற்றும் அரசு திட்டங்களை இணைத்து தனிப்பயன் வழிகாட்டுதல் அளிக்கிறது.',
    talkToAgent: 'AI முகவரிடம் பேசுங்கள்',
    enterDetails: 'விவரங்களை உள்ளிடுங்கள்', step1: 'படி 1', step2: 'படி 2', step3: 'படி 3',
    personalDetails: 'தனிப்பட்ட விவரங்கள்', locationLabel: 'இடம்', farmCropDetails: 'பண்ணை மற்றும் பயிர் விவரங்கள்',
    fullName: 'முழு பெயர்', ageLabel: 'வயது', genderLabel: 'பாலினம்', categoryLabel: 'வகை',
    stateLabel: 'மாநிலம்', districtLabel: 'மாவட்டம்', primaryCrop: 'முதன்மை பயிர்',
    landAcres: 'நிலம் (ஏக்கர்)', farmingType: 'விவசாய வகை', incomeLevel: 'வருமான நிலை',
    analysingAI: 'AI + AWS மூலம் பகுப்பாய்வு செய்கிறோம்…', bestSchemes: 'சிறப்பான பொருந்தும் திட்டங்கள்',
    aiAnalysis: 'AI மூலோபாய பகுப்பாய்வு', startOver: 'மீண்டும் தொடங்குங்கள்', voiceFeedbackOn: 'குரல் இயங்குகிறது',
    prefillNote: 'உங்கள் சுயவிவரத்திலிருந்து இந்த படிவத்தை நிரப்பியுள்ளோம். துல்லியமான பரிந்துரைகளுக்கு தேவையான புலங்களை புதுப்பிக்கவும்.',
    profileCompletion: 'சுயவிவர நிறைவு', cropName: 'பயிர் பெயர்', areaAcres: 'பரப்பளவு (ஏக்கர்)',
    soilType: 'மண் வகை', seasonLabel: 'பருவம்', irrigationLabel: 'நீர்ப்பாசனம்',
    showAdvanced: 'மேம்பட்ட விவரங்களைக் காட்டு', hideAdvanced: 'மேம்பட்ட விவரங்களை மறை',
    varietyCultivar: 'ரகம் / கல்டிவார்', notesLabel: 'குறிப்புகள்',
    setPrimary: 'முதன்மை பயிராக அமை', setPrimaryDesc: 'AI ஆலோசனை, வானிலை எச்சரிக்கைகள் மற்றும் சந்தை விலைகளுக்கு பயன்படுத்தப்படுகிறது',
    saveChanges: 'மாற்றங்களை சேமிக்கவும்', addNewCrop: 'புதிய பயிர் சேர்க்கவும்', editCrop: 'பயிரை திருத்தவும்',
    personalInfo: 'தனிப்பட்ட தகவல்', locationSection: 'இடம்', farmingApproach: 'விவசாய அணுகுமுறை',
    emailAddress: 'மின்னஞ்சல் முகவரி', fullNameRequired: 'முழு பெயர் *', phoneNumber: 'தொலைபேசி எண்',
    stateRequired: 'மாநிலம் *', districtField: 'மாவட்டம்', preferredLanguage: 'விருப்பமான மொழி',
    loadingCrops: 'பயிர்கள் ஏற்றப்படுகின்றன...', primaryBadge: 'முதன்மை',
    profileComplete: 'சிறப்பு! உங்கள் சுயவிவரம் முழுமையாக தனிப்பயனாக்கப்பட்டுள்ளது',
    profileIncomplete: '100% அடைய விவரங்களை நிரப்பி பயிர்களை சேர்க்கவும்',
    cropSubtitle: 'ஒவ்வொரு பயிருக்கும் அதன் பரப்பளவு, மண், பருவம் மற்றும் நீர்ப்பாசனம் கண்காணிக்கப்படுகிறது',
    addCropsReminder: 'கீழே என் பயிர்கள் பகுதியில் பயிர்களை சேர்க்கவும் — ஒவ்வொரு பயிருக்கும் அதன் பரப்பளவு, பருவம், மண் வகை மற்றும் நீர்ப்பாசனம் இருக்கலாம்.',
    selectCrop: 'பயிரை தேர்ந்தெடுக்கவும்', selectSoil: 'மண்ணை தேர்ந்தெடுக்கவும்', selectState: 'மாநிலத்தை தேர்ந்தெடுக்கவும்',
    appName: 'AgriSaarthi', appTagline: 'பாரத விவசாயிகளுக்கான AI',
    homeCardDesc: '{state} க்கான உங்கள் புத்திசாலி விவசாய நண்பன். AI-இயக்கப்படும் பயிர் வழிகாட்டல், நிகழ்நேர சந்தை, வானிலை எச்சரிக்கைகள் — உங்கள் விருப்ப மொழியில்.',
    homeCardDescGeneral: 'இந்தியாவின் மிக விரிவான விவசாய தளத்திற்கு வரவேற்கிறோம். AI உதவி, சந்தை தகவல்கள், வானிலை முன்னறிவிப்புகள், பயிர் கண்டறிதல் பெறுங்கள்.',
    topicGeneral: 'பொது நிபுணர்', topicCropDoctor: 'பயிர் மருத்துவர்', topicMarket: 'சந்தை விலைகள்', topicWeather: 'வானிலை', topicSchemes: 'அரசு திட்டங்கள்',
    forumAll: 'அனைத்தும்', catCropManagement: 'பயிர் மேலாண்மை', catPestControl: 'பூச்சி கட்டுப்பாடு', catSoilHealth: 'மண் ஆரோக்கியம்', catWaterManagement: 'நீர் மேலாண்மை', catMarketAdvisory: 'சந்தை ஆலோசனை', catWeatherAdvice: 'வானிலை ஆலோசனை', catOrganicFarming: 'இயற்கை விவசாயம்', catGovtSchemes: 'அரசு திட்டங்கள்',
    govtSchemesAI: 'AWS நாலெட்ஜ் பேஸ் மற்றும் myscheme.gov.in நிகழ்நேர தரவைப் பயன்படுத்தி அரசு திட்டங்களின் AI நிபுண பகுப்பாய்வு.',
    qPhrase1: 'கோதுமைக்கு சிறந்த உரம் எது?', qPhrase2: 'நெல் பயிரில் பூச்சிகளை எப்படி கட்டுப்படுத்துவது?', qPhrase3: 'சந்தையில் வெங்காயத்தின் தற்போதைய விலை என்ன?', qPhrase4: 'கரீஃப் பருவத்தில் விதைகளை எப்போது விதைக்க வேண்டும்?', qPhrase5: 'சிறந்த விளைச்சலுக்கு மண் தரத்தை எவ்வாறு மேம்படுத்துவது?', qPhrase6: 'கோதுமையில் துரு நோயின் அறிகுறிகள் என்ன?',
    tapSetPrimary: 'எந்த பயிரிலும் ☆ தட்டவும் அதை முதன்மையாக அமைக்க', cropSingular: 'பயிர்', cropsPlural: 'பயிர்கள்',
    seasonKharif: 'கரீஃப் (Jun–Nov)', seasonRabi: 'ரபீ (Oct–Apr)', seasonZaid: 'ஜைத் (Mar–Jun)', seasonPerennial: 'பன்னாண்டு', seasonAllSeason: 'அனைத்து பருவமும்',
    irrigRainfed: 'மழையை நம்பி', irrigCanal: 'கால்வாய்', irrigDrip: 'டிரிப்', irrigSprinkler: 'ஸ்பிரிங்கிளர்', irrigBorewell: 'போர்வெல்', irrigOther: 'மற்றவை',
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
    home: 'ಮುಖಪುಟ', weather: 'ಹವಾಮಾನ', cropHealth: 'ಬೆಳೆ ಆರೋಗ್ಯ', insurance: 'ವಿಮೆ',
    allQuestions: 'ಎಲ್ಲಾ ಪ್ರಶ್ನೆಗಳು', myQuestions: 'ನನ್ನ ಪ್ರಶ್ನೆಗಳು',
    yourLanguage: 'ನಿಮ್ಮ ಭಾಷೆ', adminPanel: 'ಆಡ್ಮಿನ್ ಪ್ಯಾನಲ್',
    whatCanIHelp: 'ನಾನು ನಿಮಗೆ ಹೇಗೆ ಸಹಾಯ ಮಾಡಲಿ?', tapFeature: 'ಪ್ರಾರಂಭಿಸಲು ಯಾವುದಾದರೂ ವೈಶಿಷ್ಟ್ಯವನ್ನು ಟ್ಯಾಪ್ ಮಾಡಿ',
    cropCategories: 'ಬೆಳೆ ವರ್ಗಗಳು', whyAI: 'ಕೃಷಿಗೆ AI ಯಾಕೆ?',
    latestNews: 'ಇತ್ತೀಚಿನ ಕೃಷಿ ಸುದ್ದಿ', viewAll: 'ಎಲ್ಲವನ್ನೂ ನೋಡಿ',
    cropHealthTitle: 'ಬೆಳೆ ಆರೋಗ್ಯ ರೋಗ ನಿರ್ಣಯ', uploadPhoto: 'ಬೆಳೆ ಫೋಟೋ ಅಪ್‌ಲೋಡ್ ಮಾಡಿ',
    takePhoto: 'ಕ್ಯಾಮೆರಾದಿಂದ ಫೋಟೋ ತೆಗೆಯಿರಿ', analyzeCropHealth: 'ಬೆಳೆ ಆರೋಗ್ಯ ವಿಶ್ಲೇಷಿಸಿ',
    shareHealthReport: 'ಆರೋಗ್ಯ ವರದಿ ಹಂಚಿಕೊಳ್ಳಿ', tipsBetterDiagnosis: 'ನಿಖರವಾದ ರೋಗ ನಿರ್ಣಯಕ್ಕೆ ಸೂಚನೆಗಳು',
    translateBtn: 'Sarvam AI ನಿಂದ ಅನುವಾದಿಸಿ', quickPhrases: 'ರೈತರಿಗೆ ತ್ವರಿತ ವಾಕ್ಯಗಳು',
    farmerProfile: 'ರೈತ ಪ್ರೊಫೈಲ್', editBtn: 'ಸಂಪಾದಿಸಿ', saveProfile: 'ಪ್ರೊಫೈಲ್ ಉಳಿಸಿ',
    clearProfile: 'ಪ್ರೊಫೈಲ್ ತೆರವುಗೊಳಿಸಿ', myCrops: 'ನನ್ನ ಬೆಳೆಗಳು', addCrop: 'ಬೆಳೆ ಸೇರಿಸಿ', noCrops: 'ಇನ್ನೂ ಯಾವುದೇ ಬೆಳೆ ಸೇರಿಸಾವಲ್ಲ',
    insuranceTitle: 'ವಿಮೆ ಸಲಹೆಗಾರ', findSchemes: 'ನನ್ನ ಅತ್ಯುತ್ತಮ ವಿಮೆ ಯೋಜನೆಗಳನ್ನು ಹುಡುಕಿ',
    enableVoice: 'ಧ್ವನಿ ಸಕ್ರಿಯಗೊಳಿಸಿ', loadingHistory: 'ಚಾಟ್ ಇತಿಹಾಸ ಲೋಡ್ ಆಗುತ್ತಿದೆ...',
    askAnyLang: 'ಯಾವುದೇ ಭಾಷೆಯಲ್ಲಿ ಕೇಳಿ…', sortedByLatest: 'ಇತ್ತೀಚಿನ ಕ್ರಮದಲ್ಲಿ',
    thinkingVoice: 'ಆಲೋಚಿಸುತ್ತಿದ್ದೇನೆ ಮತ್ತು ಧ್ವನಿ ಸಿದ್ಧಪಡಿಸುತ್ತಿದ್ದೇನೆ…', researching: 'ಹುಡುಕುತ್ತಿದ್ದೇನೆ…',
    aiModules: 'AI ನಿರ್ಧಾರ ಮಾಡ್ಯೂಲ್‌ಗಳು:', cultivationAdvisor: 'ಕೃಷಿ ಸಲಹೆಗಾರ', marketIntelligence: 'ಮಾರುಕಟ್ಟೆ ಬುದ್ಧಿಮತ್ತೆ',
    audioMode: 'ಆಡಿಯೋ', textMode: 'ಪಠ್ಯ',
    completeProfile: 'ನಿಮ್ಮ ಪ್ರೊಫೈಲ್ ಪೂರ್ಣಗೊಳಿಸಿ', findCropAdvice: 'ನಿಮ್ಮ ಬೆಳೆಗಾಗಿ ವಿಶೇಷ ಸಲಹೆ ಪಡೆಯಿರಿ',
    realTimeAdaptation: 'ರಿಯಲ್-ಟೈಮ್ ಹೊಂದಾಣಿಕೆ', realTimeAdaptationDesc: 'AI ಮಾರುಕಟ್ಟೆ ಬೆಲೆಗಳು, ಹವಾಮಾನ ಮತ್ತು ಕೀಟ ಪ್ರಾದುರ್ಭಾವಕ್ಕೆ ಅನುಗುಣವಾಗಿ ಕಲಿಯುತ್ತದೆ',
    contextualIntelligence: 'ಸಾಂದರ್ಭಿಕ ಬುದ್ಧಿಮತ್ತೆ', contextualIntelligenceDesc: 'ಮಣ್ಣಿನ ಪ್ರಕಾರ, ಸ್ಥಳೀಯ ಹವಾಮಾನ ಮತ್ತು ಮಾರುಕಟ್ಟೆ ಪ್ರವೃತ್ತಿಗಳನ್ನು ಪರಿಗಣಿಸಿ ಸಲಹೆ',
    unmatchedScale: 'ಹೋಲಿಸಲಾಗದ ಪ್ರಮಾಣ', unmatchedScaleDesc: 'ಫೌಂಡೇಶನ್ ಮಾದರಿಗಳು 15+ ಭಾಷೆಗಳನ್ನು ಮತ್ತು 100+ ಬೆಳೆ ವಿಧಗಳನ್ನು ಸಮರ್ಥವಾಗಿ ನಿರ್ವಹಿಸುತ್ತವೆ',
    langSupported: '15+ ಭಾಷೆಗಳು ಬೆಂಬಲಿತವಾಗಿವೆ',
    agentHeading: 'ಸ್ವತಂತ್ರ ಬಹುಭಾಷೀಯ ಕೃಷಿ ನಿರ್ಧಾರ ಮತ್ತು ಅಪಾಯ ಬುದ್ಧಿಮತ್ತೆ ಏಜೆಂಟ್',
    agentSubCaption: 'ಧ್ವನಿ ಮತ್ತು ಪಠ್ಯ ಮೂಲಕ 15+ ಭಾರತೀಯ ಭಾಷೆಗಳನ್ನು ಅರ್ಥಮಾಡಿಕೊಳ್ಳುವ ಕ್ರಾಂತಿಕಾರಿ AI. ರಿಯಲ್-ಟೈಮ್ ಡೇಟಾ, ಮಾರುಕಟ್ಟೆ, ಹವಾಮಾನ ಮತ್ತು ಸರ್ಕಾರಿ ಯೋಜನೆಗಳನ್ನು ಸೇರಿಸಿ ವೈಯಕ್ತಿಕ ಮಾರ್ಗದರ್ಶನ ನೀಡುತ್ತದೆ.',
    talkToAgent: 'AI ಏಜೆಂಟ್‌ನೊಂದಿಗೆ ಮಾತನಾಡಿ',
    enterDetails: 'ವಿವರಗಳನ್ನು ನಮೂದಿಸಿ', step1: 'ಹಂತ 1', step2: 'ಹಂತ 2', step3: 'ಹಂತ 3',
    personalDetails: 'ವೈಯಕ್ತಿಕ ವಿವರಗಳು', locationLabel: 'ಸ್ಥಳ', farmCropDetails: 'ಜಮೀನು ಮತ್ತು ಬೆಳೆ ವಿವರಗಳು',
    fullName: 'ಪೂರ್ಣ ಹೆಸರು', ageLabel: 'ವಯಸ್ಸು', genderLabel: 'ಲಿಂಗ', categoryLabel: 'ವರ್ಗ',
    stateLabel: 'ರಾಜ್ಯ', districtLabel: 'ಜಿಲ್ಲೆ', primaryCrop: 'ಪ್ರಾಥಮಿಕ ಬೆಳೆ',
    landAcres: 'ಭೂಮಿ (ಎಕರೆ)', farmingType: 'ಕೃಷಿ ವಿಧ', incomeLevel: 'ಆದಾಯ ಮಟ್ಟ',
    analysingAI: 'AI + AWS ಜೊತೆ ವಿಶ್ಲೇಷಣೆ ನಡೆಯುತ್ತಿದೆ…', bestSchemes: 'ಅತ್ಯಂತ ಹೊಂದಿಕೆಯಾಗುವ ಯೋಜನೆಗಳು',
    aiAnalysis: 'AI ಕಾರ್ಯತಂತ್ರ ವಿಶ್ಲೇಷಣೆ', startOver: 'ಮತ್ತೆ ಶುರು ಮಾಡಿ', voiceFeedbackOn: 'ಧ್ವನಿ ಆನ್ ಆಗಿದೆ',
    prefillNote: 'ನಿಮ್ಮ ಪ್ರೊಫೈಲ್‌ನಿಂದ ಈ ಫಾರ್ಮ್ ತುಂಬಿದ್ದೇವೆ. ನಿಖರವಾದ ಸೂಚನೆಗಳಿಗಾಗಿ ಅಗತ್ಯ ಕ್ಷೇತ್ರಗಳನ್ನು ನವೀಕರಿಸಿ.',
    profileCompletion: 'ಪ್ರೊಫೈಲ್ ಪೂರ್ಣತೆ', cropName: 'ಬೆಳೆಯ ಹೆಸರು', areaAcres: 'ಪ್ರದೇಶ (ಎಕರೆ)',
    soilType: 'ಮಣ್ಣಿನ ವಿಧ', seasonLabel: 'ಋತು', irrigationLabel: 'ನೀರಾವರಿ',
    showAdvanced: 'ಸುಧಾರಿತ ವಿವರಗಳನ್ನು ತೋರಿಸಿ', hideAdvanced: 'ಸುಧಾರಿತ ವಿವರಗಳನ್ನು ಮರೆಮಾಡಿ',
    varietyCultivar: 'ತಳಿ / ಕಲ್ಟಿವಾರ್', notesLabel: 'ಟಿಪ್ಪಣಿಗಳು',
    setPrimary: 'ಪ್ರಾಥಮಿಕ ಬೆಳೆ ಎಂದು ಹೊಂದಿಸಿ', setPrimaryDesc: 'AI ಸಲಹೆ, ಹವಾಮಾನ ಎಚ್ಚರಿಕೆಗಳು ಮತ್ತು ಮಾರುಕಟ್ಟೆ ಬೆಲೆಗಳಿಗೆ ಬಳಸಲಾಗುತ್ತದೆ',
    saveChanges: 'ಬದಲಾವಣೆಗಳನ್ನು ಉಳಿಸಿ', addNewCrop: 'ಹೊಸ ಬೆಳೆ ಸೇರಿಸಿ', editCrop: 'ಬೆಳೆ ಸಂಪಾದಿಸಿ',
    personalInfo: 'ವೈಯಕ್ತಿಕ ಮಾಹಿತಿ', locationSection: 'ಸ್ಥಳ', farmingApproach: 'ಕೃಷಿ ವಿಧಾನ',
    emailAddress: 'ಇಮೇಲ್ ವಿಳಾಸ', fullNameRequired: 'ಪೂರ್ಣ ಹೆಸರು *', phoneNumber: 'ಫೋನ್ ಸಂಖ್ಯೆ',
    stateRequired: 'ರಾಜ್ಯ *', districtField: 'ಜಿಲ್ಲೆ', preferredLanguage: 'ಆದ್ಯತೆಯ ಭಾಷೆ',
    loadingCrops: 'ಬೆಳೆಗಳು ಲೋಡ್ ಆಗುತ್ತಿವೆ...', primaryBadge: 'ಪ್ರಾಥಮಿಕ',
    profileComplete: 'ಅದ್ಭುತ! ನಿಮ್ಮ ಪ್ರೊಫೈಲ್ ಸಂಪೂರ್ಣವಾಗಿ ವೈಯಕ್ತಿಕಗೊಳಿಸಲಾಗಿದೆ',
    profileIncomplete: '100% ತಲುಪಲು ವಿವರಗಳನ್ನು ತುಂಬಿ ಬೆಳೆಗಳನ್ನು ಸೇರಿಸಿ',
    cropSubtitle: 'ಪ್ರತಿ ಬೆಳೆಯ ಸ್ವಂತ ಪ್ರದೇಶ, ಮಣ್ಣು, ಋತು ಮತ್ತು ನೀರಾವರಿ ಟ್ರ್ಯಾಕ್ ಆಗುತ್ತದೆ',
    addCropsReminder: 'ಕೆಳಗಡೆ ನನ್ನ ಬೆಳೆಗಳು ವಿಭಾಗದಲ್ಲಿ ಬೆಳೆಗಳನ್ನು ಸೇರಿಸಿ — ಪ್ರತಿ ಬೆಳೆಗೆ ಸ್ವಂತ ಪ್ರದೇಶ, ಋತು, ಮಣ್ಣಿನ ವಿಧ ಮತ್ತು ನೀರಾವರಿ ಇರಬಹುದು.',
    selectCrop: 'ಬೆಳೆ ಆಯ್ಕೆ ಮಾಡಿ', selectSoil: 'ಮಣ್ಣು ಆಯ್ಕೆ ಮಾಡಿ', selectState: 'ರಾಜ್ಯ ಆಯ್ಕೆ ಮಾಡಿ',
    appName: 'AgriSaarthi', appTagline: 'ಭಾರತದ ರೈತರಿಗೆ AI',
    homeCardDesc: '{state} ಗಾಗಿ ನಿಮ್ಮ ಬುದ್ಧಿವಂತ ಕೃಷಿ ಸಹಾಯಕ. AI-ಚಾಲಿತ ಬೆಳೆ ಮಾರ್ಗದರ್ಶನ, ರಿಯಲ್-ಟೈಮ್ ಮಾರುಕಟ್ಟೆ, ಹವಾಮಾನ ಎಚ್ಚರಿಕೆ — ನಿಮ್ಮ ಪ್ರಿಯ ಭಾಷೆಯಲ್ಲಿ.',
    homeCardDescGeneral: 'ಭಾರತದ ಅತ್ಯಂತ ಸಮಗ್ರ ಕೃಷಿ ವೇದಿಕೆಗೆ ಸ್ವಾಗತ. AI ಸಹಾಯ, ಮಾರುಕಟ್ಟೆ ಮಾಹಿತಿ, ಹವಾಮಾನ ಮುನ್ಸೂಚನೆ ಮತ್ತು ಬೆಳೆ ರೋಗ ನಿರ್ಣಯ ಪಡೆಯಿರಿ.',
    topicGeneral: 'ಸಾಮಾನ್ಯ ತಜ್ಞ', topicCropDoctor: 'ಬೆಳೆ ವೈದ್ಯ', topicMarket: 'ಮಾರುಕಟ್ಟೆ ಬೆಲೆಗಳು', topicWeather: 'ಹವಾಮಾನ', topicSchemes: 'ಸರ್ಕಾರಿ ಯೋಜನೆಗಳು',
    forumAll: 'ಎಲ್ಲವೂ', catCropManagement: 'ಬೆಳೆ ನಿರ್ವಹಣೆ', catPestControl: 'ಕೀಟ ನಿಯಂತ್ರಣ', catSoilHealth: 'ಮಣ್ಣಿನ ಆರೋಗ್ಯ', catWaterManagement: 'ನೀರು ನಿರ್ವಹಣೆ', catMarketAdvisory: 'ಮಾರುಕಟ್ಟೆ ಸಲಹೆ', catWeatherAdvice: 'ಹವಾಮಾನ ಸಲಹೆ', catOrganicFarming: 'ಸಾವಯವ ಕೃಷಿ', catGovtSchemes: 'ಸರ್ಕಾರಿ ಯೋಜನೆಗಳು',
    govtSchemesAI: 'AWS ನಾಲೆಡ್ಜ್ ಬೇಸ್ ಮತ್ತು myscheme.gov.in ರಿಯಲ್-ಟೈಮ್ ಡೇಟಾ ಬಳಸಿ ಸರ್ಕಾರಿ ಯೋಜನೆಗಳ AI ತಜ್ಞ ವಿಶ್ಲೇಷಣೆ.',
    qPhrase1: 'ಗೋಧಿಗೆ ಅತ್ಯುತ್ತಮ ಗೊಬ್ಬರ ಯಾವುದು?', qPhrase2: 'ಭತ್ತದ ಬೆಳೆಯಲ್ಲಿ ಕೀಟಗಳನ್ನು ಹೇಗೆ ನಿಯಂತ್ರಿಸಬೇಕು?', qPhrase3: 'ಮಾರುಕಟ್ಟೆಯಲ್ಲಿ ಈರುಳ್ಳಿ ಪ್ರಸ್ತುತ ಬೆಲೆ ಏನು?', qPhrase4: 'ಖರೀಫ್ ಮೌಸಮ್ ಬಿತ್ತನೆ ಯಾವಾಗ ಮಾಡಬೇಕು?', qPhrase5: 'ಉತ್ತಮ ಇಳುವರಿಗೆ ಮಣ್ಣಿನ ಗುಣಮಟ್ಟ ಹೇಗೆ ಸುಧಾರಿಸಬೇಕು?', qPhrase6: 'ಗೋಧಿಯಲ್ಲಿ ಕಿಲು ರೋಗದ ಲಕ್ಷಣಗಳಾವವು?',
    tapSetPrimary: 'ಯಾವ ಬೆಳೆಯ ಮೇಲೆಯಾದರೂ ☆ ಟ್ಯಾಪ್ ಮಾಡಿ ಅದನ್ನು ಪ್ರಾಥಮಿಕ ಎಂದು ಹೊಂದಿಸಲು', cropSingular: 'ಬೆಳೆ', cropsPlural: 'ಬೆಳೆಗಳು',
    seasonKharif: 'ಖರೀಫ್ (Jun–Nov)', seasonRabi: 'ರಬಿ (Oct–Apr)', seasonZaid: 'ಜಾಯ್ದ್ (Mar–Jun)', seasonPerennial: 'ಬಹುವಾರ್ಷಿಕ', seasonAllSeason: 'ಎಲ್ಲಾ ಋತು',
    irrigRainfed: 'ಮಳೆ ಆಧಾರಿತ', irrigCanal: 'ಕಾಲುವೆ', irrigDrip: 'ಹನಿ ನೀರಾವರಿ', irrigSprinkler: 'ಸ್ಪ್ರಿಂಕ್ಲರ್', irrigBorewell: 'ಬೋರ್‌ವೆಲ್', irrigOther: 'ಇತರ',
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
    home: 'ഹോം', weather: 'കാലാവസ്ഥ', cropHealth: 'വിളയുടെ ആരോഗ്യം', insurance: 'ഇൻഷുറൻസ്',
    allQuestions: 'എല്ലാ ചോദ്യങ്ങളും', myQuestions: 'എന്റെ ചോദ്യങ്ങൾ',
    yourLanguage: 'നിങ്ങളുടെ ഭാഷ', adminPanel: 'ഒടുവ്വാക്കൽ പാനൽ',
    whatCanIHelp: 'ഞാൻ നിങ്ങളെ എങ്ങനെ സഹായിക്കാം?', tapFeature: 'ആരംഭിക്കാൻ ഏതെങ്കിലും ഫീച്ചർ ടാപ്പ് ചെയ്യൂ',
    cropCategories: 'വിള വിഭാഗങ്ങൾ', whyAI: 'കൃഷിക്ക്‌ AI എന്തുകൊണ്ട്?',
    latestNews: 'ഏറ്റവും പുതിയ കൃഷി വാർത്തകൾ', viewAll: 'എല്ലാം കാണൂ',
    cropHealthTitle: 'വിള ആരോഗ്യ നിദാനം', uploadPhoto: 'വിള ഫോട്ടോ അപ്‌ലോഡ് ചെയ്യൂ',
    takePhoto: 'ക്യാമറ ഉപയോഗിച്ച് ഫോട്ടോ എടുക്കൂ', analyzeCropHealth: 'വിള ആരോഗ്യം വിശകലനം ചെയ്യൂ',
    shareHealthReport: 'ആരോഗ്യ റിപ്പോർട്ട് ഷേർ ചെയ്യൂ', tipsBetterDiagnosis: 'നർണ നിദാനത്തിനുള്ള നുറുമ്പുകൾ',
    translateBtn: 'Sarvam AI ഉപയോഗിച്ച് വിവർത്തനം ചെയ്യൂ', quickPhrases: 'കർഷകർക്കായി ദ്രുത വാക്യങ്ങൾ',
    farmerProfile: 'കർഷക പ്രൊഫൈൽ‍', editBtn: 'എഡിറ്റ് ചെയ്യൂ', saveProfile: 'പ്രൊഫൈൽ‍ സേവ് ചെയ്യൂ',
    clearProfile: 'പ്രൊഫൈൽ‍ ക്ലിയർ ചെയ്യൂ', myCrops: 'എന്റെ വിളകൾ', addCrop: 'വിള ചേർക്കൂ', noCrops: 'ഇനിയും വിളകൾ ചേർക്കാത്ത അവസ്ഥ',
    insuranceTitle: 'ഇൻഷുറൻസ് ഉപദേശകൻ', findSchemes: 'എന്റെ മികച്ച ഇൻഷുറൻസ് പദ്ധതികൾ കണ്ടെത്തൂ',
    enableVoice: 'ശബ്ദം പ്രവർത്തനക്ഷമമാക്കൂ', loadingHistory: 'ചാറ്റ് ചരിത്രം ലോഡ് ചെയ്യുന്നു...',
    askAnyLang: 'ഏത് ഭാഷയിലും ചോദിക്കൂ…', sortedByLatest: 'കൂടുതൽ പുതിയത് മുതൽ‍',
    thinkingVoice: 'ചിന്തിക്കുകയും ശബ്ദം തയ്യാറാക്കുകയും ചെയ്യുന്നു…', researching: 'ഗവേഷണം ചെയ്യുന്നു…',
    aiModules: 'AI തീരുമാന മൊഡ്യൂളുകൾ:', cultivationAdvisor: 'കൃഷി ഉപദേഷ്ടാവ്', marketIntelligence: 'വിപണി ബുദ്ധി',
    audioMode: 'ഓഡിയോ', textMode: 'ടെക്സ്റ്റ്',
    completeProfile: 'നിങ്ങളുടെ പ്രൊഫൈൽ പൂർത്തിയാക്കൂ', findCropAdvice: 'നിങ്ങളുടെ വിളയ്ക്ക് പ്രത്യേക ഉപദേശം നേടൂ',
    realTimeAdaptation: 'റിയൽ-ടൈം അനുകൂലന', realTimeAdaptationDesc: 'AI വിപണി വിലകൾ, കാലാവസ്ഥ, കീടബാധ അനുസരിച്ച് തുടർച്ചയായി പഠിക്കുന്നു',
    contextualIntelligence: 'സന്ദർഭ ബുദ്ധി', contextualIntelligenceDesc: 'മണ്ണിന്റെ തരം, പ്രാദേശിക കാലാവസ്ഥ, വിപണി പ്രവണതകൾ കണക്കിലെടുത്ത് ഉപദേശം',
    unmatchedScale: 'അസാമാന്യ തോത്', unmatchedScaleDesc: 'ഫൗണ്ടേഷൻ മോഡലുകൾ 15+ ഭാഷകളും 100+ വിള ഇനങ്ങളും കാര്യക്ഷമമായി കൈകാര്യം ചെയ്യുന്നു',
    langSupported: '15+ ഭാഷകൾ പിന്തുണക്കുന്നു',
    agentHeading: 'സ്വതന്ത്ര ബഹുഭാഷാ കൃഷി തീരുമാന, ഭീഷണി ബുദ്ധി ഏജന്റ്',
    agentSubCaption: 'ശബ്ദം, ടെക്സ്റ്റ് വഴി 15+ ഭാരതീയ ഭാഷകൾ മനസ്സിലാക്കുന്ന വിപ്ലവകരമായ AI. റിയൽ-ടൈം ഡേറ്റ, വിപണി, കാലാവസ്ഥ, സർക്കാർ പദ്ധതികൾ സംയോജിപ്പിച്ച് വ്യക്തിഗത മാർഗദർശനം നൽകുന്നു.',
    talkToAgent: 'AI ഏജന്റുമായി സംസാരിക്കൂ',
    enterDetails: 'വിവരങ്ങൾ നൽകൂ', step1: 'ഘട്ടം 1', step2: 'ഘട്ടം 2', step3: 'ഘട്ടം 3',
    personalDetails: 'വ്യക്തിഗത വിവരങ്ങൾ', locationLabel: 'സ്ഥലം', farmCropDetails: 'കൃഷി & വിള വിവരങ്ങൾ',
    fullName: 'പൂർണ്ണ നാമം', ageLabel: 'പ്രായം', genderLabel: 'ലിംഗം', categoryLabel: 'വിഭാഗം',
    stateLabel: 'സംസ്ഥാനം', districtLabel: 'ജില്ല', primaryCrop: 'പ്രധാന വിള',
    landAcres: 'ഭൂമി (ഏക്കർ)', farmingType: 'കൃഷി ശൈലി', incomeLevel: 'വരുമാന നില',
    analysingAI: 'AI + AWS ഉപയോഗിച്ച് വിശകലനം ചെയ്യുന്നു…', bestSchemes: 'ഏറ്റവും അനുയോജ്യമായ പദ്ധതികൾ',
    aiAnalysis: 'AI തന്ത്രപ്രധാന വിശകലനം', startOver: 'വീണ്ടും ആരംഭിക്കൂ', voiceFeedbackOn: 'ശബ്ദം ഓണാണ്',
    prefillNote: 'നിങ്ങളുടെ പ്രൊഫൈലിൽ നിന്ന് ഈ ഫോം നിറച്ചു. കൃത്യമായ നിർദ്ദേശങ്ങൾക്ക് ആവശ്യമുള്ള ഫീൽഡുകൾ അപ്ഡേറ്റ് ചെയ്യൂ.',
    profileCompletion: 'പ്രൊഫൈൽ പൂർണ്ണത', cropName: 'വിളയുടെ പേര്', areaAcres: 'വിസ്തൃതി (ഏക്കർ)',
    soilType: 'മണ്ണിന്റെ തരം', seasonLabel: 'സീസൺ', irrigationLabel: 'ജലസേചനം',
    showAdvanced: 'വിശദ വിവരങ്ങൾ കാണൂ', hideAdvanced: 'വിശദ വിവരങ്ങൾ മറക്കൂ',
    varietyCultivar: 'ഇനം / കൾടിവർ', notesLabel: 'കുറിപ്പുകൾ',
    setPrimary: 'പ്രധാന വിളയാക്കൂ', setPrimaryDesc: 'AI ഉപദേശം, കാലാവസ്ഥ മുന്നറിയിപ്പുകൾ, വിപണി വിലകൾക്ക് ഉപയോഗിക്കുന്നു',
    saveChanges: 'മാറ്റങ്ങൾ സേവ് ചെയ്യൂ', addNewCrop: 'പുതിയ വിള ചേർക്കൂ', editCrop: 'വിള എഡിറ്റ് ചെയ്യൂ',
    personalInfo: 'വ്യക്തിഗത വിവരം', locationSection: 'സ്ഥലം', farmingApproach: 'കൃഷി സമീപനം',
    emailAddress: 'ഇമെയിൽ വിലാസം', fullNameRequired: 'പൂർണ്ണ നാമം *', phoneNumber: 'ഫോൺ നമ്പർ',
    stateRequired: 'സംസ്ഥാനം *', districtField: 'ജില്ല', preferredLanguage: 'ഇഷ്ടഭാഷ',
    loadingCrops: 'വിളകൾ ലോഡ് ചെയ്യുന്നു...', primaryBadge: 'പ്രധാനം',
    profileComplete: 'ഗംഭീരം! നിങ്ങളുടെ പ്രൊഫൈൽ പൂർണ്ണമായി വ്യക്തിഗതമാക്കി',
    profileIncomplete: '100% ആവാൻ വിവരങ്ങൾ നൽകൂ, വിളകൾ ചേർക്കൂ',
    cropSubtitle: 'ഓരോ വിളയ്ക്കും അതിന്റേതായ വിസ്തൃതി, മണ്ണ്, സീസൺ, ജലസേചനം ട്രാക്ക് ചെയ്യും',
    addCropsReminder: 'താഴെ എന്റെ വിളകൾ വിഭാഗത്തിൽ വിളകൾ ചേർക്കൂ — ഓരോ വിളയ്ക്കും അതിന്റേതായ വിസ്തൃതി, സീസൺ, മണ്ണ്, ജലസേചനം ഉണ്ടാകാം.',
    selectCrop: 'വിള തിരഞ്ഞെടുക്കൂ', selectSoil: 'മണ്ണ് തിരഞ്ഞെടുക്കൂ', selectState: 'സംസ്ഥാനം തിരഞ്ഞെടുക്കൂ',
    appName: 'AgriSaarthi', appTagline: 'ഭാരതത്തിലെ കർഷകർക്ക് AI',
    homeCardDesc: '{state}-നുള്ള നിങ്ങളുടെ ബുദ്ധിമാൻ കൃഷി സഹചാരി. AI-ഘടിത വിള മാർഗദർശനം, റിയൽ-ടൈം വിപണി, കാലാവസ്ഥ മുന്നറിയിപ്പ് — നിങ്ങൾക്കിഷ്ടമായ ഭാഷയിൽ.',
    homeCardDescGeneral: 'ഇന്ത്യയിലെ ഏറ്റവും സമഗ്രമായ കൃഷി വേദിയിലേക്ക് സ്വാഗതം. AI സഹായം, വിപണി വിവരം, കാലാവസ്ഥ പ്രവചനം, വിള രോഗനിർണ്ണയം ലഭ്യമാക്കൂ.',
    topicGeneral: 'പൊതു വിദഗ്ദ്ധൻ', topicCropDoctor: 'വിള ഡോക്ടർ', topicMarket: 'വിപണി വിലകൾ', topicWeather: 'കാലാവസ്ഥ', topicSchemes: 'സർക്കാർ പദ്ധതികൾ',
    forumAll: 'എല്ലാം', catCropManagement: 'വിള മാനേജ്‌മെന്റ്', catPestControl: 'കീടനിയന്ത്രണം', catSoilHealth: 'മണ്ണിന്റെ ആരോഗ്യം', catWaterManagement: 'ജല മാനേജ്‌മെന്റ്', catMarketAdvisory: 'വിപണി ഉപദേശം', catWeatherAdvice: 'കാലാവസ്ഥ ഉപദേശം', catOrganicFarming: 'ജൈവ കൃഷി', catGovtSchemes: 'സർക്കാർ പദ്ധതികൾ',
    govtSchemesAI: 'AWS നോളജ് ബേസ്, myscheme.gov.in റിയൽ-ടൈം ഡേറ്റ ഉപയോഗിച്ച് സർക്കാർ പദ്ധതികളുടെ AI വിദഗ്ദ്ധ വിശകലനം.',
    qPhrase1: 'ഗോതമ്പിന് ഏറ്റവും നല്ല വളം ഏതാണ്?', qPhrase2: 'നെൽ‍പ്പാടത്ത് കീടങ്ങളെ എങ്ങനെ നിയന്ത്രിക്കാം?', qPhrase3: 'ചന്തയിൽ ഉള്ളിയുടെ നിലവിലെ വില എത്ര?', qPhrase4: 'ഖരീഫ് സീസണിൽ വിത്ത് വിതയ്ക്കേണ്ടത് എപ്പോൾ?', qPhrase5: 'കൂടുതൽ ഉൽ‍പ്പാദനത്തിന് മണ്ണിന്റെ ഗുണനിലവാരം എങ്ങനെ മെച്ചപ്പെടുത്താം?', qPhrase6: 'ഗോതമ്പിൽ ദ്രവണ രോഗത്തിന്റെ ലക്ഷണങ്ങളെന്ത്?',
    tapSetPrimary: 'ഏത് വിളയിലും ☆ ടാപ്പ് ചെയ്ത് അത് പ്രധാനമാക്കൂ', cropSingular: 'വിള', cropsPlural: 'വിളകൾ',
    seasonKharif: 'ഖരീഫ് (Jun–Nov)', seasonRabi: 'റബി (Oct–Apr)', seasonZaid: 'സൈദ് (Mar–Jun)', seasonPerennial: 'ബഹുവർഷ', seasonAllSeason: 'എല്ലാ സീസണും',
    irrigRainfed: 'മഴ ആശ്രിത', irrigCanal: 'കനാൽ', irrigDrip: 'ഡ്രിപ്', irrigSprinkler: 'സ്‍പ്രിങ്ക്‌ളർ', irrigBorewell: 'ബോർ‌വെൽ', irrigOther: 'മറ്റ്',
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
    home: 'હોમ', weather: 'હવામાન', cropHealth: 'પાક આરોગ્ય', insurance: 'વીમો',
    allQuestions: 'બધા પ્રશ્નો', myQuestions: 'મારા પ્રશ્નો',
    yourLanguage: 'તમારી ભાષા', adminPanel: 'ઊંચ પેનલ',
    whatCanIHelp: 'હું તમારી કેવી રીતે મદદ કરી શકું?', tapFeature: 'શરૂ કરવા કોઈ પણ સુવિધા ટેપ કરો',
    cropCategories: 'પાક શ્રેણીઓ', whyAI: 'ખેતી માટે AI શા માટે?',
    latestNews: 'તાજા કૃષિ સમાચાર', viewAll: 'બધું જુઓ',
    cropHealthTitle: 'પાક આરોગ્ય નિદાન', uploadPhoto: 'પાકનો ફોટો અપલોડ કરો',
    takePhoto: 'કૅમેરાથી ફોટો લો', analyzeCropHealth: 'પાક આરોગ્ય વિશ્લેષણ કરો',
    shareHealthReport: 'આરોગ્ય અહેવાલ શેર કરો', tipsBetterDiagnosis: 'વધુ સારા નિદાન માટે ટિપ્સ',
    translateBtn: 'Sarvam AI સાથે અનુવાદ કરો', quickPhrases: 'ખેડૂતો માટે ઝડપી વાક્યો',
    farmerProfile: 'ખેડૂત પ્રોફાઇલ', editBtn: 'સંપાદિત કરો', saveProfile: 'પ્રોફાઇલ સેવ કરો',
    clearProfile: 'પ્રોફાઇલ સાફ કરો', myCrops: 'મારા પાક', addCrop: 'પાક ઉમેરો', noCrops: 'અત્યારે કોઈ પાક ઉમેરાઝો નથી',
    insuranceTitle: 'વીમો સલાહકાર', findSchemes: 'મારી શ્રેષ્ઠ વીમો યોજનાઓ શોધો',
    enableVoice: 'આવાજ ચાલુ કરો', loadingHistory: 'ચેટ ઇતિહાસ લોડ થઈ રહ્યો છે...',
    askAnyLang: 'કોઈ પણ ભાષામાં પૂછો…', sortedByLatest: 'નવીનતમ ક્રમમાં',
    thinkingVoice: 'વિચારી રહ્યો છું અને આવાજ તૈયાર કરી રહ્યો છું…', researching: 'સંશોધન કરી રહ્યો છું…',
    aiModules: 'AI નિર્ણય મૉડ્યૂલ:', cultivationAdvisor: 'ખેતી સલાહકાર', marketIntelligence: 'બજાર બુદ્ધિ',
    audioMode: 'ઑડિઓ', textMode: 'ટેક્સ્ટ',
    completeProfile: 'તમારી પ્રોફાઇલ પૂર્ણ કરો', findCropAdvice: 'તમારા પાક માટે વિશેષ સલાહ મળો',
    realTimeAdaptation: 'રીઅલ-ટાઇમ અનુકૂલન', realTimeAdaptationDesc: 'AI બજાર ભાવ, હવામાન અને જીવડા ઉપદ્રવ અનુસાર સતત શીખે છે',
    contextualIntelligence: 'સંદર્ભ બુદ્ધિ', contextualIntelligenceDesc: 'માટીનો પ્રકાર, સ્થાનિક હવામાન અને બજાર વ્યવહારો ધ્યાનમાં રાખી સલાહ',
    unmatchedScale: 'અનોખો માપ', unmatchedScaleDesc: 'ફાઉન્ડેશન મૉડ 15+ ભાષાઓ અને 100+ પાક પ્રકારો સક્ષમ રીતે સંભાળે છે',
    langSupported: '15+ ભાષાઓ સમર્થિત',
    agentHeading: 'સ્વાયત્ત બહુભાષી ખેતી નિર્ણય અને જોખમ બુદ્ધિ એજન્ટ',
    agentSubCaption: 'અવાજ અને ટેક્સ્ટ દ્વારા 15+ ભારતીય ભાષાઓ સમજતો ક્રાંતિકારી AI. રીઅલ-ટાઇમ ડેટા, બજાર, હવામાન અને સરકારી યોજનાઓ ભેળવી વ્યક્તિગત ખેતી માર્ગદર્શન આપે છે.',
    talkToAgent: 'AI એજન્ટ સાથે વાત કરો',
    enterDetails: 'વિગતો દાખલ કરો', step1: 'પગલું 1', step2: 'પગલું 2', step3: 'પગલું 3',
    personalDetails: 'વ્યક્તિગત વિગતો', locationLabel: 'સ્થળ', farmCropDetails: 'ખેત અને પાક વિગતો',
    fullName: 'પૂરું નામ', ageLabel: 'ઉંમર', genderLabel: 'જાતિ', categoryLabel: 'શ્રેણી',
    stateLabel: 'રાજ્ય', districtLabel: 'જિલ્લો', primaryCrop: 'મુખ્ય પાક',
    landAcres: 'ભૂમિ (એકર)', farmingType: 'ખેતીનો પ્રકાર', incomeLevel: 'આવક સ્તર',
    analysingAI: 'AI + AWS સાથે વિશ્લેષણ ચાલી રહ્યું છે…', bestSchemes: 'સૌથી અનુકૂળ યોજનાઓ',
    aiAnalysis: 'AI વ્યૂહાત્મક વિશ્લેષણ', startOver: 'ફરીથી શરૂ કરો', voiceFeedbackOn: 'આવાજ ચાલુ છે',
    prefillNote: 'અમે તમારી પ્રોફાઇલ પરથી આ ફૉર્મ ભર્યો છે. સચોટ સૂચનો માટે જરૂરી ક્ષેત્રો અપડેટ કરો.',
    profileCompletion: 'પ્રોફાઇલ પૂર્ણતા', cropName: 'પાકનું નામ', areaAcres: 'ક્ષેત્ર (એકર)',
    soilType: 'માટીનો પ્રકાર', seasonLabel: 'ઋતુ', irrigationLabel: 'સિંચાઈ',
    showAdvanced: 'અદ્યતન વિગત બતાવો', hideAdvanced: 'અદ્યતન વિગત છુપાવો',
    varietyCultivar: 'જાત / કલ્ટીવર', notesLabel: 'નોંધ',
    setPrimary: 'મુખ્ય પાક તરીકે સ્થાપિત કરો', setPrimaryDesc: 'AI સલાહ, હવામાન ચેતવણી અને બજાર ભાવ માટે ઉપયોગ',
    saveChanges: 'ફેરફાર સેવ કરો', addNewCrop: 'નવો પાક ઉમેરો', editCrop: 'પાક સંપાદિત કરો',
    personalInfo: 'વ્યક્તિગત માહિતી', locationSection: 'સ્થળ', farmingApproach: 'ખેતીની પદ્ધતિ',
    emailAddress: 'ઈ-મેઈલ સરનામું', fullNameRequired: 'પૂરું નામ *', phoneNumber: 'ફોન નંબર',
    stateRequired: 'રાજ્ય *', districtField: 'જિલ્લો', preferredLanguage: 'પ્રિય ભાષા',
    loadingCrops: 'પાક લોડ થઈ રહ્યા છે...', primaryBadge: 'મુખ્ય',
    profileComplete: 'ઉત્તમ! તમારી પ્રોફાઇલ સંપૂર્ણ રીતે વ્યક્તિગત છે',
    profileIncomplete: '100% સુધી પહોંચવા વિગત ભરો અને પાક ઉમેરો',
    cropSubtitle: 'દરેક પાકનો પોતાનો ક્ષેત્ર, માટી, ઋતુ અને સિંચાઈ ટ્રૅક થાય છે',
    addCropsReminder: 'નીચે મારા પાક વિભાગમાં પાક ઉમેરો — દરેક પાકમાં ક્ષેત્ર, ઋતુ, માટી અને સિંચાઈ હોઈ શકે.',
    selectCrop: 'પાક પસંદ કરો', selectSoil: 'માટી પસંદ કરો', selectState: 'રાજ્ય પસંદ કરો',
    appName: 'AgriSaarthi', appTagline: 'ભારતના ખેડૂતો માટે AI',
    homeCardDesc: '{state} માટે તમારો બુદ્ધિશાળી ખેતી મિત્ર. AI-સંચાલિત પાક માર્ગદર્શન, રિઅલ-ટાઇમ બજાર, હવામાન ચેતવણી — તમારી ગમતી ભાષામાં.',
    homeCardDescGeneral: 'ભારતના સૌથી વ્યાપક ખેતી મંચ પર આપનો સ્વાગત. AI સહાય, બજાર માહિતી, હવામાન અંદાજ, પાક નિદાન મેળવો.',
    topicGeneral: 'સામાન્ય નિષ્ણાત', topicCropDoctor: 'પાક ડૉક્ટર', topicMarket: 'બજાર ભાવ', topicWeather: 'હવામાન', topicSchemes: 'સરકારી યોજનાઓ',
    forumAll: 'બધા', catCropManagement: 'પાક વ્યવસ્થાપન', catPestControl: 'જીવાત નિયંત્રણ', catSoilHealth: 'જમીન સ્વાસ્થ્ય', catWaterManagement: 'જળ વ્યવસ્થાપન', catMarketAdvisory: 'બજાર સલાહ', catWeatherAdvice: 'હવામાન સલાહ', catOrganicFarming: 'જૈવિક ખેતી', catGovtSchemes: 'સરકારી યોજનાઓ',
    govtSchemesAI: 'AWS નૉલેજ બેઝ અને myscheme.gov.in રિઅલ-ટાઇમ ડેટા ઉપયોગ કરીને સરકારી યોજનાઓ પર AI નિષ્ણાત વિશ્લેષણ.',
    qPhrase1: 'ઘઉં માટે સૌથી સારું ખાતર કયું?', qPhrase2: 'ડાંગરના પાકમાં જીવાત કેવી રીતે નિયંત્રિત કરવી?', qPhrase3: 'બજારમાં ડુંગળીનો હાલનો ભાવ ક્યાં?', qPhrase4: 'ખરીફ સિઝનમાં બી ક્યારે વાવવા?', qPhrase5: 'સારા ઉત્પાદન માટે જમીનની ગુણવત્તા કેવી રીતે સુધારવી?', qPhrase6: 'ઘઉંમાં રસ્ટ રોગના લક્ષણો શું?',
    tapSetPrimary: 'કોઈ પણ પાક પર ☆ ટૅપ કરો તેને મુખ્ય બનાવવા', cropSingular: 'પાક', cropsPlural: 'પાક',
    seasonKharif: 'ખરીફ (Jun–Nov)', seasonRabi: 'રવી (Oct–Apr)', seasonZaid: 'ઝૈઇ (Mar–Jun)', seasonPerennial: 'બારમાસી', seasonAllSeason: 'સઘળી સિઝન',
    irrigRainfed: 'વરસાદ-આધારિત', irrigCanal: 'નહેર', irrigDrip: 'ટીપ સિંચાઈ', irrigSprinkler: 'ફ્લૉ સ્પ્રિંklr', irrigBorewell: 'બોરવેલ', irrigOther: 'અન્ય',
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
    home: 'ਹੋਮ', weather: 'ਮੌਸਮ', cropHealth: 'ਫਸਲ ਸਿਹਤ', insurance: 'ਬੀਮਾ',
    allQuestions: 'ਸਾਰੇ ਸਵਾਲ', myQuestions: 'ਮੇਰੇ ਸਵਾਲ',
    yourLanguage: 'ਤੁਹਾਡੀ ਭਾਸ਼ਾ', adminPanel: 'ਪ੍ਰਬੰਧਕ ਪੈਨਲ',
    whatCanIHelp: 'ਮੈਂ ਤੁਹਾਡੀ ਕਿਵੇਂ ਮਦਦ ਕਰ ਸਕਦਾ ਹਾਂ?', tapFeature: 'ਸ਼ੁਰੂ ਕਰਨ ਲਈ ਕੋਈ ਵੀ ਸੁਵਿਧਾ ਟੈਪ ਕਰੋ',
    cropCategories: 'ਫ਼ਸਲ ਸ਼੍ਰੇਣੀਆਂ', whyAI: 'ਖੇਤੀ ਲਈ AI ਕਿਉਂ?',
    latestNews: 'ਤਾਜ਼ੀਆਂ ਖੇਤੀ ਖ਼ਬਰਾਂ', viewAll: 'ਸਭ ਦੇਖੋ',
    cropHealthTitle: 'ਫ਼ਸਲ ਸਿਹਤ ਜਾਂਚ', uploadPhoto: 'ਫ਼ਸਲ ਦੀ ਫ਼ੋਟੋ ਅਪਲੋਡ ਕਰੋ',
    takePhoto: 'ਕੈਮਰੇ ਨਾਲ ਫ਼ੋਟੋ ਲਓ', analyzeCropHealth: 'ਫ਼ਸਲ ਸਿਹਤ ਵਿਸ਼ਲੇਸ਼ਣ ਕਰੋ',
    shareHealthReport: 'ਸਿਹਤ ਰਿਪੋਰਟ ਸ਼ੇਅਰ ਕਰੋ', tipsBetterDiagnosis: 'ਬਿਹਤਰ ਜਾਂਚ ਲਈ ਸੁਝਾਅ',
    translateBtn: 'Sarvam AI ਨਾਲ ਅਨੁਵਾਦ ਕਰੋ', quickPhrases: 'ਕਿਸਾਨਾਂ ਲਈ ਤੇਜ਼ ਵਾਕਾਂਸ਼',
    farmerProfile: 'ਕਿਸਾਨ ਪ੍ਰੋਫ਼ਾਈਲ', editBtn: 'ਸੰਪਾਦਿਤ ਕਰੋ', saveProfile: 'ਪ੍ਰੋਫ਼ਾਈਲ ਸੇਵ ਕਰੋ',
    clearProfile: 'ਪ੍ਰੋਫ਼ਾਈਲ ਸਾਫ਼ ਕਰੋ', myCrops: 'ਮੇਰੀਆਂ ਫ਼ਸਲਾਂ', addCrop: 'ਫ਼ਸਲ ਜੋੜੋ', noCrops: 'ਅਜੇ ਕੋਈ ਫ਼ਸਲ ਨਹੀਂ ਜੋੜੀ',
    insuranceTitle: 'ਬੀਮਾ ਸਲਾਹਕਾਰ', findSchemes: 'ਮੇਰੀਆਂ ਸਭ ਤੋਂ ਚੰਗੀਆਂ ਬੀਮਾ ਯੋਜਨਾਵਾਂ ਲੱਭੋ',
    enableVoice: 'ਆਵਾਜ਼ ਚਾਲੂ ਕਰੋ', loadingHistory: 'ਚੈਟ ਇਤਿਹਾਸ ਲੋਡ ਹੋ ਰਿਹਾ ਹੈ...',
    askAnyLang: 'ਕਿਸੇ ਵੀ ਭਾਸ਼ਾ ਵਿੱਚ ਪੁੱਛੋ…', sortedByLatest: 'ਨਵੀਨਤਮ ਕ੍ਰਮ ਅਨੁਸਾਰ',
    thinkingVoice: 'ਸੋਚ ਰਿਹਾ ਹਾਂ ਅਤੇ ਆਵਾਜ਼ ਤਿਆਰ ਕਰ ਰਿਹਾ ਹਾਂ…', researching: 'ਖੋਜ ਰਿਹਾ ਹਾਂ…',
    aiModules: 'AI ਫ਼ੈਸਲਾ ਮੋਡੀਊਲ:', cultivationAdvisor: 'ਖੇਤੀ ਸਲਾਹਕਾਰ', marketIntelligence: 'ਮੰਡੀ ਸਮਝ',
    audioMode: 'ਆਡੀਓ', textMode: 'ਟੈਕਸਟ',
    completeProfile: 'ਆਪਣੀ ਪ੍ਰੋਫ਼ਾਈਲ ਪੂਰੀ ਕਰੋ', findCropAdvice: 'ਆਪਣੀ ਫ਼ਸਲ ਲਈ ਖ਼ਾਸ ਸਲਾਹ ਪਾਓ',
    realTimeAdaptation: 'ਰੀਅਲ-ਟਾਈਮ ਅਨੁਕੂਲਨ', realTimeAdaptationDesc: 'AI ਮੰਡੀ ਭਾਅ, ਮੌਸਮ ਅਤੇ ਕੀੜੇ-ਮਕੌੜਿਆਂ ਅਨੁਸਾਰ ਸਿੱਖਦਾ ਹੈ',
    contextualIntelligence: 'ਸੰਦਰਭ ਸਮਝ', contextualIntelligenceDesc: 'ਮਿੱਟੀ ਦੀ ਕਿਸਮ, ਸਥਾਨਕ ਮੌਸਮ ਅਤੇ ਮੰਡੀ ਰੁਝਾਨਾਂ ਨੂੰ ਧਿਆਨ ਵਿੱਚ ਰੱਖ ਕੇ ਸਲਾਹ',
    unmatchedScale: 'ਬੇਮਿਸਾਲ ਪੱਧਰ', unmatchedScaleDesc: 'ਫਾਊਂਡੇਸ਼ਨ ਮਾਡਲ 15+ ਭਾਸ਼ਾਵਾਂ ਅਤੇ 100+ ਫ਼ਸਲ ਕਿਸਮਾਂ ਨੂੰ ਕੁਸ਼ਲਤਾ ਨਾਲ ਸੰਭਾਲਦੇ ਹਨ',
    langSupported: '15+ ਭਾਸ਼ਾਵਾਂ ਸਮਰਥਿਤ',
    agentHeading: 'ਸੁਤੰਤਰ ਬਹੁਭਾਸ਼ੀ ਖੇਤੀ ਫ਼ੈਸਲਾ ਅਤੇ ਜੋਖ਼ਮ ਬੁੱਧੀ ਏਜੰਟ',
    agentSubCaption: 'ਆਵਾਜ਼ ਅਤੇ ਟੈਕਸਟ ਰਾਹੀਂ 15+ ਭਾਰਤੀ ਭਾਸ਼ਾਵਾਂ ਸਮਝਣ ਵਾਲਾ ਕ੍ਰਾਂਤੀਕਾਰੀ AI। ਰੀਅਲ-ਟਾਈਮ ਡੇਟਾ, ਮੰਡੀ, ਮੌਸਮ ਅਤੇ ਸਰਕਾਰੀ ਯੋਜਨਾਵਾਂ ਨੂੰ ਜੋੜ ਕੇ ਨਿੱਜੀ ਖੇਤੀ ਮਾਰਗਦਰਸ਼ਨ ਦਿੰਦਾ ਹੈ।',
    talkToAgent: 'AI ਏਜੰਟ ਨਾਲ ਗੱਲ ਕਰੋ',
    enterDetails: 'ਵੇਰਵੇ ਦਾਖਲ ਕਰੋ', step1: 'ਕਦਮ 1', step2: 'ਕਦਮ 2', step3: 'ਕਦਮ 3',
    personalDetails: 'ਨਿੱਜੀ ਵੇਰਵੇ', locationLabel: 'ਸਥਾਨ', farmCropDetails: 'ਖੇਤ ਅਤੇ ਫ਼ਸਲ ਵੇਰਵੇ',
    fullName: 'ਪੂਰਾ ਨਾਮ', ageLabel: 'ਉਮਰ', genderLabel: 'ਲਿੰਗ', categoryLabel: 'ਸ਼੍ਰੇਣੀ',
    stateLabel: 'ਰਾਜ', districtLabel: 'ਜ਼ਿਲ੍ਹਾ', primaryCrop: 'ਮੁੱਖ ਫ਼ਸਲ',
    landAcres: 'ਜ਼ਮੀਨ (ਏਕੜ)', farmingType: 'ਖੇਤੀ ਦੀ ਕਿਸਮ', incomeLevel: 'ਆਮਦਨੀ ਪੱਧਰ',
    analysingAI: 'AI + AWS ਨਾਲ ਵਿਸ਼ਲੇਸ਼ਣ ਹੋ ਰਿਹਾ ਹੈ…', bestSchemes: 'ਸਭ ਤੋਂ ਵਧੀਆ ਮੇਲ ਖਾਂਦੀਆਂ ਯੋਜਨਾਵਾਂ',
    aiAnalysis: 'AI ਰਣਨੀਤਕ ਵਿਸ਼ਲੇਸ਼ਣ', startOver: 'ਦੁਬਾਰਾ ਸ਼ੁਰੂ ਕਰੋ', voiceFeedbackOn: 'ਆਵਾਜ਼ ਚਾਲੂ ਹੈ',
    prefillNote: 'ਅਸੀਂ ਤੁਹਾਡੀ ਪ੍ਰੋਫ਼ਾਈਲ ਤੋਂ ਇਹ ਫ਼ਾਰਮ ਭਰਿਆ ਹੈ। ਸਹੀ ਸੁਝਾਵਾਂ ਲਈ ਲੋੜੀਂਦੇ ਖੇਤਰ ਅਪਡੇਟ ਕਰੋ।',
    profileCompletion: 'ਪ੍ਰੋਫ਼ਾਈਲ ਪੂਰਨਤਾ', cropName: 'ਫ਼ਸਲ ਦਾ ਨਾਮ', areaAcres: 'ਖੇਤਰ (ਏਕੜ)',
    soilType: 'ਮਿੱਟੀ ਦੀ ਕਿਸਮ', seasonLabel: 'ਮੌਸਮ', irrigationLabel: 'ਸਿੰਚਾਈ',
    showAdvanced: 'ਉੱਨਤ ਵੇਰਵੇ ਦਿਖਾਓ', hideAdvanced: 'ਉੱਨਤ ਵੇਰਵੇ ਲੁਕਾਓ',
    varietyCultivar: 'ਕਿਸਮ / ਕਲਟੀਵਾਰ', notesLabel: 'ਨੋਟਸ',
    setPrimary: 'ਮੁੱਖ ਫ਼ਸਲ ਵਜੋਂ ਸੈੱਟ ਕਰੋ', setPrimaryDesc: 'AI ਸਲਾਹ, ਮੌਸਮ ਚੇਤਾਵਨੀਆਂ ਅਤੇ ਮੰਡੀ ਭਾਅ ਲਈ ਵਰਤਿਆ ਜਾਂਦਾ ਹੈ',
    saveChanges: 'ਬਦਲਾਅ ਸੇਵ ਕਰੋ', addNewCrop: 'ਨਵੀਂ ਫ਼ਸਲ ਜੋੜੋ', editCrop: 'ਫ਼ਸਲ ਸੰਪਾਦਿਤ ਕਰੋ',
    personalInfo: 'ਨਿੱਜੀ ਜਾਣਕਾਰੀ', locationSection: 'ਸਥਾਨ', farmingApproach: 'ਖੇਤੀ ਦਾ ਤਰੀਕਾ',
    emailAddress: 'ਈਮੇਲ ਪਤਾ', fullNameRequired: 'ਪੂਰਾ ਨਾਮ *', phoneNumber: 'ਫ਼ੋਨ ਨੰਬਰ',
    stateRequired: 'ਰਾਜ *', districtField: 'ਜ਼ਿਲ੍ਹਾ', preferredLanguage: 'ਪਸੰਦੀਦਾ ਭਾਸ਼ਾ',
    loadingCrops: 'ਫ਼ਸਲਾਂ ਲੋਡ ਹੋ ਰਹੀਆਂ ਹਨ...', primaryBadge: 'ਮੁੱਖ',
    profileComplete: 'ਸ਼ਾਬਾਸ਼! ਤੁਹਾਡੀ ਪ੍ਰੋਫ਼ਾਈਲ ਪੂਰੀ ਤਰ੍ਹਾਂ ਨਿੱਜੀ ਹੈ',
    profileIncomplete: '100% ਤੱਕ ਪਹੁੰਚਣ ਲਈ ਵੇਰਵੇ ਭਰੋ ਅਤੇ ਫ਼ਸਲਾਂ ਜੋੜੋ',
    cropSubtitle: 'ਹਰ ਫ਼ਸਲ ਦਾ ਆਪਣਾ ਖੇਤਰ, ਮਿੱਟੀ, ਮੌਸਮ ਅਤੇ ਸਿੰਚਾਈ ਟਰੈਕ ਹੁੰਦਾ ਹੈ',
    addCropsReminder: 'ਹੇਠਾਂ ਮੇਰੀਆਂ ਫ਼ਸਲਾਂ ਭਾਗ ਵਿੱਚ ਫ਼ਸਲਾਂ ਜੋੜੋ — ਹਰ ਫ਼ਸਲ ਵਿੱਚ ਆਪਣਾ ਖੇਤਰ, ਮੌਸਮ, ਮਿੱਟੀ ਅਤੇ ਸਿੰਚਾਈ ਹੋ ਸਕਦੀ ਹੈ।',
    selectCrop: 'ਫ਼ਸਲ ਚੁਣੋ', selectSoil: 'ਮਿੱਟੀ ਚੁਣੋ', selectState: 'ਰਾਜ ਚੁਣੋ',
    appName: 'AgriSaarthi', appTagline: 'ਭਾਰਤ ਦੇ ਕਿਸਾਨਾਂ ਲਈ AI',
    homeCardDesc: '{state} ਲਈ ਤੁਹਾਡਾ ਸਮਾਰਟ ਖੇਤੀ ਸਾਥੀ। AI-ਚਾਲਿਤ ਫ਼ਸਲ ਮਾਰਗਦਰਸ਼ਨ, ਰੀਅਲ-ਟਾਈਮ ਮੰਡੀ, ਮੌਸਮ ਚੇਤਾਵਨੀ — ਤੁਹਾਡੀ ਭਾਸ਼ਾ ਵਿੱਚ।',
    homeCardDescGeneral: 'ਭਾਰਤ ਦੇ ਸਭ ਤੋਂ ਵਿਆਪਕ ਖੇਤੀ ਮੰਚ ਤੇ ਜੀ ਆਇਆਂ। AI ਸਹਾਇਤਾ, ਮੰਡੀ ਜਾਣਕਾਰੀ, ਮੌਸਮ ਭਵਿੱਖਬਾਣੀ ਅਤੇ ਫ਼ਸਲ ਜਾਂਚ ਪਾਓ।',
    topicGeneral: 'ਸਾਧਾਰਨ ਮਾਹਿਰ', topicCropDoctor: 'ਫ਼ਸਲ ਡਾਕਟਰ', topicMarket: 'ਮੰਡੀ ਭਾਅ', topicWeather: 'ਮੌਸਮ', topicSchemes: 'ਸਰਕਾਰੀ ਯੋਜਨਾਵਾਂ',
    forumAll: 'ਸਭ', catCropManagement: 'ਫ਼ਸਲ ਪ੍ਰਬੰਧਨ', catPestControl: 'ਕੀੜੇ ਕੰਟਰੋਲ', catSoilHealth: 'ਮਿੱਟੀ ਸਿਹਤ', catWaterManagement: 'ਜਲ ਪ੍ਰਬੰਧਨ', catMarketAdvisory: 'ਮੰਡੀ ਸਲਾਹ', catWeatherAdvice: 'ਮੌਸਮ ਸਲਾਹ', catOrganicFarming: 'ਜੈਵਿਕ ਖੇਤੀ', catGovtSchemes: 'ਸਰਕਾਰੀ ਯੋਜਨਾਵਾਂ',
    govtSchemesAI: 'AWS ਨੌਲੇਜ ਬੇਸ ਅਤੇ myscheme.gov.in ਰੀਅਲ-ਟਾਈਮ ਡੇਟਾ ਵਰਤ ਕੇ ਸਰਕਾਰੀ ਯੋਜਨਾਵਾਂ ਦਾ AI ਮਾਹਿਰ ਵਿਸ਼ਲੇਸ਼ਣ।',
    qPhrase1: 'ਕਣਕ ਲਈ ਸਭ ਤੋਂ ਵਧੀਆ ਖਾਦ ਕਿਹੜੀ ਹੈ?', qPhrase2: 'ਝੋਨੇ ਦੀ ਫ਼ਸਲ ਵਿੱਚ ਕੀੜੇ ਕਿਵੇਂ ਕੰਟਰੋਲ ਕਰੀਏ?', qPhrase3: 'ਮੰਡੀ ਵਿੱਚ ਪਿਆਜ਼ ਦਾ ਮੌਜੂਦਾ ਭਾਅ ਕੀ ਹੈ?', qPhrase4: 'ਖਰੀਫ਼ ਸੀਜ਼ਨ ਵਿੱਚ ਬੀਜ ਕਦੋਂ ਬੀਜਣੇ ਚਾਹੀਦੇ?', qPhrase5: 'ਬਿਹਤਰ ਝਾੜ ਲਈ ਮਿੱਟੀ ਦੀ ਗੁਣਵੱਤਾ ਕਿਵੇਂ ਸੁਧਾਰੀਏ?', qPhrase6: 'ਕਣਕ ਵਿੱਚ ਕਾਂਗਿਆਰੀ ਰੋਗ ਦੇ ਲੱਛਣ ਕੀ ਹਨ?',
    tapSetPrimary: 'ਕਿਸੇ ਵੀ ਫ਼ਸਲ ਤੇ ☆ ਟੈਪ ਕਰੋ ਇਸਨੂੰ ਮੁੱਖ ਬਣਾਉਣ ਲਈ', cropSingular: 'ਫ਼ਸਲ', cropsPlural: 'ਫ਼ਸਲਾਂ',
    seasonKharif: 'ਖਰੀਫ਼ (Jun–Nov)', seasonRabi: 'ਰਬੀ (Oct–Apr)', seasonZaid: 'ਜ਼ੈਦ (Mar–Jun)', seasonPerennial: 'ਸਾਲਾਨਾ', seasonAllSeason: 'ਸਾਰੇ ਮੌਸਮ',
    irrigRainfed: 'ਮੀਂਹ-ਅਧਾਰਿਤ', irrigCanal: 'ਨਹਿਰ', irrigDrip: 'ਤੁਪਕਾ ਸਿੰਚਾਈ', irrigSprinkler: 'ਫੁਹਾਰਾ', irrigBorewell: 'ਬੋਰਵੈੱਲ', irrigOther: 'ਹੋਰ',
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

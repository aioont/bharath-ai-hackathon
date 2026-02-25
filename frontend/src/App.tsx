import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AppProvider } from '@/context/AppContext'
import Layout from '@/components/Layout'
import Home from '@/pages/Home'
import Translate from '@/pages/Translate'
import Chat from '@/pages/Chat'
import CropHealth from '@/pages/CropHealth'
import MarketPrices from '@/pages/MarketPrices'
import Weather from '@/pages/Weather'
import Forum from '@/pages/Forum'
import Profile from '@/pages/Profile'
import PWAInstallBanner from '@/components/PWAInstallBanner'
import OfflineBanner from '@/components/OfflineBanner'

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <OfflineBanner />
        <Layout>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/translate" element={<Translate />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/crop-health" element={<CropHealth />} />
            <Route path="/market" element={<MarketPrices />} />
            <Route path="/weather" element={<Weather />} />
            <Route path="/forum" element={<Forum />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
        <PWAInstallBanner />
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 3000,
            style: {
              background: '#1f2937',
              color: '#f9fafb',
              borderRadius: '12px',
              padding: '12px 16px',
            },
            success: { iconTheme: { primary: '#22c55e', secondary: '#fff' } },
            error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
          }}
        />
      </BrowserRouter>
    </AppProvider>
  )
}

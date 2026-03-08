import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AppProvider, useAppContext } from '@/context/AppContext'
import Layout from '@/components/Layout'
import Home from '@/pages/Home'
import Translate from '@/pages/Translate'
import Chat from '@/pages/Chat'
import CropHealth from '@/pages/CropHealth'
import MarketPrices from '@/pages/MarketPrices'
import Weather from '@/pages/Weather'
import Forum from '@/pages/Forum'
import Profile from '@/pages/Profile'
import Login from '@/pages/Login'
import Register from '@/pages/Register'
import VerifyEmail from '@/pages/VerifyEmail'
import PWAInstallBanner from '@/components/PWAInstallBanner'
import OfflineBanner from '@/components/OfflineBanner'
import EvalDashboard from '@/pages/EvalDashboard'
import AdminTables from '@/pages/AdminTables'
import AdminCache from '@/pages/AdminCache'
import InsuranceSuggestion from '@/pages/InsuranceSuggestion'
import AdminGate from '@/components/AdminGate'
import type { ReactNode } from 'react'

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { state, hydrated } = useAppContext()
  if (!hydrated) return null
  if (!state.authUser) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <OfflineBanner />
        <Layout>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/translate" element={<ProtectedRoute><Translate /></ProtectedRoute>} />
            <Route path="/chat" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
            <Route path="/crop-health" element={<ProtectedRoute><CropHealth /></ProtectedRoute>} />
            <Route path="/market" element={<ProtectedRoute><MarketPrices /></ProtectedRoute>} />
            <Route path="/weather" element={<ProtectedRoute><Weather /></ProtectedRoute>} />
            <Route path="/forum" element={<ProtectedRoute><Forum /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/insurance" element={<ProtectedRoute><InsuranceSuggestion /></ProtectedRoute>} />
            <Route path="/admin/eval" element={<AdminGate><EvalDashboard /></AdminGate>} />
            <Route path="/admin/tables" element={<AdminGate><AdminTables /></AdminGate>} />
            <Route path="/admin/cache" element={<AdminGate><AdminCache /></AdminGate>} />
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

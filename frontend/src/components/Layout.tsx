import { ReactNode, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import Navbar from './Navbar'
import Sidebar from './Sidebar'
import { useAppContext } from '@/context/AppContext'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const { state, dispatch } = useAppContext()
  const location = useLocation()

  const isAdminRoute = location.pathname.startsWith('/admin')
  const isAuthRoute = location.pathname === '/' || location.pathname === '/login' || location.pathname === '/register'

  // Close sidebar on route change
  useEffect(() => {
    dispatch({ type: 'SET_SIDEBAR', payload: false })
  }, [location.pathname, dispatch])

  return (
    <div className="flex flex-col min-h-screen bg-primary-50">
      {/* Navbar */}
      {!isAdminRoute && <Navbar />}

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar overlay */}
        {!isAdminRoute && !isAuthRoute && state.sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/40 z-30 lg:hidden"
            onClick={() => dispatch({ type: 'SET_SIDEBAR', payload: false })}
          />
        )}

        {/* Sidebar - fixed between top bar and bottom nav, scrolls internally */}
        {!isAdminRoute && !isAuthRoute && (
          <aside
            className={
              `fixed left-0 w-64 z-50 bg-white shadow-xl transform transition-transform duration-300 ease-in-out
              ${state.sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
              flex-shrink-0 border-r border-gray-100 overflow-y-auto top-0 bottom-0 lg:top-0 lg:bottom-0`
            }
          >
            <Sidebar />
          </aside>
        )}

        {/* Main content */}
        <main className={`flex-1 overflow-y-auto ${!isAdminRoute && !isAuthRoute ? 'lg:ml-64' : ''}`}>
          {isAdminRoute ? (
            children
          ) : (
            <div className="max-w-5xl mx-auto px-4 py-6 lg:pb-6">
              {children}
            </div>
          )}
        </main>
      </div>


    </div>
  )
}

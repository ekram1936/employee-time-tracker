import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import { AuthContext, useAuthProvider } from './hooks/useAuth'
import Layout       from './components/Layout'
import Login        from './pages/Login'
import Register     from './pages/Register'
import Dashboard    from './pages/Dashboard'
import CalendarView from './pages/CalendarView'
import Summary      from './pages/Summary'
import Vacation     from './pages/Vacation'
import Profile      from './pages/Profile'

export default function App() {
  const auth = useAuthProvider()

  if (auth.initializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="white" strokeWidth="2.5">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
          </div>
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <AuthContext.Provider value={auth}>
      <Routes>
        <Route path="/login"     element={auth.user ? <Navigate to="/dashboard" replace /> : <Login />} />
        <Route path="/register"  element={auth.user ? <Navigate to="/dashboard" replace /> : <Register />} />
        <Route path="/dashboard" element={auth.user ? <Layout><Dashboard /></Layout>    : <Navigate to="/login" replace />} />
        <Route path="/calendar"  element={auth.user ? <Layout><CalendarView /></Layout> : <Navigate to="/login" replace />} />
        <Route path="/summary"   element={auth.user ? <Layout><Summary /></Layout>      : <Navigate to="/login" replace />} />
        <Route path="/vacation"  element={auth.user ? <Layout><Vacation /></Layout>     : <Navigate to="/login" replace />} />
        <Route path="/profile"   element={auth.user ? <Layout><Profile /></Layout>      : <Navigate to="/login" replace />} />
        <Route path="*"          element={<Navigate to={auth.user ? '/dashboard' : '/login'} replace />} />
      </Routes>
      <Toaster richColors position="top-right" closeButton />
    </AuthContext.Provider>
  )
}
import type { JSX } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import LandingPage from './pages/LandingPage'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { PatientDashboard } from './pages/PatientDashboard'
import { PhysioConnectPage } from './pages/PhysioConnectPage'
import { PhysioDashboard } from './pages/PhysioDashboard'
import PhysioPatientDetail from './pages/PhysioPatientDetail'
import { LiveAnalysis } from './pages/LiveAnalysis'
import { SessionResults } from './pages/SessionResults'
import ExerciseSelect from './pages/ExerciseSelect'
import ExerciseInstructions from './pages/ExerciseInstructions'
import SessionHistory from './pages/SessionHistory'
import ProfilePage from './pages/ProfilePage'

function ProtectedRoute({ children, role }: { children: JSX.Element; role?: 'patient' | 'physiotherapist' }) {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-950">
        <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  if (role && user.role !== role && user.role !== 'admin') {
    return <Navigate to={user.role === 'physiotherapist' ? '/physio/dashboard' : '/patient/dashboard'} replace />
  }
  return children
}

function AppRoutes() {
  const { user } = useAuth()
  return (
    <Routes>
      <Route
        path="/"
        element={
          user ? (
            <Navigate to={user.role === 'physiotherapist' ? '/physio/dashboard' : '/patient/dashboard'} replace />
          ) : (
            <LandingPage />
          )
        }
      />

      {/* Auth Routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/login/patient" element={<LoginPage />} />
      <Route path="/login/physiotherapist" element={<LoginPage />} />

      {/* Patient Specific Routes */}
      <Route
        path="/patient/dashboard"
        element={
          <ProtectedRoute role="patient">
            <PatientDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/patient/connect"
        element={
          <ProtectedRoute role="patient">
            <PhysioConnectPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/patient/exercises"
        element={
          <ProtectedRoute role="patient">
            <ExerciseSelect />
          </ProtectedRoute>
        }
      />
      <Route
        path="/patient/exercises/:id/instructions"
        element={
          <ProtectedRoute role="patient">
            <ExerciseInstructions />
          </ProtectedRoute>
        }
      />
      <Route
        path="/patient/session/:id"
        element={
          <ProtectedRoute role="patient">
            <LiveAnalysis />
          </ProtectedRoute>
        }
      />
      <Route
        path="/patient/results"
        element={
          <ProtectedRoute role="patient">
            <SessionResults />
          </ProtectedRoute>
        }
      />
      <Route
        path="/patient/session/results"
        element={
          <ProtectedRoute role="patient">
            <SessionResults />
          </ProtectedRoute>
        }
      />
      <Route
        path="/patient/history"
        element={
          <ProtectedRoute role="patient">
            <SessionHistory />
          </ProtectedRoute>
        }
      />
      <Route
        path="/patient/profile"
        element={
          <ProtectedRoute role="patient">
            <ProfilePage />
          </ProtectedRoute>
        }
      />

      {/* Physiotherapist Specific Routes */}
      <Route
        path="/physio/dashboard"
        element={
          <ProtectedRoute role="physiotherapist">
            <PhysioDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/physiotherapist/dashboard"
        element={<Navigate to="/physio/dashboard" replace />}
      />
      <Route
        path="/physio/patient/:id"
        element={
          <ProtectedRoute role="physiotherapist">
            <PhysioPatientDetail />
          </ProtectedRoute>
        }
      />
      <Route
        path="/physiotherapist/patients/:id"
        element={
          <ProtectedRoute role="physiotherapist">
            <PhysioPatientDetail />
          </ProtectedRoute>
        }
      />

      {/* Legacy Fallbacks */}
      <Route path="/dashboard" element={<Navigate to="/patient/dashboard" replace />} />
      <Route path="/exercises" element={<Navigate to="/patient/exercises" replace />} />
      <Route path="/history" element={<Navigate to="/patient/history" replace />} />
      <Route path="/profile" element={<Navigate to="/patient/profile" replace />} />
      <Route path="/physio" element={<Navigate to="/physio/dashboard" replace />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}

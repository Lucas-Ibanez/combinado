import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ProtectedRoute from '@/components/common/ProtectedRoute'
import AppLayout from '@/components/common/AppLayout'
import DashboardPage from '@/pages/DashboardPage'
import IncidentsPage from '@/pages/IncidentsPage'
import IncidentDetailPage from '@/pages/IncidentDetailPage'
import ProtectionPage from '@/pages/ProtectionPage'
import ChatPage from '@/pages/ChatPage'
import SettingsPage from '@/pages/SettingsPage'
import LoginPage from '@/pages/LoginPage'
import MfaEnrollPage from '@/pages/MfaEnrollPage'
import MfaVerifyPage from '@/pages/MfaVerifyPage'
import OnboardingPage from '@/pages/OnboardingPage'
import SimulationsPage from '@/pages/SimulationsPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30,
      retry: 1,
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/mfa/enroll" element={<MfaEnrollPage />} />
          <Route path="/mfa/verify" element={<MfaVerifyPage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="onboarding" element={<OnboardingPage />} />
            <Route element={<AppLayout />}>
              <Route index element={<DashboardPage />} />
              <Route path="alerts" element={<IncidentsPage />} />
              <Route path="alerts/:id" element={<IncidentDetailPage />} />
              <Route path="protection" element={<ProtectionPage />} />
              <Route path="simulations" element={<SimulationsPage />} />
              <Route path="chat" element={<ChatPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

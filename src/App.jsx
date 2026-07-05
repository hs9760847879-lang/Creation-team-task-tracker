import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './hooks/useAuth'
import { ProtectedRoute } from './components/layout/ProtectedRoute'
import AppLayout from './components/layout/AppLayout'
import Login from './pages/Login'
import AgentOverview from './pages/agent/AgentOverview'
import AgentTasks from './pages/agent/AgentTasks'
import AgentSettings from './pages/agent/AgentSettings'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminTasks from './pages/admin/AdminTasks'
import AdminAgents from './pages/admin/AdminAgents'
import AdminStats from './pages/admin/AdminStats'
import AdminStatsDetail from './pages/admin/AdminStatsDetail'
import AdminIndividualPerformance from './pages/admin/AdminIndividualPerformance'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/overview" element={<AgentOverview />} />
              <Route path="/tasks" element={<AgentTasks />} />
              <Route path="/settings" element={<AgentSettings />} />
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/tasks" element={<AdminTasks />} />
              <Route path="/admin/agents" element={<AdminAgents />} />
              <Route path="/admin/stats" element={<AdminStats />} />
              <Route path="/admin/stats/:metric" element={<AdminStatsDetail />} />
              <Route path="/admin/individual-performance" element={<AdminIndividualPerformance />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

export function ProtectedRoute() {
  const { user, profile, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-bg">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!user) return <Navigate to="/login" state={{ from: location }} replace />

  const adminRoutes = ['/admin', '/admin/tasks', '/admin/agents', '/property-summary']
  const isAdminRoute = adminRoutes.some((route) => location.pathname.startsWith(route))

  if (isAdminRoute && profile?.role !== 'admin') {
    return <Navigate to="/overview" replace />
  }

  if (!isAdminRoute && profile?.role === 'admin' && location.pathname === '/') {
    return <Navigate to="/admin" replace />
  }

  return <Outlet />
}

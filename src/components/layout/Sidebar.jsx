import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  ListChecks,
  Users,
  UserCircle,
  LogOut,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  UserCheck,
  Settings,
} from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'

const agentLinks = [
  { to: '/overview', label: 'Overview', icon: LayoutDashboard },
  { to: '/tasks', label: 'My Tasks', icon: ListChecks },
  { to: '/property-summary', label: 'Property Summary', icon: BarChart3 },
  { to: '/settings', label: 'Settings', icon: Settings },
]

const adminLinks = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin/tasks', label: 'Task Manager', icon: ListChecks },
  { to: '/admin/agents', label: 'Agents', icon: Users },
  { to: '/admin/stats', label: 'Team Stats', icon: BarChart3 },
  { to: '/admin/individual-performance', label: 'Individual Performance', icon: UserCheck },
]

export default function Sidebar() {
  const { profile, signOut } = useAuth()
  const [collapsed, setCollapsed] = useState(false)
  const isAdmin = profile?.role === 'admin'
  const links = isAdmin ? adminLinks : agentLinks

  return (
    <aside
      className={`flex flex-col bg-[#1e293b] text-white transition-all duration-200 ${
        collapsed ? 'w-16' : 'w-60'
      } min-h-screen sticky top-0 left-0`}
    >
      <div className="flex items-center gap-2 px-4 h-16 border-b border-white/10">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center font-bold text-xs shrink-0">
          CT
        </div>
        {!collapsed && (
          <span className="font-semibold text-sm tracking-wide">CREATION TEAM</span>
        )}
      </div>

      <nav className="flex-1 px-2 py-4 space-y-1">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === '/admin' || link.to === '/overview'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-indigo-500/20 text-indigo-300 font-medium'
                  : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
              }`
            }
          >
            <link.icon size={20} className="shrink-0" />
            {!collapsed && <span>{link.label}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-white/10 p-3 space-y-2">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-xs font-bold shrink-0">
            {profile?.name?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          {!collapsed && (
            <div>
              <p>{profile?.name || 'User'}</p>
            </div>
          )}
        </div>
        <button
          onClick={signOut}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-700/50 hover:text-white w-full transition-colors"
        >
          <LogOut size={20} className="shrink-0" />
          {!collapsed && <span>Sign Out</span>}
        </button>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center w-full py-1.5 rounded-lg text-slate-400 hover:bg-slate-700/50 hover:text-white transition-colors"
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>
    </aside>
  )
}

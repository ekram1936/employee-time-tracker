import { NavLink, useNavigate } from 'react-router-dom'
import { Clock, LayoutDashboard, CalendarDays, BarChart2, Palmtree, User, LogOut } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

const nav = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/calendar',  icon: CalendarDays,    label: 'Calendar'  },
  { to: '/summary',   icon: BarChart2,       label: 'Summary'   },
  { to: '/vacation',  icon: Palmtree,        label: 'Vacation'  },
  { to: '/profile',   icon: User,            label: 'Profile'   },
]

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => { logout(); navigate('/login', { replace: true }) }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="w-60 shrink-0 bg-white border-r border-slate-100 flex flex-col">
        <div className="flex items-center gap-2.5 px-5 py-5 border-b border-slate-100">
          <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center">
            <Clock size={16} className="text-white" />
          </div>
          <span className="font-bold text-slate-900 text-lg">TimeTrack</span>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {nav.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
              }`
            }>
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="px-3 pb-4 border-t border-slate-100 pt-3">
          <div className="flex items-center gap-2.5 px-3 py-2 mb-1">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xs shrink-0">
              {user?.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-900 truncate">{user?.name}</p>
              <p className="text-xs text-slate-400 truncate">{user?.position}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2 rounded-xl text-sm text-slate-400 hover:bg-slate-50 hover:text-red-500 transition-colors"
          >
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
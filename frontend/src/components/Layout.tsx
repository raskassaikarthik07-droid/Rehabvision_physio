import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import Avatar from './Avatar'
import { Activity, LayoutDashboard, Dumbbell, History, Users, User, LogOut, Stethoscope } from 'lucide-react'

export default function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth()
  const location = useLocation()

  const isPhysio = user?.role === 'physiotherapist'

  const patientNav = [
    { to: '/patient/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/patient/exercises', icon: Dumbbell, label: 'Exercise Library' },
    { to: '/patient/history', icon: History, label: 'Session History' },
    { to: '/patient/profile', icon: User, label: 'Patient Profile' },
  ]

  const physioNav = [
    { to: '/physiotherapist/dashboard', icon: Users, label: 'Supervision Panel' },
    { to: '/physiotherapist/profile', icon: User, label: 'Clinical Profile' },
  ]

  const navItems = isPhysio ? physioNav : patientNav

  return (
    <div className="min-h-screen bg-[#0f172a] flex">
      {/* Sidebar */}
      <aside className="w-64 bg-[#1e293b] border-r border-[#334155] flex flex-col shrink-0">
        <div className="p-6 border-b border-[#334155]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-sky-500/20 rounded-2xl flex items-center justify-center border border-sky-500/30">
              <Activity className="w-6 h-6 text-sky-400" />
            </div>
            <div>
              <h1 className="text-white font-extrabold text-lg leading-none">RehabVision</h1>
              <div className="flex items-center gap-1.5 mt-1.5">
                {isPhysio ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-cyan-500/15 text-cyan-300 text-[10px] font-bold uppercase tracking-wider border border-cyan-500/30">
                    <Stethoscope className="w-3 h-3" /> Clinician
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-sky-500/15 text-sky-300 text-[10px] font-bold uppercase tracking-wider border border-sky-500/30">
                    <User className="w-3 h-3" /> Patient
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1.5">
          {navItems.map(({ to, icon: Icon, label }) => {
            const active = location.pathname === to || (to === '/physiotherapist/dashboard' && location.pathname.startsWith('/physiotherapist/patients'))
            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all ${
                  active
                    ? isPhysio
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-md shadow-cyan-500/10'
                      : 'bg-sky-500/20 text-sky-300 border border-sky-500/30 shadow-md shadow-sky-500/10'
                    : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                }`}
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span>{label}</span>
              </Link>
            )
          })}
        </nav>

        {user && (
          <div className="p-4 border-t border-[#334155] bg-slate-900/50">
            <div className="flex items-center gap-3 mb-3">
              <Avatar
                name={user.name}
                src={user.picture}
                size="sm"
                role={isPhysio ? 'physiotherapist' : 'patient'}
              />
              <div className="min-w-0 flex-1">
                <p className="text-white text-xs font-bold truncate">{user.name}</p>
                <p className="text-slate-400 text-[11px] truncate">{user.email}</p>
              </div>
            </div>
            <button
              onClick={logout}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 border border-transparent hover:border-rose-500/20 transition-all cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-[#0f172a]">
        {children}
      </main>
    </div>
  )
}

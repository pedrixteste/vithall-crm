import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { LayoutDashboard, Users, GitBranch, CheckSquare, LogOut } from 'lucide-react'

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/clientes', label: 'Clientes', icon: Users },
  { to: '/pipeline', label: 'Pipeline', icon: GitBranch },
  { to: '/tarefas', label: 'Tarefas', icon: CheckSquare },
]

export default function Layout({ children }) {
  const { profile, signOut } = useAuth()
  const location = useLocation()

  const isActive = (to) => location.pathname === to

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0A0A0A' }}>

      {/* Header */}
      <header className="flex items-center justify-between px-4 h-14 border-b flex-shrink-0 sticky top-0 z-40"
        style={{ background: 'rgba(10,10,10,0.95)', borderColor: '#1C1C1C', backdropFilter: 'blur(12px)' }}>

        <div className="flex items-center gap-2.5">
          <div className="h-7 px-2 rounded-lg flex items-center" style={{ background: '#fff' }}>
            <img src="/logo.png" alt="Vithall" className="h-5 object-contain" />
          </div>
          <span className="text-xs font-bold tracking-[0.1em] uppercase" style={{ color: '#C9A84C' }}>CRM</span>
        </div>

        <div className="flex items-center gap-3">
          {profile?.name && (
            <span className="text-xs hidden sm:block" style={{ color: '#6B6560' }}>
              {profile.name.split(' ')[0]}
            </span>
          )}
          <button onClick={signOut}
            className="w-8 h-8 rounded-xl flex items-center justify-center transition-all"
            style={{ color: '#6B6560', background: '#1A1A1A', border: '1px solid #252525' }}
            onMouseEnter={e => e.currentTarget.style.color = '#C9A84C'}
            onMouseLeave={e => e.currentTarget.style.color = '#6B6560'}>
            <LogOut size={15} />
          </button>
        </div>
      </header>

      {/* Sidebar desktop */}
      <div className="flex flex-1 overflow-hidden">
        <aside className="hidden sm:flex flex-col w-52 border-r flex-shrink-0 pt-4"
          style={{ background: '#0A0A0A', borderColor: '#1C1C1C' }}>
          <p className="px-4 pb-2 text-[10px] font-bold uppercase tracking-widest" style={{ color: '#2A2A2A' }}>
            Navegação
          </p>
          {navItems.map(({ to, label, icon: Icon }) => (
            <Link key={to} to={to}
              className="flex items-center gap-3 mx-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all mb-0.5"
              style={{
                color: isActive(to) ? '#C9A84C' : '#6B6560',
                background: isActive(to) ? 'rgba(201,168,76,0.08)' : 'transparent',
                borderLeft: isActive(to) ? '2px solid #C9A84C' : '2px solid transparent',
              }}>
              <Icon size={16} />
              {label}
            </Link>
          ))}
        </aside>

        {/* Conteúdo */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden pb-20 sm:pb-6">
          <div className="w-full max-w-lg mx-auto px-4 pt-5">
            {children}
          </div>
        </main>
      </div>

      {/* Bottom nav mobile */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 border-t"
        style={{ background: 'rgba(10,10,10,0.97)', borderColor: '#1C1C1C', backdropFilter: 'blur(12px)' }}>
        <div className="flex">
          {navItems.map(({ to, label, icon: Icon }) => (
            <Link key={to} to={to}
              className="flex-1 flex flex-col items-center py-2.5 gap-1 transition-all"
              style={{ color: isActive(to) ? '#C9A84C' : '#333030' }}>
              <Icon size={20} strokeWidth={isActive(to) ? 2.5 : 1.8} />
              <span className="text-[10px] font-semibold">{label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  )
}

import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { LayoutDashboard, Users, GitBranch, CheckSquare, LogOut, Menu, X } from 'lucide-react'
import { useState } from 'react'

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/clientes', label: 'Clientes', icon: Users },
  { to: '/pipeline', label: 'Pipeline', icon: GitBranch },
  { to: '/tarefas', label: 'Tarefas', icon: CheckSquare },
]

export default function Layout({ children }) {
  const { profile, signOut } = useAuth()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)

  const isActive = (to) => location.pathname === to

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0D0D0D' }}>

      {/* Header */}
      <header className="flex items-center justify-between px-5 py-4 border-b" style={{
        background: '#161616',
        borderColor: '#2A2A2A',
      }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #7B1C3A, #C9A84C)' }}>
            <span className="text-white font-bold text-sm">V</span>
          </div>
          <span className="font-bold text-base" style={{ color: '#F0EAD6', letterSpacing: '-0.01em' }}>
            Vithall <span style={{ color: '#C9A84C' }}>CRM</span>
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs hidden sm:block" style={{ color: '#7A7570' }}>
            {profile?.name}
          </span>
          <button onClick={signOut}
            className="p-2 rounded-lg transition-all"
            style={{ color: '#7A7570' }}
            onMouseEnter={e => e.currentTarget.style.color = '#C9A84C'}
            onMouseLeave={e => e.currentTarget.style.color = '#7A7570'}
            title="Sair">
            <LogOut size={18} />
          </button>
          <button className="sm:hidden p-2" onClick={() => setMenuOpen(!menuOpen)}
            style={{ color: '#7A7570' }}>
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Sidebar desktop */}
        <aside className="hidden sm:flex flex-col w-56 pt-6 border-r" style={{
          background: '#161616',
          borderColor: '#2A2A2A',
        }}>
          <p className="px-5 pb-3 text-xs font-semibold uppercase tracking-widest" style={{ color: '#3A3530' }}>
            Menu
          </p>
          {navItems.map(({ to, label, icon: Icon }) => (
            <Link key={to} to={to}
              className="flex items-center gap-3 mx-3 px-3 py-3 rounded-xl text-sm font-medium transition-all mb-1"
              style={{
                color: isActive(to) ? '#C9A84C' : '#7A7570',
                background: isActive(to) ? 'rgba(201,168,76,0.08)' : 'transparent',
                border: isActive(to) ? '1px solid rgba(201,168,76,0.15)' : '1px solid transparent',
              }}>
              <Icon size={17} />
              {label}
            </Link>
          ))}
        </aside>

        {/* Mobile overlay menu */}
        {menuOpen && (
          <div className="sm:hidden fixed inset-0 z-50" style={{ background: 'rgba(0,0,0,0.7)' }}
            onClick={() => setMenuOpen(false)}>
            <div className="w-64 h-full pt-6 border-r" style={{ background: '#161616', borderColor: '#2A2A2A' }}
              onClick={e => e.stopPropagation()}>
              <div className="px-5 pb-4 border-b mb-3" style={{ borderColor: '#2A2A2A' }}>
                <p className="font-semibold text-sm" style={{ color: '#F0EAD6' }}>{profile?.name}</p>
                <p className="text-xs mt-0.5" style={{ color: '#7A7570' }}>Vendedor</p>
              </div>
              {navItems.map(({ to, label, icon: Icon }) => (
                <Link key={to} to={to}
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-3 mx-3 px-3 py-3 rounded-xl text-sm font-medium transition-all mb-1"
                  style={{
                    color: isActive(to) ? '#C9A84C' : '#7A7570',
                    background: isActive(to) ? 'rgba(201,168,76,0.08)' : 'transparent',
                  }}>
                  <Icon size={17} />
                  {label}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Conteúdo principal */}
        <main className="flex-1 p-5 overflow-auto pb-24 sm:pb-5">
          {children}
        </main>
      </div>

      {/* Bottom nav mobile */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 flex border-t" style={{
        background: '#161616',
        borderColor: '#2A2A2A',
      }}>
        {navItems.map(({ to, label, icon: Icon }) => (
          <Link key={to} to={to}
            className="flex-1 flex flex-col items-center py-3 gap-1 text-xs font-medium transition-all"
            style={{ color: isActive(to) ? '#C9A84C' : '#3A3530' }}>
            <Icon size={20} />
            <span style={{ fontSize: '10px' }}>{label}</span>
          </Link>
        ))}
      </nav>
    </div>
  )
}

import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
  LayoutDashboard, Users, GitBranch, CheckSquare, LogOut, Menu, X
} from 'lucide-react'
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

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-blue-700 text-white px-4 py-3 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
            <span className="text-blue-700 font-bold text-sm">V</span>
          </div>
          <span className="font-bold text-lg">Vithall CRM</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-blue-200 text-sm hidden sm:block">{profile?.name}</span>
          <button onClick={signOut} className="text-blue-200 hover:text-white transition" title="Sair">
            <LogOut size={20} />
          </button>
          <button className="sm:hidden" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Sidebar desktop */}
        <aside className="hidden sm:flex flex-col w-56 bg-white border-r border-gray-200 pt-4">
          {navItems.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className={`flex items-center gap-3 px-4 py-3 text-sm font-medium transition
                ${location.pathname === to
                  ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-600'
                  : 'text-gray-600 hover:bg-gray-50'}`}
            >
              <Icon size={18} />
              {label}
            </Link>
          ))}
        </aside>

        {/* Mobile nav */}
        {menuOpen && (
          <div className="sm:hidden fixed inset-0 z-50 bg-black/40" onClick={() => setMenuOpen(false)}>
            <div className="bg-white w-56 h-full pt-4 shadow-xl" onClick={e => e.stopPropagation()}>
              <p className="px-4 pb-3 text-xs text-gray-400 font-medium uppercase">Menu</p>
              {navItems.map(({ to, label, icon: Icon }) => (
                <Link
                  key={to}
                  to={to}
                  onClick={() => setMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 text-sm font-medium transition
                    ${location.pathname === to
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-50'}`}
                >
                  <Icon size={18} />
                  {label}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Main content */}
        <main className="flex-1 p-4 overflow-auto">
          {children}
        </main>
      </div>

      {/* Bottom nav mobile */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex">
        {navItems.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className={`flex-1 flex flex-col items-center py-2 text-xs transition
              ${location.pathname === to ? 'text-blue-600' : 'text-gray-500'}`}
          >
            <Icon size={20} />
            <span className="mt-0.5">{label}</span>
          </Link>
        ))}
      </nav>
    </div>
  )
}

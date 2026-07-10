import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { LayoutDashboard, Users, CheckSquare, UserCircle, Users2, BarChart2, Phone, CalendarDays, CalendarClock } from 'lucide-react'

// "Hoje" fica em 2ª posição (ao lado do Dashboard) para todos os perfis
const BASE_NAV = [
  { to: '/',           label: 'Dashboard',  icon: LayoutDashboard },
  { to: '/agenda',     label: 'Hoje',       icon: CalendarDays },
  { to: '/clientes',   label: 'Clientes',   icon: Users },
  { to: '/agendas',    label: 'Agenda',     icon: CalendarClock },
  { to: '/relatorios', label: 'Relatorios', icon: BarChart2 },
  { to: '/ligacoes',   label: 'Ligacoes',   icon: Phone },
  { to: '/tarefas',    label: 'Tarefas',    icon: CheckSquare,   mobileHide: true },
  { to: '/perfil',     label: 'Perfil',     icon: UserCircle,    mobileHide: true },
]

export default function Layout({ children }) {
  const { profile, signOut } = useAuth()
  const location = useLocation()

  // gerente: adiciona "Equipe" antes do "Perfil"
  const navItems = profile?.role === 'gerente'
    ? [...BASE_NAV.slice(0, -1), { to: '/equipe', label: 'Equipe', icon: Users2, mobileHide: true }, BASE_NAV[BASE_NAV.length - 1]]
    : BASE_NAV

  const isActive = (to) => location.pathname === to

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0A0A0A' }}>

      {/* Header */}
      <header className="flex items-center justify-between h-14 border-b flex-shrink-0 sticky top-0 z-40"
        style={{ background: 'rgba(10,10,10,0.95)', borderColor: '#1C1C1C', backdropFilter: 'blur(12px)', paddingLeft: '20px', paddingRight: '20px' }}>

        <div className="flex items-center gap-2.5">
          <div className="h-7 px-2 rounded-lg flex items-center" style={{ background: '#fff' }}>
            <img src="/logo.png" alt="Vithall" className="h-5 object-contain" />
          </div>
          <span className="text-xs font-bold tracking-[0.1em] uppercase" style={{ color: '#C9A84C' }}>CRM</span>
          {profile?.role && (() => {
            const roles = {
              gerente:    { label: 'Gerente',    color: '#C9A84C', bg: 'rgba(201,168,76,0.1)',  border: 'rgba(201,168,76,0.25)'  },
              vendedor:   { label: 'Vendedor',   color: '#A78BFA', bg: 'rgba(167,139,250,0.1)', border: 'rgba(167,139,250,0.25)' },
              pre_vendas: { label: 'Pré-vendas', color: '#60A5FA', bg: 'rgba(96,165,250,0.1)',  border: 'rgba(96,165,250,0.25)'  },
            }
            const r = roles[profile.role]
            if (!r) return null
            return (
              <span className="text-[10px] font-bold rounded-full"
                style={{ padding: '3px 8px', background: r.bg, border: `1px solid ${r.border}`, color: r.color }}>
                {r.label}
              </span>
            )
          })()}
        </div>

        <div className="flex items-center gap-2">
          <Link to="/perfil"
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all"
            style={{ background: '#1A1A1A', border: '1px solid #252525' }}>
            <div className="w-5 h-5 rounded-lg flex items-center justify-center text-xs font-bold"
              style={{ background: 'rgba(201,168,76,0.15)', color: '#C9A84C' }}>
              {profile?.name?.[0]?.toUpperCase() || '?'}
            </div>
            <span className="text-xs font-medium hidden sm:block" style={{ color: '#6B6560' }}>
              {profile?.name?.split(' ')[0]?.split('@')[0]}
            </span>
          </Link>
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
        <main className="flex-1 overflow-y-auto overflow-x-hidden pb-24 sm:pb-8">
          <div className="w-full max-w-lg mx-auto" style={{ paddingLeft: '24px', paddingRight: '24px', paddingTop: '32px' }}>
            {children}
          </div>
        </main>
      </div>

      {/* Bottom nav mobile */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 border-t"
        style={{ background: 'rgba(10,10,10,0.97)', borderColor: '#1C1C1C', backdropFilter: 'blur(12px)' }}>
        <div className="flex pb-safe">
          {navItems.filter(i => !i.mobileHide).map(({ to, label, icon: Icon }) => (
            <Link key={to} to={to}
              className="flex-1 flex flex-col items-center py-3 gap-1.5 transition-all"
              style={{ color: isActive(to) ? '#C9A84C' : '#333030' }}>
              <Icon size={21} strokeWidth={isActive(to) ? 2.5 : 1.8} />
              <span className="text-[10px] font-semibold">{label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  )
}

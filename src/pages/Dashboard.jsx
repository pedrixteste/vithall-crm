import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Users, MapPin, CheckSquare, TrendingUp } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Card, CardHeader } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'

export default function Dashboard() {
  const { profile } = useAuth()
  const [stats, setStats] = useState({ clients: 0, visits: 0, tasks: 0, closed: 0 })
  const [recentVisits, setRecentVisits] = useState([])
  const [pendingTasks, setPendingTasks] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    const [c, v, t, cl, rv, pt] = await Promise.all([
      supabase.from('clients').select('id', { count: 'exact' }),
      supabase.from('visits').select('id', { count: 'exact' }),
      supabase.from('tasks').select('id', { count: 'exact' }).eq('completed', false),
      supabase.from('clients').select('id', { count: 'exact' }).eq('pipeline_stage', 'fechado'),
      supabase.from('visits').select('*, clients(company_name)').order('visit_date', { ascending: false }).limit(4),
      supabase.from('tasks').select('*, clients(company_name)').eq('completed', false).order('due_date').limit(4),
    ])
    setStats({ clients: c.count || 0, visits: v.count || 0, tasks: t.count || 0, closed: cl.count || 0 })
    setRecentVisits(rv.data || [])
    setPendingTasks(pt.data || [])
    setLoading(false)
  }

  const statCards = [
    { label: 'Clientes', value: stats.clients, icon: Users, accent: '#C9A84C', to: '/clientes' },
    { label: 'Visitas', value: stats.visits, icon: MapPin, accent: '#A78BFA', to: '/clientes' },
    { label: 'Pendentes', value: stats.tasks, icon: CheckSquare, accent: '#E8834A', to: '/tarefas' },
    { label: 'Fechados', value: stats.closed, icon: TrendingUp, accent: '#4ADE80', to: '/pipeline' },
  ]

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-7 h-7 rounded-full border-2 animate-spin"
        style={{ borderColor: '#C9A84C', borderTopColor: 'transparent' }} />
    </div>
  )

  return (
    <div className="animate-in space-y-8">
      {/* Saudação */}
      <div className="pt-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.15em] mb-2" style={{ color: '#C9A84C' }}>
          Olá, {profile?.name?.split(' ')[0]?.split('@')[0]}
        </p>
        <h1 style={{ color: '#EFEFEF' }}>Resumo do dia</h1>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-4">
        {statCards.map(({ label, value, icon: Icon, accent, to }) => (
          <Link key={label} to={to} className="block min-w-0">
            <Card hover className="p-6">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-6"
                style={{ background: `${accent}14` }}>
                <Icon size={18} style={{ color: accent }} />
              </div>
              <p className="text-4xl font-bold tabular-nums" style={{ color: '#EFEFEF', letterSpacing: '-2px' }}>
                {value}
              </p>
              <p className="text-xs mt-2 font-medium" style={{ color: '#6B6560' }}>{label}</p>
            </Card>
          </Link>
        ))}
      </div>

      {/* Visitas recentes */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <MapPin size={13} style={{ color: '#C9A84C' }} />
            <span className="text-sm font-semibold" style={{ color: '#EFEFEF' }}>Visitas recentes</span>
          </div>
          <Link to="/clientes" className="text-xs font-medium" style={{ color: '#C9A84C' }}>Ver todas</Link>
        </CardHeader>
        {recentVisits.length === 0 ? (
          <div className="py-10 text-center text-xs" style={{ color: '#333030' }}>Nenhuma visita registrada</div>
        ) : (
          <ul className="divide-y" style={{ borderColor: '#1C1C1C' }}>
            {recentVisits.map(v => (
              <li key={v.id} className="flex items-center justify-between px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#C9A84C' }} />
                  <span className="text-sm font-medium" style={{ color: '#EFEFEF' }}>{v.clients?.company_name}</span>
                </div>
                <span className="text-xs tabular-nums" style={{ color: '#6B6560' }}>
                  {new Date(v.visit_date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Tarefas pendentes */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CheckSquare size={13} style={{ color: '#E8834A' }} />
            <span className="text-sm font-semibold" style={{ color: '#EFEFEF' }}>Tarefas pendentes</span>
          </div>
          <Link to="/tarefas" className="text-xs font-medium" style={{ color: '#C9A84C' }}>Ver todas</Link>
        </CardHeader>
        {pendingTasks.length === 0 ? (
          <div className="py-10 text-center text-xs" style={{ color: '#333030' }}>Nenhuma tarefa pendente 🎉</div>
        ) : (
          <ul className="divide-y" style={{ borderColor: '#1C1C1C' }}>
            {pendingTasks.map(t => (
              <li key={t.id} className="flex items-center justify-between px-6 py-4">
                <div>
                  <p className="text-sm font-medium" style={{ color: '#EFEFEF' }}>{t.title}</p>
                  <p className="text-xs mt-1" style={{ color: '#6B6560' }}>{t.clients?.company_name}</p>
                </div>
                {t.due_date && (
                  <Badge variant="orange">
                    {new Date(t.due_date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                  </Badge>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}

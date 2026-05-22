import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Users, MapPin, CheckSquare, TrendingUp } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function Dashboard() {
  const { profile } = useAuth()
  const [stats, setStats] = useState({ clients: 0, visits: 0, tasks: 0, closed: 0 })
  const [recentVisits, setRecentVisits] = useState([])
  const [pendingTasks, setPendingTasks] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    const [clientsRes, visitsRes, tasksRes, closedRes, recentVisitsRes, pendingTasksRes] = await Promise.all([
      supabase.from('clients').select('id', { count: 'exact' }),
      supabase.from('visits').select('id', { count: 'exact' }),
      supabase.from('tasks').select('id', { count: 'exact' }).eq('completed', false),
      supabase.from('clients').select('id', { count: 'exact' }).eq('pipeline_stage', 'fechado'),
      supabase.from('visits').select('*, clients(company_name)').order('visit_date', { ascending: false }).limit(5),
      supabase.from('tasks').select('*, clients(company_name)').eq('completed', false).order('due_date').limit(5),
    ])
    setStats({ clients: clientsRes.count || 0, visits: visitsRes.count || 0, tasks: tasksRes.count || 0, closed: closedRes.count || 0 })
    setRecentVisits(recentVisitsRes.data || [])
    setPendingTasks(pendingTasksRes.data || [])
    setLoading(false)
  }

  const cards = [
    { label: 'Clientes', value: stats.clients, icon: Users, to: '/clientes', accent: '#C9A84C' },
    { label: 'Visitas', value: stats.visits, icon: MapPin, to: '/clientes', accent: '#9B5DE5' },
    { label: 'Tarefas', value: stats.tasks, icon: CheckSquare, to: '/tarefas', accent: '#E8834A' },
    { label: 'Fechados', value: stats.closed, icon: TrendingUp, to: '/pipeline', accent: '#4ADE80' },
  ]

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
        style={{ borderColor: '#C9A84C', borderTopColor: 'transparent' }} />
    </div>
  )

  return (
    <div>
      {/* Saudação */}
      <div className="mb-7">
        <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: '#C9A84C' }}>
          Bem-vindo de volta
        </p>
        <h1 className="text-2xl font-bold" style={{ color: '#F0EAD6' }}>
          {profile?.name?.split(' ')[0]} 👋
        </h1>
      </div>

      {/* Cards de estatísticas */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {cards.map(({ label, value, icon: Icon, to, accent }) => (
          <Link key={label} to={to}
            className="rounded-2xl p-4 transition-all active:scale-95"
            style={{
              background: '#1E1E1E',
              border: '1px solid #2A2A2A',
            }}>
            <div className="flex items-center justify-between mb-4">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: `${accent}15`, border: `1px solid ${accent}25` }}>
                <Icon size={17} style={{ color: accent }} />
              </div>
              <span className="text-xs font-medium px-2 py-0.5 rounded-full"
                style={{ background: `${accent}10`, color: accent }}>
                ↑
              </span>
            </div>
            <p className="text-3xl font-bold mb-1" style={{ color: '#F0EAD6' }}>{value}</p>
            <p className="text-xs" style={{ color: '#7A7570' }}>{label}</p>
          </Link>
        ))}
      </div>

      {/* Divider com label */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 h-px" style={{ background: '#2A2A2A' }} />
        <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#3A3530' }}>Atividade</span>
        <div className="flex-1 h-px" style={{ background: '#2A2A2A' }} />
      </div>

      {/* Visitas recentes */}
      <div className="rounded-2xl mb-4 overflow-hidden" style={{ background: '#1E1E1E', border: '1px solid #2A2A2A' }}>
        <div className="flex items-center justify-between px-4 py-3.5 border-b" style={{ borderColor: '#2A2A2A' }}>
          <div className="flex items-center gap-2">
            <MapPin size={14} style={{ color: '#C9A84C' }} />
            <span className="text-sm font-semibold" style={{ color: '#F0EAD6' }}>Visitas recentes</span>
          </div>
          <Link to="/clientes" className="text-xs font-medium" style={{ color: '#C9A84C' }}>Ver todas →</Link>
        </div>
        {recentVisits.length === 0 ? (
          <div className="py-8 text-center">
            <MapPin size={24} className="mx-auto mb-2" style={{ color: '#2A2A2A' }} />
            <p className="text-xs" style={{ color: '#3A3530' }}>Nenhuma visita registrada</p>
          </div>
        ) : (
          <ul>
            {recentVisits.map((v, i) => (
              <li key={v.id} className="flex items-center justify-between px-4 py-3"
                style={{ borderBottom: i < recentVisits.length - 1 ? '1px solid #222' : 'none' }}>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#C9A84C' }} />
                  <span className="text-sm font-medium" style={{ color: '#F0EAD6' }}>{v.clients?.company_name}</span>
                </div>
                <span className="text-xs" style={{ color: '#7A7570' }}>
                  {new Date(v.visit_date).toLocaleDateString('pt-BR')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Tarefas pendentes */}
      <div className="rounded-2xl overflow-hidden" style={{ background: '#1E1E1E', border: '1px solid #2A2A2A' }}>
        <div className="flex items-center justify-between px-4 py-3.5 border-b" style={{ borderColor: '#2A2A2A' }}>
          <div className="flex items-center gap-2">
            <CheckSquare size={14} style={{ color: '#E8834A' }} />
            <span className="text-sm font-semibold" style={{ color: '#F0EAD6' }}>Tarefas pendentes</span>
          </div>
          <Link to="/tarefas" className="text-xs font-medium" style={{ color: '#C9A84C' }}>Ver todas →</Link>
        </div>
        {pendingTasks.length === 0 ? (
          <div className="py-8 text-center">
            <CheckSquare size={24} className="mx-auto mb-2" style={{ color: '#2A2A2A' }} />
            <p className="text-xs" style={{ color: '#3A3530' }}>Nenhuma tarefa pendente</p>
          </div>
        ) : (
          <ul>
            {pendingTasks.map((t, i) => (
              <li key={t.id} className="flex items-center justify-between px-4 py-3"
                style={{ borderBottom: i < pendingTasks.length - 1 ? '1px solid #222' : 'none' }}>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#E8834A' }} />
                  <div>
                    <p className="text-sm font-medium" style={{ color: '#F0EAD6' }}>{t.title}</p>
                    <p className="text-xs" style={{ color: '#7A7570' }}>{t.clients?.company_name}</p>
                  </div>
                </div>
                {t.due_date && (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(232,131,74,0.1)', color: '#E8834A' }}>
                    {new Date(t.due_date).toLocaleDateString('pt-BR')}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

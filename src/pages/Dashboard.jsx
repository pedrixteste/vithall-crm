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

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    const [clientsRes, visitsRes, tasksRes, closedRes, recentVisitsRes, pendingTasksRes] = await Promise.all([
      supabase.from('clients').select('id', { count: 'exact' }),
      supabase.from('visits').select('id', { count: 'exact' }),
      supabase.from('tasks').select('id', { count: 'exact' }).eq('completed', false),
      supabase.from('clients').select('id', { count: 'exact' }).eq('pipeline_stage', 'fechado'),
      supabase.from('visits').select('*, clients(company_name)').order('visit_date', { ascending: false }).limit(5),
      supabase.from('tasks').select('*, clients(company_name)').eq('completed', false).order('due_date').limit(5),
    ])

    setStats({
      clients: clientsRes.count || 0,
      visits: visitsRes.count || 0,
      tasks: tasksRes.count || 0,
      closed: closedRes.count || 0,
    })
    setRecentVisits(recentVisitsRes.data || [])
    setPendingTasks(pendingTasksRes.data || [])
    setLoading(false)
  }

  const cards = [
    { label: 'Clientes', value: stats.clients, icon: Users, color: 'bg-blue-500', to: '/clientes' },
    { label: 'Visitas', value: stats.visits, icon: MapPin, color: 'bg-green-500', to: '/clientes' },
    { label: 'Tarefas pendentes', value: stats.tasks, icon: CheckSquare, color: 'bg-yellow-500', to: '/tarefas' },
    { label: 'Vendas fechadas', value: stats.closed, icon: TrendingUp, color: 'bg-purple-500', to: '/pipeline' },
  ]

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  )

  return (
    <div className="pb-20 sm:pb-4">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-800">Olá, {profile?.name?.split(' ')[0]} 👋</h1>
        <p className="text-gray-500 text-sm">Aqui está um resumo do seu CRM</p>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {cards.map(({ label, value, icon: Icon, color, to }) => (
          <Link key={label} to={to} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition">
            <div className={`w-9 h-9 ${color} rounded-lg flex items-center justify-center mb-3`}>
              <Icon size={18} className="text-white" />
            </div>
            <p className="text-2xl font-bold text-gray-800">{value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
          </Link>
        ))}
      </div>

      {/* Visitas recentes */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-4">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800 text-sm">Visitas recentes</h2>
          <Link to="/clientes" className="text-blue-600 text-xs">Ver todas</Link>
        </div>
        {recentVisits.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-6">Nenhuma visita registrada</p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {recentVisits.map(v => (
              <li key={v.id} className="px-4 py-3">
                <p className="text-sm font-medium text-gray-800">{v.clients?.company_name}</p>
                <p className="text-xs text-gray-400">{new Date(v.visit_date).toLocaleDateString('pt-BR')}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Tarefas pendentes */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800 text-sm">Tarefas pendentes</h2>
          <Link to="/tarefas" className="text-blue-600 text-xs">Ver todas</Link>
        </div>
        {pendingTasks.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-6">Nenhuma tarefa pendente</p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {pendingTasks.map(t => (
              <li key={t.id} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-800">{t.title}</p>
                  <p className="text-xs text-gray-400">{t.clients?.company_name}</p>
                </div>
                {t.due_date && (
                  <span className="text-xs text-orange-500 font-medium">
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

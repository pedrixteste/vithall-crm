import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Users, MapPin, CheckSquare, TrendingUp, Plus, Phone, Calendar } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Card, CardHeader } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import ClienteForm from '../components/ClienteForm'
import { requestNotificationPermission, scheduleTodayReminders } from '../lib/reminders'
import { initOneSignal } from '../lib/onesignal'

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}

function getDateLabel() {
  return new Date().toLocaleDateString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long'
  })
}

export default function Dashboard() {
  const { profile, user } = useAuth()
  const [stats, setStats] = useState({ clients: 0, visits: 0, tasks: 0, closed: 0 })
  const [recentVisits, setRecentVisits] = useState([])
  const [pendingTasks, setPendingTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [showClienteForm, setShowClienteForm] = useState(false)
  const [logCalls, setLogCalls]               = useState(0)
  const [logAppointments, setLogAppointments] = useState(0)
  const [savingLog, setSavingLog]             = useState(false)
  const [logSaved, setLogSaved]               = useState(false)

  const today = new Date().toISOString().split('T')[0]

  useEffect(() => {
    fetchData()
    setupReminders()
  }, [])

  useEffect(() => {
    if (profile?.role === 'pre_vendas' && user) fetchTodayLog()
  }, [profile])

  async function setupReminders() {
    initOneSignal()
    const granted = await requestNotificationPermission()
    if (!granted) return
    const { data } = await supabase
      .from('clients')
      .select('id, contact_name, company_name, reminder_config, created_at')
      .not('reminder_config', 'is', null)
    scheduleTodayReminders(data || [])
  }

  async function fetchTodayLog() {
    const { data } = await supabase
      .from('daily_logs')
      .select('*')
      .eq('user_id', user.id)
      .eq('log_date', today)
      .single()
    if (data) {
      setLogCalls(data.calls)
      setLogAppointments(data.appointments)
      setLogSaved(true)
    }
  }

  async function saveDailyLog() {
    setSavingLog(true)
    await supabase.from('daily_logs').upsert({
      user_id:      user.id,
      log_date:     today,
      calls:        logCalls,
      appointments: logAppointments,
    }, { onConflict: 'user_id,log_date' })
    setSavingLog(false)
    setLogSaved(true)
    setTimeout(() => setLogSaved(false), 2000)
  }

  async function fetchData() {
    const [c, v, t, cl, rv, pt] = await Promise.all([
      supabase.from('clients').select('id', { count: 'exact' }),
      supabase.from('visits').select('id', { count: 'exact' }),
      supabase.from('tasks').select('id', { count: 'exact' }).eq('completed', false),
      supabase.from('clients').select('id', { count: 'exact' }).eq('matricula_stage', 'matriculado'),
      supabase.from('visits').select('*, clients(company_name)').order('visit_date', { ascending: false }).limit(4),
      supabase.from('tasks').select('*, clients(company_name)').eq('completed', false).order('due_date').limit(4),
    ])
    setStats({ clients: c.count || 0, visits: v.count || 0, tasks: t.count || 0, closed: cl.count || 0 })
    setRecentVisits(rv.data || [])
    setPendingTasks(pt.data || [])
    setLoading(false)
  }

  const firstName = profile?.name?.split(' ')[0]?.split('@')[0] || ''

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
    <>
      <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>

        {/* Saudação */}
        <div className="pt-2">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] mb-3 capitalize" style={{ color: '#C9A84C' }}>
            {getDateLabel()}
          </p>
          <h1 style={{ color: '#EFEFEF' }}>{getGreeting()}{firstName ? `, ${firstName}` : ''} 👋</h1>
          <p className="text-sm mt-2" style={{ color: '#6B6560' }}>Veja o resumo de hoje</p>
        </div>

        {/* Registro diario — pre-vendas only */}
        {profile?.role === 'pre_vendas' && (
          <div className="rounded-2xl" style={{ background: '#161616', border: '1px solid #252525', padding: '20px' }}>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.2)' }}>
                <Calendar size={14} style={{ color: '#C9A84C' }} />
              </div>
              <p className="text-sm font-semibold" style={{ color: '#EFEFEF' }}>Registro do dia</p>
            </div>

            {/* Ligacoes */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Phone size={14} style={{ color: '#60A5FA' }} />
                <p className="text-sm" style={{ color: '#6B6560' }}>Ligacoes feitas</p>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => setLogCalls(n => Math.max(0, n - 1))}
                  className="w-9 h-9 rounded-xl flex items-center justify-center transition-all"
                  style={{ background: '#111', border: '1px solid #2A2A2A', color: '#6B6560', fontSize: '18px' }}>
                  −
                </button>
                <span className="text-2xl font-bold tabular-nums w-8 text-center"
                  style={{ color: '#60A5FA', letterSpacing: '-1px' }}>
                  {logCalls}
                </span>
                <button onClick={() => setLogCalls(n => n + 1)}
                  className="w-9 h-9 rounded-xl flex items-center justify-center transition-all"
                  style={{ background: 'rgba(96,165,250,0.12)', border: '1px solid rgba(96,165,250,0.25)', color: '#60A5FA', fontSize: '18px' }}>
                  +
                </button>
              </div>
            </div>

            {/* Marcacoes */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <MapPin size={14} style={{ color: '#A78BFA' }} />
                <p className="text-sm" style={{ color: '#6B6560' }}>Marcacoes de visita</p>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => setLogAppointments(n => Math.max(0, n - 1))}
                  className="w-9 h-9 rounded-xl flex items-center justify-center transition-all"
                  style={{ background: '#111', border: '1px solid #2A2A2A', color: '#6B6560', fontSize: '18px' }}>
                  −
                </button>
                <span className="text-2xl font-bold tabular-nums w-8 text-center"
                  style={{ color: '#A78BFA', letterSpacing: '-1px' }}>
                  {logAppointments}
                </span>
                <button onClick={() => setLogAppointments(n => n + 1)}
                  className="w-9 h-9 rounded-xl flex items-center justify-center transition-all"
                  style={{ background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.25)', color: '#A78BFA', fontSize: '18px' }}>
                  +
                </button>
              </div>
            </div>

            <button onClick={saveDailyLog} disabled={savingLog}
              className="w-full py-3 rounded-xl text-sm font-semibold transition-all"
              style={{
                background: logSaved ? 'rgba(74,222,128,0.12)' : 'linear-gradient(135deg, #7B1C3A 0%, #C9A84C 100%)',
                color: logSaved ? '#4ADE80' : '#F0EAD6',
                border: logSaved ? '1px solid rgba(74,222,128,0.3)' : 'none',
                boxShadow: logSaved ? 'none' : '0 2px 12px rgba(201,168,76,0.2)',
              }}>
              {logSaved ? '✓ Salvo' : savingLog ? 'Salvando...' : 'Salvar registro'}
            </button>
          </div>
        )}

        {/* Stats grid */}
        <div className="grid grid-cols-2" style={{ gap: '16px' }}>
          {statCards.map(({ label, value, icon: Icon, accent, to }) => (
            <Link key={label} to={to} className="block min-w-0">
              <div className="rounded-2xl border transition-all active:scale-[0.98] cursor-pointer"
                style={{ background: '#161616', borderColor: `${accent}28`, padding: '28px 20px' }}>
                <div className="rounded-xl flex items-center justify-center"
                  style={{ background: `${accent}18`, width: '44px', height: '44px', marginBottom: '24px' }}>
                  <Icon size={19} style={{ color: accent }} />
                </div>
                <p className="text-4xl font-bold tabular-nums" style={{ color: '#EFEFEF', letterSpacing: '-2px', marginBottom: '4px' }}>
                  {value}
                </p>
                <p className="text-xs font-medium" style={{ color: '#6B6560' }}>{label}</p>
              </div>
            </Link>
          ))}
        </div>

        {/* Visitas recentes */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2.5">
              <MapPin size={14} style={{ color: '#C9A84C' }} />
              <span className="text-sm font-semibold" style={{ color: '#EFEFEF' }}>Visitas recentes</span>
            </div>
            <Link to="/clientes" className="text-xs font-medium" style={{ color: '#C9A84C' }}>Ver todas</Link>
          </CardHeader>
          {recentVisits.length === 0 ? (
            <div className="text-center" style={{ padding: '48px 0' }}>
              <p style={{ fontSize: '2rem', marginBottom: '12px' }}>🗺️</p>
              <p className="text-sm" style={{ color: '#333030' }}>Nenhuma visita registrada</p>
            </div>
          ) : (
            <ul className="divide-y" style={{ borderColor: '#1C1C1C' }}>
              {recentVisits.map(v => (
                <li key={v.id} style={{ padding: '20px 28px' }} className="flex items-center justify-between">
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
            <div className="flex items-center gap-2.5">
              <CheckSquare size={14} style={{ color: '#E8834A' }} />
              <span className="text-sm font-semibold" style={{ color: '#EFEFEF' }}>Tarefas pendentes</span>
            </div>
            <Link to="/tarefas" className="text-xs font-medium" style={{ color: '#C9A84C' }}>Ver todas</Link>
          </CardHeader>
          {pendingTasks.length === 0 ? (
            <div className="text-center" style={{ padding: '48px 0' }}>
              <p style={{ fontSize: '2rem', marginBottom: '12px' }}>🎉</p>
              <p className="text-sm" style={{ color: '#333030' }}>Nenhuma tarefa pendente</p>
            </div>
          ) : (
            <ul className="divide-y" style={{ borderColor: '#1C1C1C' }}>
              {pendingTasks.map(t => (
                <li key={t.id} style={{ padding: '20px 28px' }} className="flex items-center justify-between">
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

      {/* FAB - Novo Cliente */}
      <button
        onClick={() => setShowClienteForm(true)}
        style={{
          position: 'fixed',
          bottom: '88px',
          right: '20px',
          width: '56px',
          height: '56px',
          borderRadius: '18px',
          background: 'linear-gradient(135deg, #7B1C3A 0%, #C9A84C 100%)',
          boxShadow: '0 4px 20px rgba(201,168,76,0.35)',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 30,
        }}
        onTouchStart={e => e.currentTarget.style.transform = 'scale(0.93)'}
        onTouchEnd={e => e.currentTarget.style.transform = 'scale(1)'}
      >
        <Plus size={24} color="#F0EAD6" strokeWidth={2.5} />
      </button>

      {showClienteForm && (
        <ClienteForm
          onClose={() => setShowClienteForm(false)}
          onSaved={() => { setShowClienteForm(false); fetchData() }}
        />
      )}
    </>
  )
}

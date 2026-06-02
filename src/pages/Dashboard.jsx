import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Users, MapPin, CheckSquare, TrendingUp, Plus, Calendar, CalendarCheck, ExternalLink, RotateCcw } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Card, CardHeader } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import ClienteForm from '../components/ClienteForm'
import TarefaForm from '../components/TarefaForm'
import ClienteDetalhe from '../components/ClienteDetalhe'
import { requestNotificationPermission, scheduleTodayReminders } from '../lib/reminders'
import { initOneSignal } from '../lib/onesignal'
import { getValidToken, createCalendarEvent } from '../lib/googleCalendar'

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

const PERIOD_OPTIONS = [
  { key: 'week',   label: 'Semana' },
  { key: 'month',  label: 'Mes' },
  { key: 'year',   label: 'Ano' },
  { key: 'custom', label: 'Personalizado' },
  { key: 'max',    label: 'Maximo' },
]

export default function Dashboard() {
  const { profile: authProfile, user } = useAuth()
  const [freshProfile, setFreshProfile] = useState(authProfile)
  const profile = freshProfile
  const [stats, setStats] = useState({ retornos: 0, visits: 0, tasks: 0, closed: 0 })
  const [recentVisits, setRecentVisits] = useState([])
  const [pendingTasks, setPendingTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [showClienteForm, setShowClienteForm]     = useState(false)
  const [showTarefaForm, setShowTarefaForm]       = useState(false)
  const [selectedCliente, setSelectedCliente]     = useState(null)
  const [period, setPeriod]           = useState('max')
  const [customFrom, setCustomFrom]   = useState('')
  const [customTo, setCustomTo]       = useState('')
  const [showPeriodDrop, setShowPeriodDrop] = useState(false)
  const [scheduledVisits, setScheduledVisits] = useState([])
  const [syncingId, setSyncingId] = useState(null) // id do cliente sendo sincronizado

  useEffect(() => {
    setupReminders()
    // Busca perfil fresco para tokens do Google
    if (user?.id) {
      supabase.from('profiles').select('*').eq('id', user.id).single()
        .then(({ data }) => { if (data) setFreshProfile(data) })
    }
  }, [])


  useEffect(() => {
    if (!profile) return
    if (period === 'custom' && !customFrom) return
    fetchData()
  }, [period, customFrom, customTo, profile])

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


  function getPeriodStart() {
    if (period === 'max') return null
    if (period === 'custom') return customFrom || null
    const d = new Date()
    if (period === 'week')  d.setDate(d.getDate() - 7)
    if (period === 'month') d.setMonth(d.getMonth() - 1)
    if (period === 'year')  d.setFullYear(d.getFullYear() - 1)
    return d.toISOString()
  }

  async function fetchData() {
    const start = getPeriodStart()
    const end   = period === 'custom' && customTo ? customTo + 'T23:59:59' : null

    const applyDate = (q, field) => {
      if (start) q = q.gte(field, start)
      if (end)   q = q.lte(field, end)
      return q
    }

    const applyRole = (q) => {
      if (profile?.role === 'pre_vendas') return q.eq('created_by', user.id)
      if (profile?.role === 'vendedor')   return q.or(`assigned_to.eq.${user.id},created_by.eq.${user.id}`)
      return q
    }

    // busca IDs dos clientes do usuário para filtrar visitas e tarefas
    const { data: myClients } = await applyRole(supabase.from('clients').select('id'))
    const ids = (myClients || []).map(c => c.id)
    const noClients = ids.length === 0 && profile?.role !== 'gerente'

    const applyClientFilter = (q) => {
      if (profile?.role === 'gerente') return q
      if (noClients) return q.in('client_id', ['00000000-0000-0000-0000-000000000000'])
      return q.in('client_id', ids)
    }

    const [ret, v, t, cl, rv, pt] = await Promise.all([
      applyDate(applyClientFilter(supabase.from('visits').select('id', { count: 'exact' }).in('visit_outcome', ['retorno_pessoalmente', 'retorno_ligacao'])), 'visit_date'),
      applyDate(applyClientFilter(supabase.from('visits').select('id', { count: 'exact' })), 'visit_date'),
      applyClientFilter(supabase.from('tasks').select('id', { count: 'exact' }).eq('completed', false)),
      applyDate(applyRole(supabase.from('clients').select('id', { count: 'exact' }).eq('matricula_stage', 'matriculado')), 'created_at'),
      applyDate(applyClientFilter(supabase.from('visits').select('*, clients(company_name)').order('visit_date', { ascending: false }).limit(4)), 'visit_date'),
      applyClientFilter(supabase.from('tasks').select('*, clients(company_name)').eq('completed', false).order('due_date').limit(4)),
    ])
    setStats({ retornos: ret.count || 0, visits: v.count || 0, tasks: t.count || 0, closed: cl.count || 0 })
    setRecentVisits(rv.data || [])
    setPendingTasks(pt.data || [])

    // Visitas agendadas — apenas para vendedor/gerente
    if (profile?.role !== 'pre_vendas') {
      let svq = supabase
        .from('clients')
        .select('*, visits(*)')
        .eq('matricula_stage', 'nao_visitado')
        .not('visit_scheduled_at', 'is', null)
        .order('visit_scheduled_at', { ascending: true })
      if (profile?.role === 'vendedor') svq = svq.eq('assigned_to', user.id)
      const { data: sv } = await svq
      setScheduledVisits(sv || [])
    }

    setLoading(false)
  }

  function buildCalendarUrl(c) {
    const dt    = new Date(c.visit_scheduled_at)
    const dtEnd = new Date(dt.getTime() + 60 * 60 * 1000)
    const fmt   = d => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
    const title = c.company_name ? `Visita - ${c.contact_name} (${c.company_name})` : `Visita - ${c.contact_name}`
    return `https://calendar.google.com/calendar/render?action=TEMPLATE` +
      `&text=${encodeURIComponent(title)}` +
      `&dates=${fmt(dt)}/${fmt(dtEnd)}` +
      (c.city  ? `&location=${encodeURIComponent(c.city)}`  : '') +
      (c.notes ? `&details=${encodeURIComponent(c.notes)}` : '')
  }

  const firstName = profile?.name?.split(' ')[0]?.split('@')[0] || ''

  const statCards = [
    { label: 'Retornos', value: stats.retornos, icon: RotateCcw, accent: '#60A5FA', to: '/clientes' },
    { label: 'Visitas', value: stats.visits, icon: MapPin, accent: '#A78BFA', to: '/clientes' },
    { label: 'Pendentes', value: stats.tasks, icon: CheckSquare, accent: '#E8834A', to: '/tarefas' },
    { label: 'Fechados', value: stats.closed, icon: TrendingUp, accent: '#4ADE80', to: '/pipeline' },
  ]

  if (selectedCliente) return (
    <ClienteDetalhe
      client={selectedCliente}
      onBack={() => setSelectedCliente(null)}
      onUpdated={() => { setSelectedCliente(null); fetchData() }}
    />
  )

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


        {/* Seletor de periodo — dropdown */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowPeriodDrop(d => !d)}
            className="flex items-center gap-2 text-xs font-semibold rounded-xl transition-all"
            style={{
              padding: '8px 14px',
              background: '#161616',
              border: '1px solid #252525',
              color: '#C9A84C',
            }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#C9A84C', display: 'inline-block', flexShrink: 0 }} />
            {PERIOD_OPTIONS.find(p => p.key === period)?.label}
            <span style={{ color: '#6B6560', marginLeft: '2px' }}>{showPeriodDrop ? '▲' : '▼'}</span>
          </button>

          {showPeriodDrop && (
            <div className="rounded-xl overflow-hidden"
              style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 50, background: '#1A1A1A', border: '1px solid #303030', minWidth: '160px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
              {PERIOD_OPTIONS.map(p => (
                <button key={p.key}
                  onClick={() => { setPeriod(p.key); setShowPeriodDrop(false) }}
                  className="w-full text-left flex items-center gap-3 text-sm transition-all"
                  style={{
                    padding: '12px 16px',
                    color: period === p.key ? '#C9A84C' : '#EFEFEF',
                    background: period === p.key ? 'rgba(201,168,76,0.08)' : 'transparent',
                    borderBottom: '1px solid #252525',
                  }}>
                  {period === p.key && <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#C9A84C', flexShrink: 0 }} />}
                  {period !== p.key && <span style={{ width: '6px', height: '6px', flexShrink: 0 }} />}
                  {p.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {period === 'custom' && (
          <div className="flex gap-2">
            <div className="flex-1">
              <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: '#444040' }}>De</p>
              <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                className="w-full text-xs rounded-xl outline-none"
                style={{ padding: '8px 12px', background: '#161616', border: '1px solid #252525', color: '#EFEFEF' }}
                onFocus={e => e.target.style.borderColor = '#C9A84C'}
                onBlur={e => e.target.style.borderColor = '#252525'}
              />
            </div>
            <div className="flex-1">
              <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: '#444040' }}>Ate</p>
              <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                className="w-full text-xs rounded-xl outline-none"
                style={{ padding: '8px 12px', background: '#161616', border: '1px solid #252525', color: '#EFEFEF' }}
                onFocus={e => e.target.style.borderColor = '#C9A84C'}
                onBlur={e => e.target.style.borderColor = '#252525'}
              />
            </div>
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

        {/* Visitas agendadas — vendedor/gerente */}
        {profile?.role !== 'pre_vendas' && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2.5">
                <CalendarCheck size={14} style={{ color: '#4ADE80' }} />
                <span className="text-sm font-semibold" style={{ color: '#EFEFEF' }}>Visitas agendadas</span>
                {scheduledVisits.length > 0 && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(74,222,128,0.12)', color: '#4ADE80', border: '1px solid rgba(74,222,128,0.25)' }}>
                    {scheduledVisits.length}
                  </span>
                )}
              </div>
            </CardHeader>
            {scheduledVisits.length === 0 ? (
              <div className="text-center" style={{ padding: '48px 0' }}>
                <p style={{ fontSize: '2rem', marginBottom: '12px' }}>📅</p>
                <p className="text-sm" style={{ color: '#333030' }}>Nenhuma visita agendada</p>
              </div>
            ) : (
              <ul className="divide-y" style={{ borderColor: '#1C1C1C' }}>
                {scheduledVisits.map(v => {
                  const dt = new Date(v.visit_scheduled_at)
                  const isPast = dt < new Date()
                  const dateLabel = dt.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })
                  const timeLabel = dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                  return (
                    <li key={v.id} style={{ padding: '16px 20px', background: isPast ? 'rgba(232,131,74,0.03)' : 'transparent' }}>
                      <div className="flex items-start justify-between gap-3">
                        {/* Lado esquerdo — clicável para ver o cliente */}
                        <button
                          onClick={() => setSelectedCliente(v)}
                          className="flex-1 min-w-0 text-left transition-all active:opacity-70"
                        >
                          <p className="text-sm font-semibold truncate" style={{ color: '#EFEFEF' }}>
                            {v.contact_name}
                          </p>
                          {v.company_name && (
                            <p className="text-xs truncate" style={{ color: '#6B6560' }}>{v.company_name}</p>
                          )}
                          <p className="text-xs font-medium mt-1" style={{ color: isPast ? '#E8834A' : '#4ADE80' }}>
                            {dateLabel} às {timeLabel}
                            {isPast && <span style={{ marginLeft: '6px', fontSize: '10px', opacity: 0.7 }}>· já passou</span>}
                          </p>
                          <p className="text-[10px] mt-1" style={{ color: '#333030' }}>Toque para ver detalhes →</p>
                        </button>

                        {/* Lado direito */}
                        <div className="flex flex-col gap-2 flex-shrink-0 items-end">
                          {/* Botão OK — aparece quando a data já passou */}
                          {isPast && (
                            <button
                              onClick={async () => {
                                await supabase.from('clients').update({ visit_scheduled_at: null }).eq('id', v.id)
                                setScheduledVisits(sv => sv.filter(s => s.id !== v.id))
                              }}
                              className="flex items-center gap-1.5 text-xs font-bold rounded-xl transition-all active:scale-95"
                              style={{ padding: '8px 14px', background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.35)', color: '#4ADE80', cursor: 'pointer' }}>
                              ✓ OK
                            </button>
                          )}
                          {/* Botão Google Agenda — só mostra se a visita ainda não passou */}
                          {!isPast && (v.google_calendar_event_id ? (
                          <span className="flex items-center gap-1.5 flex-shrink-0 text-xs font-semibold rounded-xl"
                            style={{ padding: '8px 12px', background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.15)', color: '#4ADE80' }}>
                            <CalendarCheck size={11} /> Agendado
                          </span>
                        ) : profile?.google_refresh_token ? (
                          <button
                            disabled={syncingId === v.id}
                            onClick={async () => {
                              setSyncingId(v.id)
                              try {
                                const { data: fp } = await supabase.from('profiles').select('*').eq('id', user.id).single()
                                const token = await getValidToken(fp)
                                if (!token) { alert('Conecte o Google Agenda no Perfil primeiro.'); return }
                                const eventId = await createCalendarEvent(token, {
                                  clientName: v.contact_name || v.company_name || 'Cliente',
                                  visitDateTime: v.visit_scheduled_at,
                                })
                                await supabase.from('clients').update({ google_calendar_event_id: eventId }).eq('id', v.id)
                                setScheduledVisits(sv => sv.map(s => s.id === v.id ? { ...s, google_calendar_event_id: eventId } : s))
                              } catch (e) { alert(`Erro: ${e.message}`) }
                              finally { setSyncingId(null) }
                            }}
                            className="flex items-center gap-1.5 flex-shrink-0 text-xs font-semibold rounded-xl transition-all"
                            style={{ padding: '8px 12px', background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)', color: '#4ADE80', cursor: 'pointer' }}>
                            <Calendar size={11} />
                            {syncingId === v.id ? '...' : 'Agenda'}
                          </button>
                        ) : (
                          <a href={buildCalendarUrl(v)} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1.5 flex-shrink-0 text-xs font-semibold rounded-xl transition-all"
                            style={{ padding: '8px 12px', background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)', color: '#4ADE80', textDecoration: 'none' }}>
                            <ExternalLink size={11} /> Agenda
                          </a>
                        ))}
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>
        )}

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
            <div className="flex items-center gap-2">
              <button onClick={() => setShowTarefaForm(true)}
                className="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
                style={{ background: 'rgba(232,131,74,0.1)', border: '1px solid rgba(232,131,74,0.2)', color: '#E8834A' }}>
                <Plus size={13} />
              </button>
              <Link to="/tarefas" className="text-xs font-medium" style={{ color: '#C9A84C' }}>Ver todas</Link>
            </div>
          </CardHeader>
          {pendingTasks.length === 0 ? (
            <div className="text-center" style={{ padding: '48px 0' }}>
              <p style={{ fontSize: '2rem', marginBottom: '12px' }}>🎉</p>
              <p className="text-sm" style={{ color: '#333030' }}>Nenhuma tarefa pendente</p>
            </div>
          ) : (
            <ul className="divide-y" style={{ borderColor: '#1C1C1C' }}>
              {pendingTasks.map(t => {
                const prioColors = { alta: '#E85555', media: '#E8834A', baixa: '#4ADE80' }
                const prioColor  = prioColors[t.priority] || '#E8834A'
                return (
                  <li key={t.id} style={{ padding: '16px 20px' }} className="flex items-center justify-between gap-3">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5" style={{ background: prioColor }} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: '#EFEFEF' }}>{t.title}</p>
                        {t.clients?.company_name && (
                          <p className="text-xs mt-0.5 truncate" style={{ color: '#6B6560' }}>{t.clients.company_name}</p>
                        )}
                      </div>
                    </div>
                    {t.due_date && (
                      <Badge variant="orange">
                        {new Date(t.due_date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                      </Badge>
                    )}
                  </li>
                )
              })}
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

      {showTarefaForm && (
        <TarefaForm
          onClose={() => setShowTarefaForm(false)}
          onSaved={() => { setShowTarefaForm(false); fetchData() }}
        />
      )}

    </>
  )
}

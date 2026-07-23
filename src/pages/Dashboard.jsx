import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { MapPin, CheckSquare, TrendingUp, Plus, Calendar, CalendarCheck, ExternalLink, RotateCcw, CheckCircle2, XCircle, PhoneCall, PhoneForwarded, Clock, Trash2, Repeat } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { Card, CardHeader } from '../components/ui/Card'
import ClienteForm from '../components/ClienteForm'
import CallbackForm from '../components/CallbackForm'
import TaskQuickForm from '../components/TaskQuickForm'
import AddChooser from '../components/AddChooser'
import ClienteDetalhe from '../components/ClienteDetalhe'
import VisitConfirmationModal from '../components/VisitConfirmationModal'
import { requestNotificationPermission, scheduleTodayReminders } from '../lib/reminders'
import { initOneSignal, syncPushIfGranted } from '../lib/onesignal'
import { getValidToken, createCalendarEvent, buildEventSummary, buildEventDescription } from '../lib/googleCalendar'
import { fetchVisitsToConfirm, fetchTodayVisits, fetchPendingCount, fetchAllOpenTasks } from '../lib/visitConfirmation'
import { localDateStr, urgencyColor, taskIsRecurring, taskDoneToday, taskRecurrenceLabel } from '../lib/utils'

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
  { key: 'today',  label: 'Hoje' },
  { key: 'week',   label: 'Semana' },
  { key: 'month',  label: 'Mes' },
  { key: 'year',   label: 'Ano' },
  { key: 'custom', label: 'Personalizado' },
  { key: 'max',    label: 'Maximo' },
]

// Estilo do status de confirmação da visita (definido por quem marcou)
const CONFIRMATION_STYLES = {
  confirmada:     { label: 'Confirmada',     color: '#4ADE80', bg: 'rgba(74,222,128,0.08)',  icon: CheckCircle2 },
  nao_confirmada: { label: 'Cancelou visita', color: '#E85555', bg: 'rgba(232,85,85,0.08)',   icon: XCircle },
  tentativa:      { label: 'Tentou confirmar', color: '#A78BFA', bg: 'rgba(167,139,250,0.08)', icon: PhoneCall },
}

export default function Dashboard() {
  const { profile: authProfile, user } = useAuth()
  const navigate = useNavigate()
  const [freshProfile, setFreshProfile] = useState(authProfile)
  const profile = freshProfile
  const [stats, setStats] = useState({ retornos: 0, visits: 0, pending: 0, closed: 0, marcacoes: 0, callsToday: 0, answeredToday: 0 })
  const [recentVisits, setRecentVisits] = useState([])
  const [loading, setLoading] = useState(true)
  const [showClienteForm, setShowClienteForm]     = useState(false)
  const [showCallbackForm, setShowCallbackForm]   = useState(false)
  const [showTaskForm, setShowTaskForm]           = useState(false)
  const [tasks, setTasks]                         = useState([])
  const [showAddMenu, setShowAddMenu]             = useState(false)
  const [selectedCliente, setSelectedCliente]     = useState(null)
  const [period, setPeriod]           = useState('today') // padrão: o dia
  const [customFrom, setCustomFrom]   = useState('')
  const [customTo, setCustomTo]       = useState('')
  const [showPeriodDrop, setShowPeriodDrop] = useState(false)
  const [scheduledVisits, setScheduledVisits] = useState([])
  const [syncingId, setSyncingId] = useState(null) // id do cliente sendo sincronizado
  const [confirmVisits, setConfirmVisits] = useState([]) // p/ confirmar (hoje+amanhã, marcadas por mim)
  const [todayVisits, setTodayVisits]     = useState([]) // agenda de hoje (vendedor/gerente)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const briefingShownRef = useRef(false)

  useEffect(() => {
    setupReminders()
    // Busca perfil fresco para tokens do Google
    if (user?.id) {
      supabase.from('profiles').select('*').eq('id', user.id).single()
        .then(({ data }) => { if (data) setFreshProfile(data) })
    }
  }, [])

  useEffect(() => { if (user?.id) fetchTasks() }, [user])

  async function fetchTasks() {
    setTasks(await fetchAllOpenTasks(user.id))
  }

  // Tarefa que REPETE não some ao concluir — o ✓ dela vale só para o dia,
  // senão "ligar toda segunda" morria no primeiro ✓.
  async function toggleTask(task) {
    if (taskIsRecurring(task)) {
      const antes = task.reminder_config || {}
      const feito = taskDoneToday(task)
      const cfg = { ...antes, last_done: feito ? null : localDateStr() }
      setTasks(ts => ts.map(t => t.id === task.id ? { ...t, reminder_config: cfg } : t))
      const { error } = await supabase.from('tasks').update({ reminder_config: cfg }).eq('id', task.id)
      if (error) {
        setTasks(ts => ts.map(t => t.id === task.id ? { ...t, reminder_config: antes } : t))
        alert('Não foi possível salvar — verifique sua internet e tente de novo.')
      }
      return
    }
    const antes = tasks
    setTasks(ts => ts.filter(t => t.id !== task.id)) // otimista
    const { error } = await supabase.from('tasks').update({ completed: true }).eq('id', task.id)
    if (error) { setTasks(antes); alert('Não foi possível concluir — tente de novo.') }
  }

  async function deleteTask(id) {
    if (!confirm('Excluir esta tarefa?')) return
    const antes = tasks
    setTasks(ts => ts.filter(t => t.id !== id)) // otimista
    const { error } = await supabase.from('tasks').delete().eq('id', id)
    if (error) { setTasks(antes); alert('Não foi possível excluir — tente de novo.') }
  }

  // Pop-up = espelho da aba "Hoje". Roda uma vez, só após o profile carregar
  // (precisa do role para buscar a agenda de hoje de vendedor/gerente).
  useEffect(() => {
    if (!user?.id || !profile?.role || briefingShownRef.current) return
    briefingShownRef.current = true
    loadDayBriefing()
  }, [user, profile])

  async function loadDayBriefing() {
    const [confirm, today] = await Promise.all([
      fetchVisitsToConfirm(user.id),
      fetchTodayVisits(profile?.role, user.id),
    ])
    setConfirmVisits(confirm)
    setTodayVisits(today)
    if (confirm.length > 0 || today.length > 0) setShowConfirmModal(true)
  }


  useEffect(() => {
    if (!profile) return
    if (period === 'custom' && !customFrom) return
    fetchData()
  }, [period, customFrom, customTo, profile])

  async function setupReminders() {
    initOneSignal()
    syncPushIfGranted() // se já permitiu antes, garante o player_id salvo (silencioso)
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
    if (period === 'today') return new Date(localDateStr() + 'T00:00:00').toISOString()
    const d = new Date()
    if (period === 'week')  d.setDate(d.getDate() - 7)
    if (period === 'month') d.setMonth(d.getMonth() - 1)
    if (period === 'year')  d.setFullYear(d.getFullYear() - 1)
    return d.toISOString()
  }

  /** Dias YYYY-MM-DD cobertos pelo período — para daily_logs, que é por dia. */
  function periodDays() {
    const start = getPeriodStart()
    const from = start ? localDateStr(new Date(start)) : null
    const to = period === 'custom' && customTo ? customTo : localDateStr()
    return { from, to }
  }

  async function fetchData() {
    const start = getPeriodStart()
    const end   = period === 'custom' && customTo ? customTo + 'T23:59:59' : null

    const applyDate = (q, field) => {
      if (start) q = q.gte(field, start)
      if (end)   q = q.lte(field, end)
      return q
    }

    // O Dashboard é o resumo DA PESSOA — do gerente também. Ele era o único
    // perfil sem filtro de dono, então somava a produção da equipe inteira e
    // mostrava matrícula/visita de outra pessoa como se fosse dele. A visão
    // de equipe fica nos Relatórios (mesma regra do "gerente não age em
    // visita de outro vendedor" na aba Hoje).
    const applyRole = (q) => {
      if (profile?.role === 'pre_vendas') return q.eq('created_by', user.id)
      return q.or(`assigned_to.eq.${user.id},created_by.eq.${user.id}`)
    }

    // busca IDs dos clientes do usuário para filtrar visitas e tarefas
    const { data: myClients } = await applyRole(supabase.from('clients').select('id'))
    const ids = (myClients || []).map(c => c.id)
    const noClients = ids.length === 0

    const applyClientFilter = (q) => {
      if (noClients) return q.in('client_id', ['00000000-0000-0000-0000-000000000000'])
      return q.in('client_id', ids)
    }

    // Os cards seguem o período escolhido (padrão "Hoje") — é assim que a
    // pessoa vê no próprio Dashboard quantas ligações fez na semana ou
    // quantas marcações no mês, sem abrir os Relatórios.
    const { from: diaDe, to: diaAte } = periodDays()

    // Datas por DIA (visits.visit_date, matricula_credits.credit_date são date)
    const porDia = (q, campo) => {
      if (diaDe) q = q.gte(campo, diaDe)
      return q.lte(campo, diaAte)
    }

    // Matrículas: crédito de comissão (mesma fonte do "Produzido hoje"),
    // que vai p/ quem marcou a visita — SEMPRE só as da própria pessoa.
    const matq = porDia(supabase.from('matricula_credits').select('id', { count: 'exact' }), 'credit_date')
      .eq('credited_to', user.id)

    const [ret, v, pend, cl, rv, mc, dl] = await Promise.all([
      porDia(applyClientFilter(supabase.from('visits').select('id', { count: 'exact' }).in('visit_outcome', ['retorno_pessoalmente', 'retorno_ligacao'])), 'visit_date'),
      porDia(applyClientFilter(supabase.from('visits').select('id', { count: 'exact' })), 'visit_date'),
      // "Pendentes" ignora o período de propósito: ou está pendente AGORA, ou
      // não está — "pendências da semana passada" não existe.
      fetchPendingCount(profile?.role, user.id),
      matq,
      applyDate(applyClientFilter(supabase.from('visits').select('*, clients(company_name)').order('visit_date', { ascending: false }).limit(4)), 'visit_date'),
      // Marcações: cliente cadastrado no período JÁ com visita marcada —
      // mesma definição do "Produzido hoje", p/ os dois números baterem
      applyDate(supabase.from('clients').select('id', { count: 'exact' })
        .eq('created_by', user.id).not('visit_scheduled_at', 'is', null), 'created_at'),
      // daily_logs é uma linha por dia: no período, soma os dias
      porDia(supabase.from('daily_logs').select('calls, answered').eq('user_id', user.id), 'log_date'),
    ])
    const somaLogs = (dl.data || []).reduce((a, l) => ({
      calls: a.calls + (l.calls || 0), answered: a.answered + (l.answered || 0),
    }), { calls: 0, answered: 0 })
    setStats({
      retornos: ret.count || 0, visits: v.count || 0, pending: pend, closed: cl.count || 0,
      marcacoes: mc.count || 0, callsToday: somaLogs.calls, answeredToday: somaLogs.answered,
    })
    setRecentVisits(rv.data || [])

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
      // Dentro da janela de confirmação (hoje+amanhã), só visita TRATADA
      // (confirmada/tentativa) aparece; de depois de amanhã em diante mostra
      // normal (ainda nem entrou no pop-up de confirmação).
      const windowEnd = new Date()
      windowEnd.setDate(windowEnd.getDate() + 1)
      windowEnd.setHours(23, 59, 59, 999)
      const treated = c => c.visit_confirmation === 'confirmada' || c.visit_confirmation === 'tentativa'
      setScheduledVisits((sv || []).filter(c => new Date(c.visit_scheduled_at) > windowEnd || treated(c)))
    }

    setLoading(false)
  }

  function buildCalendarUrl(c) {
    const dt    = new Date(c.visit_scheduled_at)
    const dtEnd = new Date(dt.getTime() + 60 * 60 * 1000)
    const fmt   = d => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
    // Mesmo título/ficha do evento criado via API (quem não conectou o Google
    // cai neste link, então a descrição precisa vir igual)
    return `https://calendar.google.com/calendar/render?action=TEMPLATE` +
      `&text=${encodeURIComponent(buildEventSummary(c))}` +
      `&dates=${fmt(dt)}/${fmt(dtEnd)}` +
      (c.city ? `&location=${encodeURIComponent(c.city)}` : '') +
      `&details=${encodeURIComponent(buildEventDescription(c, c.visit_scheduled_at))}`
  }

  const firstName = profile?.name?.split(' ')[0]?.split('@')[0] || ''

  // Resumo do DIA. Pré-vendas produz ligações/atendidas e marcações;
  // vendedor/gerente, retornos e visitas. "Pendentes" (o que a aba Hoje lista
  // esperando a pessoa) vale p/ todos e substitui o antigo "A fazer".
  const statCards = profile?.role === 'pre_vendas'
    ? [
      { label: 'Ligações', value: stats.callsToday, icon: PhoneCall, accent: '#60A5FA', to: '/ligacoes' },
      { label: 'Atendidas', value: stats.answeredToday, icon: PhoneForwarded, accent: '#4ADE80', to: '/ligacoes' },
      { label: 'Marcações', value: stats.marcacoes, icon: CalendarCheck, accent: '#A78BFA', to: '/clientes' },
      { label: 'Pendentes', value: stats.pending, icon: CheckSquare, accent: '#E8834A', to: '/agenda' },
    ]
    : [
      { label: 'Retornos', value: stats.retornos, icon: RotateCcw, accent: '#60A5FA', to: '/clientes?outcome=retorno' },
      { label: 'Visitas', value: stats.visits, icon: MapPin, accent: '#A78BFA', to: '/clientes' },
      { label: 'Matrículas', value: stats.closed, icon: TrendingUp, accent: '#4ADE80', to: '/pipeline' },
      { label: 'Pendentes', value: stats.pending, icon: CheckSquare, accent: '#E8834A', to: '/agenda' },
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

        {/* Tarefas — lembretes soltos criados pelo usuário */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2.5">
              <CheckSquare size={14} style={{ color: '#22D3EE' }} />
              <span className="text-sm font-semibold" style={{ color: '#EFEFEF' }}>Tarefas</span>
              {tasks.length > 0 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(34,211,238,0.12)', color: '#22D3EE', border: '1px solid rgba(34,211,238,0.25)' }}>
                  {tasks.length}
                </span>
              )}
            </div>
            <button onClick={() => setShowTaskForm(true)}
              className="flex items-center gap-1.5 text-xs font-medium" style={{ color: '#C9A84C' }}>
              <Plus size={14} /> Nova
            </button>
          </CardHeader>
          {tasks.length === 0 ? (
            <div className="text-center" style={{ padding: '40px 0' }}>
              <p style={{ fontSize: '2rem', marginBottom: '12px' }}>✅</p>
              <p className="text-sm" style={{ color: '#333030' }}>Nenhuma tarefa pendente</p>
            </div>
          ) : (
            <ul className="divide-y" style={{ borderColor: '#1C1C1C' }}>
              {tasks.map(t => {
                const overdue = t.due_date && t.due_date < localDateStr()
                const color   = urgencyColor(t.urgency)
                const repete  = taskRecurrenceLabel(t)
                const feito   = taskDoneToday(t)
                return (
                  <li key={t.id} style={{ padding: '14px 20px', opacity: feito ? 0.5 : 1 }} className="flex items-center gap-3">
                    <button onClick={() => toggleTask(t)} title={repete ? (feito ? 'Feito hoje' : 'Marcar feito hoje') : 'Concluir'}
                      className="flex items-center justify-center rounded-full flex-shrink-0 transition-all active:scale-95"
                      style={{
                        width: '26px', height: '26px',
                        border: `2px solid ${feito ? '#4ADE80' : '#2A2A2A'}`,
                        background: feito ? 'rgba(74,222,128,0.15)' : 'transparent',
                        color: '#4ADE80', fontSize: '11px',
                      }}>
                      {feito ? '✓' : ''}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium" style={{ color: '#EFEFEF', lineHeight: 1.4, textDecoration: feito ? 'line-through' : 'none' }}>{t.title}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {typeof t.urgency === 'number' && (
                          <span className="text-[10px] font-bold rounded-full" style={{ padding: '1px 7px', background: `${color}1a`, color, border: `1px solid ${color}55` }}>
                            urgência {t.urgency}
                          </span>
                        )}
                        {repete && (
                          <span className="text-[10px] font-bold rounded-full flex items-center gap-1"
                            style={{ padding: '1px 7px', background: 'rgba(34,211,238,0.1)', color: '#22D3EE', border: '1px solid rgba(34,211,238,0.3)' }}>
                            <Repeat size={9} /> {repete}
                          </span>
                        )}
                        {(t.due_date || t.due_time) && (
                          <span className="text-[11px] flex items-center gap-1" style={{ color: overdue ? '#E85555' : '#6B6560' }}>
                            <Clock size={10} />
                            {t.due_date && `${overdue ? 'venceu ' : ''}${new Date(t.due_date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}`}
                            {t.due_date && t.due_time ? ' · ' : ''}
                            {t.due_time ? t.due_time.slice(0, 5) : ''}
                          </span>
                        )}
                      </div>
                    </div>
                    <button onClick={() => deleteTask(t.id)} title="Excluir" className="flex-shrink-0">
                      <Trash2 size={14} style={{ color: '#2A2A2A' }} />
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>

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
                  const conf = CONFIRMATION_STYLES[v.visit_confirmation]
                  return (
                    <li key={v.id} style={{ padding: '16px 20px', background: conf ? conf.bg : (isPast ? 'rgba(232,131,74,0.03)' : 'transparent'), borderLeft: conf ? `3px solid ${conf.color}` : '3px solid transparent' }}>
                      {conf && (
                        <div className="flex items-center gap-1.5 mb-2">
                          <conf.icon size={12} style={{ color: conf.color }} />
                          <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: conf.color }}>{conf.label}</span>
                        </div>
                      )}
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
                          {conf && v.visit_confirmation_note && (
                            <p className="text-[11px] mt-1.5 rounded-lg" style={{ color: conf.color, background: conf.bg, padding: '6px 8px', lineHeight: '1.4' }}>
                              "{v.visit_confirmation_note}"
                            </p>
                          )}
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
                        ) : profile?.google_connected ? (
                          <button
                            disabled={syncingId === v.id}
                            onClick={async () => {
                              setSyncingId(v.id)
                              try {
                                const token = await getValidToken(user.id)
                                if (!token) { alert('Conecte o Google Agenda no Perfil primeiro.'); return }
                                const eventId = await createCalendarEvent(token, {
                                  clientId:      v.id,
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

      </div>

      {/* FAB - Adicionar (abre o menu de 2 opções) */}
      <button
        onClick={() => setShowAddMenu(true)}
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

      {showAddMenu && (
        <AddChooser
          onClose={() => setShowAddMenu(false)}
          onNewClient={() => { setShowAddMenu(false); setShowClienteForm(true) }}
          onNewCallback={() => { setShowAddMenu(false); setShowCallbackForm(true) }}
          onNewTask={() => { setShowAddMenu(false); setShowTaskForm(true) }}
        />
      )}

      {showTaskForm && (
        <TaskQuickForm
          onClose={() => setShowTaskForm(false)}
          onSaved={() => { setShowTaskForm(false); fetchTasks() }}
        />
      )}

      {showClienteForm && (
        <ClienteForm
          onClose={() => setShowClienteForm(false)}
          onSaved={() => { setShowClienteForm(false); fetchData() }}
        />
      )}

      {showCallbackForm && (
        <CallbackForm
          onClose={() => setShowCallbackForm(false)}
          onSaved={() => { setShowCallbackForm(false); fetchData() }}
        />
      )}

      {showConfirmModal && (confirmVisits.length > 0 || todayVisits.length > 0) && (
        <VisitConfirmationModal
          visits={confirmVisits}
          todayVisits={todayVisits}
          onClose={() => setShowConfirmModal(false)}
          onConfirmed={fetchData}
          onOpenAgenda={() => { setShowConfirmModal(false); navigate('/agenda') }}
        />
      )}

    </>
  )
}

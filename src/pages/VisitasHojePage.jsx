import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { MapPin, Clock, User, Phone, PhoneCall, PhoneForwarded, Star, AlertTriangle, Bell, CalendarPlus, Handshake, GraduationCap, Pencil } from 'lucide-react'
import ClienteDetalhe from '../components/ClienteDetalhe'
import CallbackForm from '../components/CallbackForm'
import { STAGE_BADGES } from '../components/ui/Badge'
import VisitConfirmationList from '../components/VisitConfirmationList'
import {
  fetchVisitsToConfirm, fetchVisitsForDay, fetchCallbacksForDay,
  fetchAnsweredVisitsForDay, fetchUpcomingReminders, fetchTodayFeedbacks,
  fetchOpenTasks, fetchTodayCallbacks, getDayRange, daysAheadWindow,
} from '../lib/visitConfirmation'
import { updateClientStage } from '../lib/clientStage'
import { localDateStr, allPhones, urgencyColor } from '../lib/utils'
import { useRatingsGate } from '../contexts/RatingsGateContext'

// Botões de resultado da visita (mudam o estágio automaticamente ao clicar)
const STAGE_ACTIONS = [
  { key: 'recebeu_visita', label: 'Recebida',      color: '#A78BFA' },
  { key: 'matriculado',    label: 'Matriculada',   color: '#4ADE80' },
  { key: 'nao_apareceu',   label: 'Não apareceu',  color: '#E85555' },
  { key: 'cancelado',      label: 'Cancelada',     color: '#F97316' },
]

function timeOf(ts) {
  return new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

// Labels do feedback (estrela) preenchido pelo vendedor
const FEEDBACK_OUTCOMES = {
  matriculada: 'Matriculada 🎉', grandes_chances: 'Grandes chances', chance_futura: 'Chance futura',
  sem_chance: 'Sem chance', retorno_pessoalmente: 'Retorno pessoal', retorno_ligacao: 'Retorno por ligação', remarcar: 'Remarcar',
}
const RATING_LABELS = { pessima: 'Péssima', razoavel: 'Razoável', boa: 'Boa', otima: 'Ótima' }

function reminderLabel(daysUntil, ts) {
  if (daysUntil === 0) return 'Hoje'
  if (daysUntil === 1) return 'Amanhã'
  return new Date(ts).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }).replace('.', '')
}

function SectionLabel({ children, color = '#6B6560' }) {
  return (
    <p className="text-[11px] font-bold uppercase tracking-[0.15em]" style={{ color }}>{children}</p>
  )
}

// Status de confirmação (feito por quem marcou a visita) — exibido na agenda.
// 'nao_confirmada' não é exibido: essas visitas são filtradas da lista.
const CONFIRM_DISPLAY = {
  confirmada: { label: 'Confirmada',       color: '#4ADE80', icon: '✓' },
  tentativa:  { label: 'Tentou confirmar', color: '#A78BFA', icon: '☎' },
}

function ConfirmStrip({ status, note }) {
  const c = CONFIRM_DISPLAY[status]
  if (!c) return null
  return (
    <div className="rounded-xl" style={{ background: `${c.color}14`, border: `1px solid ${c.color}40`, padding: '8px 10px' }}>
      <p className="text-[11px] font-bold flex items-center gap-1.5" style={{ color: c.color }}>
        <span>{c.icon}</span> {c.label}
      </p>
      {status === 'tentativa' && note && (
        <p className="text-[11px] mt-1" style={{ color: '#B0A99F', lineHeight: 1.4 }}>"{note}"</p>
      )}
    </div>
  )
}

// Card compacto (prévia) — usado em ligações e nas coisas de amanhã
function CompactCard({ time, tag, tagColor, name, company, sub, isPast, onClick, confirmStatus, confirmNote }) {
  return (
    <button onClick={onClick} className="w-full text-left rounded-2xl transition-all active:scale-[0.98]"
      style={{ background: '#161616', border: '1px solid #252525', padding: '13px 15px', opacity: isPast ? 0.6 : 1 }}>
      <div className="flex items-center gap-2 mb-1">
        {time && <span className="text-xs font-bold tabular-nums" style={{ color: tagColor }}>{time}</span>}
        <span className="text-[9px] font-bold uppercase tracking-wide rounded-full px-2 py-0.5"
          style={{ background: `${tagColor}1a`, color: tagColor }}>{tag}</span>
      </div>
      <p className="text-sm font-semibold truncate" style={{ color: '#EFEFEF' }}>{name}</p>
      {company && <p className="text-xs truncate" style={{ color: '#6B6560' }}>{company}</p>}
      {sub && <p className="text-[11px] mt-1 flex items-center gap-1 truncate" style={{ color: '#444040' }}>{sub}</p>}
      {confirmStatus && <div className="mt-2"><ConfirmStrip status={confirmStatus} note={confirmNote} /></div>}
    </button>
  )
}

// Status respondido pelo pré-vendas (as 3 opções, cada uma numa cor)
const ANSWERED_DISPLAY = {
  confirmada:     { label: 'Confirmada',       color: '#4ADE80' },
  nao_confirmada: { label: 'Não confirmada',   color: '#E85555' },
  tentativa:      { label: 'Tentou confirmar', color: '#A78BFA' },
}

// Card das visitas de hoje que o pré-vendas já respondeu no pop-up
function AnsweredCard({ client, onClick }) {
  const c = ANSWERED_DISPLAY[client.visit_confirmation]
  if (!c) return null
  return (
    <button onClick={onClick} className="w-full text-left rounded-2xl transition-all active:scale-[0.98]"
      style={{ background: '#161616', border: '1px solid #252525', borderLeft: `3px solid ${c.color}`, padding: '14px 16px' }}>
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-xs font-bold tabular-nums" style={{ color: c.color }}>🕐 {timeOf(client.visit_scheduled_at)}</span>
        <span className="text-[10px] font-bold uppercase tracking-wide rounded-full px-2 py-0.5"
          style={{ background: `${c.color}1a`, color: c.color, border: `1px solid ${c.color}40` }}>{c.label}</span>
      </div>
      <p className="text-sm font-semibold truncate" style={{ color: '#EFEFEF' }}>{client.contact_name}</p>
      {client.company_name && <p className="text-xs truncate" style={{ color: '#6B6560' }}>{client.company_name}</p>}
      {client.visit_confirmation !== 'confirmada' && client.visit_confirmation_note && (
        <p className="text-[11px] mt-1.5" style={{ color: '#B0A99F', lineHeight: 1.4 }}>"{client.visit_confirmation_note}"</p>
      )}
    </button>
  )
}

export default function VisitasHojePage() {
  const { profile, user } = useAuth()
  const [profilesMap, setProfilesMap]   = useState({})
  const [loading, setLoading]           = useState(true)
  const [selected, setSelected]         = useState(null)
  const [editingCallback, setEditingCallback] = useState(null)
  const [toConfirm, setToConfirm]       = useState([])
  const [confirmHidden, setConfirmHidden] = useState(false)
  const [todayVisits, setTodayVisits]   = useState([])
  const [todayCalls, setTodayCalls]     = useState([])
  const [tomVisits, setTomVisits]       = useState([])
  const [tomCalls, setTomCalls]         = useState([])
  const { pending: pendingRatings, loading: gateLoading, refresh: refreshGate } = useRatingsGate()
  const [answeredToday, setAnsweredToday]   = useState([]) // pré-vendas: visitas de hoje já respondidas
  const [reminders, setReminders]           = useState([]) // lembretes chegando (≤3 dias)
  const [feedbacks, setFeedbacks]           = useState([]) // estrelas preenchidas hoje (visitas que marquei)
  const [tasks, setTasks]                   = useState([]) // "A fazer": tarefas/follow-ups em aberto
  const [callbacks, setCallbacks]           = useState([]) // "pediu p/ ligar depois" que caem hoje
  const [view, setView]                     = useState('lembretes') // 'lembretes' | 'produzido'
  const [profilesList, setProfilesList]     = useState([])          // p/ seletor do gerente
  const [prodPerson, setProdPerson]         = useState(null)        // de quem ver a produção (gerente)
  const [prodDate, setProdDate]             = useState(localDateStr()) // dia do "produzido" (calendário)
  const [prod, setProd]                     = useState(null)        // { marcacoes, visitas, matriculas } | null = carregando

  const today    = getDayRange(0)
  const tomorrow = getDayRange(1)
  const isVisitor = profile?.role === 'vendedor' || profile?.role === 'gerente'

  useEffect(() => { fetchData() }, [profile])

  async function fetchData() {
    if (!user?.id) return
    const role = profile?.role

    const [confirm, tv, tc, mv, mc, rem, tsk, cbs] = await Promise.all([
      fetchVisitsToConfirm(user.id),
      fetchVisitsForDay(role, user.id, 0),
      fetchCallbacksForDay(role, user.id, 0),
      fetchVisitsForDay(role, user.id, 1),
      fetchCallbacksForDay(role, user.id, 1),
      fetchUpcomingReminders(user.id, daysAheadWindow()), // sexta alcança segunda
      fetchOpenTasks(user.id),
      fetchTodayCallbacks(user.id),
    ])
    setReminders(rem)
    setTasks(tsk)
    setCallbacks(cbs)
    // fetchVisitsForDay já traz só visitas TRATADAS (confirmada/tentativa) —
    // sem resposta ou "não confirmada" não aparecem na agenda
    setToConfirm(confirm)
    setConfirmHidden(false)
    setTodayVisits(tv)
    setTodayCalls(tc)
    setTomVisits(mv)
    setTomCalls(mc)

    if (isVisitor) {
      const { data: profs } = await supabase.from('profiles').select('id, name, role')
      setProfilesMap(Object.fromEntries((profs || []).map(p => [p.id, p])))
      setProfilesList((profs || []).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR')))
    } else {
      // Pré-vendas: visitas de hoje que ele já respondeu no pop-up (coloridas)
      // + estrelas preenchidas hoje pelas visitas que ele marcou (aviso)
      const [answered, fb] = await Promise.all([
        fetchAnsweredVisitsForDay(user.id, 0),
        fetchTodayFeedbacks(user.id),
      ])
      setAnsweredToday(answered)
      setFeedbacks(fb)
    }

    setLoading(false)
  }

  // ── Produzido hoje ──────────────────────────────────────────────
  // Marcações (clientes novos com visita, criados hoje pela pessoa),
  // visitas feitas (estágio → recebeu_visita/matriculado dado hoje por ela)
  // e matrículas (créditos de comissão do dia — quem marcou a visita atual).
  const personId = prodPerson || user?.id

  useEffect(() => {
    if (view === 'produzido' && personId) fetchProduzido(personId, prodDate)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, personId, prodDate])

  async function fetchProduzido(pid, dateStr = localDateStr()) {
    setProd(null)
    const start = new Date(dateStr + 'T00:00:00').toISOString()
    const end   = new Date(dateStr + 'T23:59:59.999').toISOString()
    const todayLocal = dateStr
    const [marc, hist, mats, dlog, cbt] = await Promise.all([
      supabase.from('clients').select('*')
        .eq('created_by', pid)
        .not('visit_scheduled_at', 'is', null)
        .gte('created_at', start).lte('created_at', end)
        .order('created_at', { ascending: true }),
      supabase.from('client_history').select('*, clients(*)')
        .eq('user_id', pid)
        .eq('event_type', 'stage_change')
        .gte('created_at', start).lte('created_at', end)
        .order('created_at', { ascending: true }),
      supabase.from('matricula_credits').select('*, clients(*)')
        .eq('credited_to', pid)
        .eq('credit_date', todayLocal),
      // ligações do dia (aba Ligações) — usadas no resumo do pré-vendas
      supabase.from('daily_logs').select('calls, answered').eq('user_id', pid).eq('log_date', todayLocal).maybeSingle(),
      // "pediu p/ ligar depois" registrados hoje pela pessoa
      supabase.from('callbacks').select('*').eq('created_by', pid)
        .gte('created_at', start).lte('created_at', end)
        .order('created_at', { ascending: true }),
    ])
    // visitas feitas: 1 por cliente, estágio final recebeu_visita/matriculado
    const visitas = []
    const seen = new Set()
    for (const h of hist.data || []) {
      const to = h.event_data?.to
      if ((to === 'recebeu_visita' || to === 'matriculado') && h.clients && !seen.has(h.client_id)) {
        seen.add(h.client_id)
        visitas.push(h)
      }
    }
    setProd({
      marcacoes: marc.data || [], visitas, matriculas: mats.data || [],
      calls: dlog.data?.calls || 0, answered: dlog.data?.answered || 0,
      callbacksToday: cbt.data || [],
    })
  }

  // Concluir uma tarefa/follow-up direto da aba Hoje
  async function completeTask(taskId) {
    setTasks(ts => ts.filter(t => t.id !== taskId)) // otimista
    await supabase.from('tasks').update({ completed: true }).eq('id', taskId)
  }

  // Marcar um "pediu p/ ligar depois" como concluído (some do Hoje)
  async function completeCallback(id) {
    setCallbacks(cs => cs.filter(c => c.id !== id)) // otimista
    await supabase.from('callbacks').update({ done: true }).eq('id', id)
  }

  // Clicou num botão de resultado → muda o estágio automaticamente (otimista)
  async function handleStageChange(visit, newStage) {
    const oldStage = visit.matricula_stage
    if (oldStage === newStage) return
    setTodayVisits(vs => vs.map(x => x.id === visit.id ? { ...x, matricula_stage: newStage } : x))
    const { error } = await updateClientStage({ client: visit, newStage, oldStage, userId: user.id, userName: profile?.name })
    // Falhou a gravação → desfaz na tela e avisa, senão o botão mostrava um
    // estágio que o banco nunca recebeu
    if (error) {
      setTodayVisits(vs => vs.map(x => x.id === visit.id ? { ...x, matricula_stage: oldStage } : x))
      alert('Não foi possível salvar — verifique sua internet e tente de novo.')
    }
  }

  if (selected) return (
    <ClienteDetalhe
      client={selected}
      onBack={() => { setSelected(null); refreshGate(); fetchData() }}
      onUpdated={() => { setSelected(null); refreshGate(); fetchData() }}
    />
  )

  // 🔒 Bloqueio: com visitas pendentes, o app inteiro trava aqui até avaliar
  if (!gateLoading && isVisitor && pendingRatings.length > 0) {
    const total = pendingRatings.reduce((s, c) => s + c.pendingCount, 0)
    return (
      <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div className="rounded-2xl" style={{ background: 'rgba(232,131,74,0.08)', border: '1px solid rgba(232,131,74,0.3)', padding: '20px' }}>
          <div className="flex items-center gap-2.5 mb-2">
            <AlertTriangle size={18} style={{ color: '#E8834A' }} />
            <h1 className="text-lg font-bold" style={{ color: '#EFEFEF' }}>Avalie suas visitas</h1>
          </div>
          <p className="text-sm" style={{ color: '#B0A99F', lineHeight: 1.5 }}>
            Você tem <b style={{ color: '#E8834A' }}>{total} {total === 1 ? 'visita realizada' : 'visitas realizadas'}</b> sem avaliação completa.
            Preencha a <b>estrela</b> (nota, resultado, possibilidade e anotações) de cada uma para liberar o acesso ao app.
          </p>
        </div>

        <p className="text-[11px] font-bold uppercase tracking-[0.15em]" style={{ color: '#6B6560' }}>Pendentes de avaliação</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {pendingRatings.map(c => (
            <button key={c.id} onClick={() => setSelected(c)}
              className="w-full text-left rounded-2xl transition-all active:scale-[0.98]"
              style={{ background: '#161616', border: '1px solid #303030', padding: '16px' }}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: '#EFEFEF' }}>{c.contact_name}</p>
                  {c.company_name && <p className="text-xs truncate" style={{ color: '#6B6560' }}>{c.company_name}</p>}
                  <p className="text-[11px] mt-1.5 flex items-center gap-1.5" style={{ color: '#E8834A' }}>
                    <Clock size={11} /> visita de {new Date(c.oldestDate + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                    {c.pendingCount > 1 && <span style={{ color: '#6B6560' }}>· {c.pendingCount} pendentes</span>}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0 rounded-xl" style={{ padding: '8px 12px', background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.3)', color: '#C9A84C' }}>
                  <Star size={14} /> <span className="text-xs font-bold">Avaliar</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    )
  }

  const showConfirm  = !confirmHidden && toConfirm.length > 0
  const hasTomorrow  = tomVisits.length > 0 || tomCalls.length > 0
  const nothingToday = !showConfirm && todayVisits.length === 0 && todayCalls.length === 0 && answeredToday.length === 0 && reminders.length === 0 && feedbacks.length === 0 && tasks.length === 0 && callbacks.length === 0

  return (
    <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>

      {/* Header */}
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.15em] mb-1 capitalize" style={{ color: '#C9A84C' }}>
          {today.label}
        </p>
        <h1 style={{ color: '#EFEFEF' }}>{isVisitor ? 'Visitas de Hoje' : 'Sua agenda'}</h1>
      </div>

      {/* Seletor: Lembretes | Produzido hoje */}
      <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid #252525' }}>
        {[['lembretes', 'Lembretes'], ['produzido', 'Produzido hoje']].map(([v, label], i) => (
          <button key={v} onClick={() => setView(v)}
            className="flex-1 py-2.5 text-xs font-bold transition-all"
            style={{
              background: view === v ? 'rgba(201,168,76,0.14)' : '#111',
              color: view === v ? '#C9A84C' : '#6B6560',
              borderRight: i === 0 ? '1px solid #252525' : 'none',
            }}>
            {label}
          </button>
        ))}
      </div>

      {view === 'lembretes' && (<>

      {/* Confirmar visitas (hoje + amanhã) — destaque dourado */}
      {!loading && showConfirm && (
        <div className="rounded-2xl" style={{ background: '#15140F', border: '1px solid rgba(201,168,76,0.22)', padding: '16px' }}>
          <SectionLabel color="#C9A84C">Confirmar visitas</SectionLabel>
          <p className="text-xs mt-1 mb-4" style={{ color: '#6B6560' }}>
            {toConfirm.length} {toConfirm.length === 1 ? 'visita marcada' : 'visitas marcadas'} por você até o próximo dia útil.
          </p>
          <VisitConfirmationList visits={toConfirm} onEmpty={() => setConfirmHidden(true)} />
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center" style={{ paddingTop: '60px' }}>
          <div className="w-7 h-7 rounded-full border-2 animate-spin" style={{ borderColor: '#C9A84C', borderTopColor: 'transparent' }} />
        </div>
      )}

      {/* Pré-vendas: visitas de hoje já respondidas no pop-up (coloridas por status) */}
      {!loading && !isVisitor && answeredToday.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <SectionLabel>Visitas de hoje</SectionLabel>
          {answeredToday.map(c => (
            <AnsweredCard key={c.id} client={c} onClick={() => setSelected(c)} />
          ))}
        </div>
      )}

      {/* Visitas de hoje — vendedor/gerente, com botões de resultado */}
      {!loading && isVisitor && todayVisits.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <SectionLabel>Visitas de hoje</SectionLabel>
          {todayVisits.map(v => {
            const isPast      = new Date(v.visit_scheduled_at) < new Date()
            const creator     = profilesMap[v.created_by]
            const byPreVendas = creator?.role === 'pre_vendas'
            const creatorName = creator?.name?.split(' ')[0] || '—'
            return (
              <div key={v.id} style={{ background: '#161616', border: `1px solid ${isPast ? '#252525' : '#303030'}`, borderRadius: '18px', padding: '18px 20px' }}>
                <button onClick={() => setSelected(v)} className="w-full text-left transition-all active:opacity-70">
                  <div className="flex items-center justify-between" style={{ marginBottom: '10px' }}>
                    <div className="flex items-center gap-2">
                      <Clock size={13} style={{ color: isPast ? '#E8834A' : '#4ADE80' }} />
                      <span className="text-sm font-bold tabular-nums" style={{ color: isPast ? '#E8834A' : '#4ADE80' }}>{timeOf(v.visit_scheduled_at)}</span>
                      {isPast && <span className="text-[10px] font-semibold rounded-full" style={{ padding: '2px 8px', background: 'rgba(232,131,74,0.1)', color: '#E8834A', border: '1px solid rgba(232,131,74,0.2)' }}>já passou</span>}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <User size={11} style={{ color: byPreVendas ? '#60A5FA' : '#6B6560' }} />
                      <span className="text-[11px] font-semibold" style={{ color: byPreVendas ? '#60A5FA' : '#6B6560' }}>
                        {byPreVendas ? `Pré-vendas · ${creatorName}` : 'Você'}
                      </span>
                    </div>
                  </div>
                  {CONFIRM_DISPLAY[v.visit_confirmation] && (
                    <div className="mb-2.5"><ConfirmStrip status={v.visit_confirmation} note={v.visit_confirmation_note} /></div>
                  )}
                  <p className="text-base font-semibold" style={{ color: '#EFEFEF', marginBottom: '2px' }}>{v.contact_name}</p>
                  {v.company_name && <p className="text-sm" style={{ color: '#6B6560', marginBottom: '8px' }}>{v.company_name}</p>}
                  <div className="flex items-center justify-between gap-2" style={{ marginTop: '8px' }}>
                    {(v.city || v.address_street) && (
                      <div className="flex items-center gap-1.5 min-w-0">
                        <MapPin size={11} style={{ color: '#444040', flexShrink: 0 }} />
                        <span className="text-xs truncate" style={{ color: '#444040' }}>
                          {[v.address_street, v.address_neighborhood, v.city].filter(Boolean).join(', ')}
                        </span>
                      </div>
                    )}
                    <div className="flex-shrink-0">{STAGE_BADGES[v.matricula_stage] || null}</div>
                  </div>
                  <p className="text-[11px] mt-3" style={{ color: '#2A2A2A' }}>Toque para abrir o cliente →</p>
                </button>

                {/* Resultado da visita — muda o estágio automaticamente */}
                <div className="mt-3 pt-3" style={{ borderTop: '1px solid #1F1F1F' }}>
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] mb-2" style={{ color: '#444040' }}>Resultado da visita</p>
                  <div className="grid grid-cols-2 gap-2">
                    {STAGE_ACTIONS.map(a => {
                      const active = v.matricula_stage === a.key
                      return (
                        <button key={a.key} onClick={() => handleStageChange(v, a.key)}
                          className="text-[11px] font-bold rounded-xl py-2.5 transition-all active:scale-95"
                          style={active
                            ? { background: a.color, color: '#0A0A0A', border: `1px solid ${a.color}` }
                            : { background: `${a.color}1a`, color: a.color, border: `1px solid ${a.color}55` }}>
                          {active ? '✓ ' : ''}{a.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Ligações de hoje — todos os perfis */}
      {!loading && todayCalls.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <SectionLabel color="#E8834A">📞 Ligações de hoje</SectionLabel>
          {todayCalls.map(c => (
            <CompactCard key={c.id}
              time={timeOf(c.call_back_at)}
              tag="Ligar" tagColor="#E8834A"
              name={c.contact_name} company={c.company_name}
              sub={c.phone ? <><Phone size={10} /> {allPhones(c).map(p => p.n).join(' · ')}</> : null}
              isPast={new Date(c.call_back_at) < new Date()}
              onClick={() => setSelected(c)}
            />
          ))}
        </div>
      )}

      {/* Lembretes chegando (≤3 dias) — clientes que a pessoa marcou p/ lembrar */}
      {!loading && reminders.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <SectionLabel color="#22D3EE"><span className="inline-flex items-center gap-1.5"><Bell size={12} /> Lembretes</span></SectionLabel>
          {reminders.map(c => (
            <CompactCard key={c.id}
              time={reminderLabel(c.daysUntil, c.reminderDate)}
              tag="Lembrete" tagColor="#22D3EE"
              name={c.contact_name} company={c.company_name}
              sub={c.phone ? <><Phone size={10} /> {allPhones(c).map(p => p.n).join(' · ')}</> : null}
              onClick={() => setSelected(c)}
            />
          ))}
        </div>
      )}

      {/* Ligar depois — clientes que pediram retorno (fora da lista de clientes) */}
      {!loading && callbacks.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <SectionLabel color="#E8834A"><span className="inline-flex items-center gap-1.5"><Phone size={12} /> Ligar depois</span></SectionLabel>
          {callbacks.map(c => (
            /* Nome/telefone ligam; a descrição e o lápis abrem a edição — assim
               não precisa caçar o contato no Produzido hoje pra corrigir algo */
            <div key={c.id} className="rounded-2xl"
              style={{ background: '#161616', border: '1px solid #252525', borderLeft: '3px solid #E8834A', padding: '14px 16px' }}>
              <div className="flex items-center gap-3">
                <a href={`tel:${c.phone}`} className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold truncate" style={{ color: '#EFEFEF' }}>{c.contact_name}</p>
                    {c.reminder_config?.time && (
                      <span className="text-[10px] font-bold rounded-full flex-shrink-0 flex items-center gap-1"
                        style={{ padding: '2px 8px', background: 'rgba(232,131,74,0.12)', border: '1px solid rgba(232,131,74,0.3)', color: '#E8834A' }}>
                        <Clock size={9} /> {c.reminder_config.time}
                      </span>
                    )}
                  </div>
                  {(c.company_name || c.contact_role) && (
                    <p className="text-xs truncate" style={{ color: '#6B6560' }}>{[c.company_name, c.contact_role].filter(Boolean).join(' · ')}</p>
                  )}
                  <p className="text-[11px] mt-0.5 flex items-center gap-1" style={{ color: '#E8834A' }}><Phone size={10} /> {allPhones(c).map(p => p.n).join(' · ')}</p>
                </a>
                <button onClick={() => setEditingCallback(c)} title="Editar contato"
                  className="flex items-center justify-center rounded-xl flex-shrink-0 transition-all active:scale-95"
                  style={{ width: '38px', height: '38px', background: 'rgba(232,131,74,0.08)', border: '1px solid rgba(232,131,74,0.22)', color: '#E8834A' }}>
                  <Pencil size={14} />
                </button>
                <button onClick={() => completeCallback(c.id)} title="Já liguei"
                  className="flex items-center justify-center rounded-xl flex-shrink-0 transition-all active:scale-95"
                  style={{ width: '38px', height: '38px', background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.3)', color: '#4ADE80' }}>
                  ✓
                </button>
              </div>
              {c.notes && (
                <button onClick={() => setEditingCallback(c)} className="w-full text-left">
                  <p className="text-[11px] mt-1.5" style={{ color: '#B0A99F', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{c.notes}</p>
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* A fazer — tarefas/follow-ups em aberto (substitui a aba Tarefas) */}
      {!loading && tasks.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <SectionLabel color="#E8834A"><span className="inline-flex items-center gap-1.5">✓ A fazer</span></SectionLabel>
          {tasks.map(t => {
            const overdue = t.due_date && t.due_date < localDateStr()
            const uColor  = urgencyColor(t.urgency)
            return (
              <div key={t.id} className="rounded-2xl flex items-center gap-3"
                style={{ background: '#161616', border: `1px solid ${overdue ? 'rgba(232,85,85,0.3)' : '#252525'}`, borderLeft: '3px solid #E8834A', padding: '14px 16px' }}>
                <button onClick={() => t.clients && setSelected(t.clients)} className="flex-1 min-w-0 text-left">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold truncate" style={{ color: '#EFEFEF' }}>{t.title}</p>
                    {typeof t.urgency === 'number' && (
                      <span className="text-[10px] font-bold rounded-full flex-shrink-0" style={{ padding: '1px 7px', background: `${uColor}1a`, color: uColor, border: `1px solid ${uColor}55` }}>
                        {t.urgency}
                      </span>
                    )}
                  </div>
                  {(t.clients?.contact_name || t.clients?.company_name) && (
                    <p className="text-xs truncate" style={{ color: '#6B6560' }}>{t.clients.contact_name || t.clients.company_name}</p>
                  )}
                  {t.due_date && (
                    <p className="text-[11px] mt-0.5" style={{ color: overdue ? '#E85555' : '#6B6560' }}>
                      {overdue ? '⚠ venceu ' : 'até '}{new Date(t.due_date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                      {t.due_time ? ` · ${t.due_time.slice(0, 5)}` : ''}
                    </p>
                  )}
                </button>
                <button onClick={() => completeTask(t.id)} title="Concluir"
                  className="flex items-center justify-center rounded-xl flex-shrink-0 transition-all active:scale-95"
                  style={{ width: '38px', height: '38px', background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.3)', color: '#4ADE80' }}>
                  ✓
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Pré-vendas: estrelas preenchidas hoje nas visitas que ele marcou (aviso) */}
      {!loading && !isVisitor && feedbacks.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <SectionLabel color="#F472B6"><span className="inline-flex items-center gap-1.5"><Star size={12} /> Feedbacks de visitas</span></SectionLabel>
          <p className="text-xs -mt-1" style={{ color: '#6B6560' }}>
            O vendedor preencheu a avaliação — toque para ver como foi a visita.
          </p>
          {feedbacks.map(v => (
            <CompactCard key={v.id}
              time={timeOf(v.rated_at)}
              tag="Feedback" tagColor="#F472B6"
              name={v.clients?.contact_name} company={v.clients?.company_name}
              sub={<>
                ⭐ {FEEDBACK_OUTCOMES[v.visit_outcome] || v.visit_outcome || '—'}
                {v.rating ? ` · nota ${RATING_LABELS[v.rating] || v.rating}` : ''}
              </>}
              onClick={() => v.clients && setSelected(v.clients)}
            />
          ))}
        </div>
      )}

      {/* Estado vazio do dia */}
      {!loading && nothingToday && !hasTomorrow && (
        <div className="flex flex-col items-center justify-center" style={{ paddingTop: '50px', gap: '12px' }}>
          <p style={{ fontSize: '3rem' }}>{isVisitor ? '📅' : '✅'}</p>
          <p className="text-sm font-medium" style={{ color: '#333030' }}>
            {isVisitor ? 'Dia livre de visitas e ligações!' : 'Nada para hoje'}
          </p>
        </div>
      )}

      {/* ── AMANHÃ ── prévia do dia seguinte */}
      {!loading && hasTomorrow && (
        <>
          <div className="flex items-center gap-3" style={{ marginTop: '6px' }}>
            <div style={{ height: '1px', background: '#1F1F1F', flex: 1 }} />
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] capitalize" style={{ color: '#C9A84C' }}>
              Amanhã · {tomorrow.label.replace(/-feira/, '')}
            </span>
            <div style={{ height: '1px', background: '#1F1F1F', flex: 1 }} />
          </div>

          {tomVisits.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <SectionLabel>Visitas de amanhã</SectionLabel>
              {tomVisits.map(v => (
                <CompactCard key={v.id}
                  time={timeOf(v.visit_scheduled_at)}
                  tag="Visita" tagColor="#A78BFA"
                  name={v.contact_name} company={v.company_name}
                  sub={(v.city || v.address_street) ? <><MapPin size={10} /> {[v.address_street, v.address_neighborhood, v.city].filter(Boolean).join(', ')}</> : null}
                  confirmStatus={v.visit_confirmation} confirmNote={v.visit_confirmation_note}
                  onClick={() => setSelected(v)}
                />
              ))}
            </div>
          )}

          {tomCalls.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <SectionLabel color="#E8834A">Ligações de amanhã</SectionLabel>
              {tomCalls.map(c => (
                <CompactCard key={c.id}
                  time={timeOf(c.call_back_at)}
                  tag="Ligar" tagColor="#E8834A"
                  name={c.contact_name} company={c.company_name}
                  sub={c.phone ? <><Phone size={10} /> {allPhones(c).map(p => p.n).join(' · ')}</> : null}
                  onClick={() => setSelected(c)}
                />
              ))}
            </div>
          )}
        </>
      )}

      </>)}

      {/* ── PRODUZIDO HOJE ── */}
      {view === 'produzido' && (
        <>
          {/* Gerente: escolher de quem ver a produção */}
          {profile?.role === 'gerente' && profilesList.length > 0 && (
            <div className="flex flex-wrap" style={{ gap: '6px' }}>
              {profilesList.map(p => {
                const active = p.id === personId
                return (
                  <button key={p.id} onClick={() => setProdPerson(p.id)}
                    className="text-xs font-semibold rounded-full transition-all"
                    style={{
                      padding: '6px 13px',
                      background: active ? 'rgba(201,168,76,0.14)' : '#161616',
                      border: `1px solid ${active ? 'rgba(201,168,76,0.45)' : '#2A2A2A'}`,
                      color: active ? '#C9A84C' : '#6B6560',
                    }}>
                    {active ? '✓ ' : ''}{p.name?.split(' ')[0] || '—'}{p.id === user?.id ? ' (você)' : ''}
                  </button>
                )
              })}
            </div>
          )}

          {/* Calendário: navegar entre dias */}
          {(() => {
            const shiftDay = (n) => {
              const d = new Date(prodDate + 'T12:00:00'); d.setDate(d.getDate() + n); setProdDate(localDateStr(d))
            }
            const isToday = prodDate === localDateStr()
            const label = new Date(prodDate + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'long' }).replace('.', '')
            return (
              <div>
                <div className="flex items-center gap-2">
                  <button onClick={() => shiftDay(-1)} className="flex items-center justify-center rounded-xl flex-shrink-0 active:scale-95"
                    style={{ width: '38px', height: '38px', background: '#161616', border: '1px solid #252525', color: '#6B6560' }}>‹</button>
                  <div className="flex-1 relative">
                    <input type="date" value={prodDate} max={localDateStr()}
                      onChange={e => { if (e.target.value) setProdDate(e.target.value) }}
                      className="w-full text-center text-sm font-semibold outline-none rounded-xl"
                      style={{ padding: '9px 12px', background: '#161616', border: `1px solid ${isToday ? 'rgba(201,168,76,0.35)' : '#252525'}`, color: isToday ? '#C9A84C' : '#EFEFEF' }} />
                  </div>
                  <button onClick={() => shiftDay(1)} disabled={isToday}
                    className="flex items-center justify-center rounded-xl flex-shrink-0 active:scale-95 disabled:opacity-30"
                    style={{ width: '38px', height: '38px', background: '#161616', border: '1px solid #252525', color: '#6B6560' }}>›</button>
                </div>
                <p className="text-xs capitalize mt-1.5" style={{ color: '#6B6560' }}>{label}{isToday ? ' · hoje' : ''}</p>
              </div>
            )
          })()}

          {prod === null ? (
            <div className="flex items-center justify-center" style={{ paddingTop: '60px' }}>
              <div className="w-7 h-7 rounded-full border-2 animate-spin" style={{ borderColor: '#C9A84C', borderTopColor: 'transparent' }} />
            </div>
          ) : (
            <>
              {/* Resumo do dia — pré-vendas só faz marcações (sem visitas/matrículas) */}
              {(() => {
                const tiles = [
                  { label: 'Marcações',  value: prod.marcacoes.length,  color: '#60A5FA', Icon: CalendarPlus },
                  ...(isVisitor ? [
                    { label: 'Visitas',    value: prod.visitas.length,    color: '#A78BFA', Icon: Handshake },
                    { label: 'Matrículas', value: prod.matriculas.length, color: '#C9A84C', Icon: GraduationCap },
                  ] : [
                    // pré-vendas: ligações do dia (aba Ligações)
                    { label: 'Ligações',  value: prod.calls,    color: '#E8834A', Icon: Phone },
                    { label: 'Atendidas', value: prod.answered, color: '#22D3EE', Icon: PhoneCall },
                  ]),
                  { label: 'Ligar depois', value: prod.callbacksToday.length, color: '#F472B6', Icon: PhoneForwarded },
                ]
                return (
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${tiles.length}, 1fr)`, gap: '10px' }}>
                {tiles.map(({ label, value, color, Icon }) => (
                  <div key={label} className="rounded-2xl text-center" style={{ background: '#161616', border: '1px solid #252525', padding: '14px 8px' }}>
                    <Icon size={14} style={{ color, margin: '0 auto 6px' }} />
                    <p className="text-xl font-bold tabular-nums" style={{ color }}>{value}</p>
                    <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#6B6560' }}>{label}</p>
                  </div>
                ))}
              </div>
                )
              })()}

              {/* Marcações feitas hoje */}
              {prod.marcacoes.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <SectionLabel color="#60A5FA">Marcações de hoje</SectionLabel>
                  {prod.marcacoes.map(c => (
                    <CompactCard key={c.id}
                      time={timeOf(c.visit_scheduled_at)}
                      tag="Marcação" tagColor="#60A5FA"
                      name={c.contact_name} company={c.company_name}
                      sub={c.city ? <><MapPin size={10} /> {c.city}</> : null}
                      onClick={() => setSelected(c)}
                    />
                  ))}
                </div>
              )}

              {/* "Pediu p/ ligar depois" registrados hoje (cor rosa, distinta das marcações) */}
              {prod.callbacksToday.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <SectionLabel color="#F472B6"><span className="inline-flex items-center gap-1.5"><PhoneForwarded size={12} /> Ligar depois — registrados hoje</span></SectionLabel>
                  {prod.callbacksToday.map(c => (
                    <button key={c.id} onClick={() => setEditingCallback(c)}
                      className="w-full text-left rounded-2xl transition-all active:scale-[0.98]"
                      style={{ background: '#161616', border: '1px solid #252525', borderLeft: '3px solid #F472B6', padding: '13px 15px' }}>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold truncate" style={{ color: '#EFEFEF' }}>{c.contact_name}</p>
                        {c.reminder_config?.time && (
                          <span className="text-[10px] font-bold rounded-full flex-shrink-0 flex items-center gap-1"
                            style={{ padding: '2px 8px', background: 'rgba(244,114,182,0.12)', border: '1px solid rgba(244,114,182,0.3)', color: '#F472B6' }}>
                            <Clock size={9} /> {c.reminder_config.time}
                          </span>
                        )}
                      </div>
                      {(c.company_name || c.contact_role) && (
                        <p className="text-xs truncate" style={{ color: '#6B6560' }}>{[c.company_name, c.contact_role].filter(Boolean).join(' · ')}</p>
                      )}
                      <p className="text-[11px] mt-0.5 flex items-center gap-1" style={{ color: '#F472B6' }}><Phone size={10} /> {allPhones(c).map(p => p.n).join(' · ')}</p>
                      <p className="text-[10px] mt-1.5" style={{ color: '#2A2A2A' }}>Toque para editar →</p>
                    </button>
                  ))}
                </div>
              )}

              {/* Visitas feitas hoje — só vendedor/gerente */}
              {isVisitor && prod.visitas.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <SectionLabel color="#A78BFA">Visitas feitas hoje</SectionLabel>
                  {prod.visitas.map(h => (
                    <CompactCard key={h.id}
                      time={timeOf(h.created_at)}
                      tag={h.event_data?.to === 'matriculado' ? 'Visita → Matrícula' : 'Visita recebida'}
                      tagColor="#A78BFA"
                      name={h.clients?.contact_name} company={h.clients?.company_name}
                      sub={h.clients?.city ? <><MapPin size={10} /> {h.clients.city}</> : null}
                      onClick={() => h.clients && setSelected(h.clients)}
                    />
                  ))}
                </div>
              )}

              {/* Matrículas do dia (créditos de comissão) — só vendedor/gerente */}
              {isVisitor && prod.matriculas.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <SectionLabel color="#C9A84C">🎓 Matrículas do dia</SectionLabel>
                  {prod.matriculas.map(m => (
                    <CompactCard key={m.id}
                      time={timeOf(m.created_at)}
                      tag="Matrícula" tagColor="#C9A84C"
                      name={m.clients?.contact_name} company={m.clients?.company_name}
                      sub={m.clients?.city ? <><MapPin size={10} /> {m.clients.city}</> : null}
                      onClick={() => m.clients && setSelected(m.clients)}
                    />
                  ))}
                </div>
              )}

              {prod.marcacoes.length === 0 && prod.callbacksToday.length === 0 && (isVisitor
                ? (prod.visitas.length === 0 && prod.matriculas.length === 0)
                : (prod.calls === 0 && prod.answered === 0)) && (
                <div className="flex flex-col items-center justify-center" style={{ paddingTop: '50px', gap: '12px' }}>
                  <p style={{ fontSize: '3rem' }}>📊</p>
                  <p className="text-sm font-medium" style={{ color: '#333030' }}>
                    {prodDate === localDateStr() ? 'Nada produzido hoje ainda' : 'Nada produzido nesse dia'}
                  </p>
                </div>
              )}
            </>
          )}
        </>
      )}

      {editingCallback && (
        <CallbackForm
          initialData={editingCallback}
          onClose={() => setEditingCallback(null)}
          onSaved={() => { setEditingCallback(null); if (view === 'produzido' && personId) fetchProduzido(personId, prodDate); fetchData() }}
        />
      )}
    </div>
  )
}

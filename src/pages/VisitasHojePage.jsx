import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { MapPin, Clock, User, Phone, Star, AlertTriangle, Bell } from 'lucide-react'
import ClienteDetalhe from '../components/ClienteDetalhe'
import { STAGE_BADGES } from '../components/ui/Badge'
import VisitConfirmationList from '../components/VisitConfirmationList'
import {
  fetchVisitsToConfirm, fetchVisitsForDay, fetchCallbacksForDay,
  fetchAnsweredVisitsForDay, fetchUpcomingReminders, getDayRange,
} from '../lib/visitConfirmation'
import { updateClientStage } from '../lib/clientStage'
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
  const [toConfirm, setToConfirm]       = useState([])
  const [confirmHidden, setConfirmHidden] = useState(false)
  const [todayVisits, setTodayVisits]   = useState([])
  const [todayCalls, setTodayCalls]     = useState([])
  const [tomVisits, setTomVisits]       = useState([])
  const [tomCalls, setTomCalls]         = useState([])
  const { pending: pendingRatings, loading: gateLoading, refresh: refreshGate } = useRatingsGate()
  const [answeredToday, setAnsweredToday]   = useState([]) // pré-vendas: visitas de hoje já respondidas
  const [reminders, setReminders]           = useState([]) // lembretes chegando (≤3 dias)

  const today    = getDayRange(0)
  const tomorrow = getDayRange(1)
  const isVisitor = profile?.role === 'vendedor' || profile?.role === 'gerente'

  useEffect(() => { fetchData() }, [profile])

  async function fetchData() {
    if (!user?.id) return
    const role = profile?.role

    const [confirm, tv, tc, mv, mc, rem] = await Promise.all([
      fetchVisitsToConfirm(user.id),
      fetchVisitsForDay(role, user.id, 0),
      fetchCallbacksForDay(role, user.id, 0),
      fetchVisitsForDay(role, user.id, 1),
      fetchCallbacksForDay(role, user.id, 1),
      fetchUpcomingReminders(user.id, 3),
    ])
    setReminders(rem)
    // Visitas "não confirmadas" (por quem marcou) não aparecem na agenda
    const visible = arr => arr.filter(v => v.visit_confirmation !== 'nao_confirmada')
    setToConfirm(confirm)
    setConfirmHidden(false)
    setTodayVisits(visible(tv))
    setTodayCalls(tc)
    setTomVisits(visible(mv))
    setTomCalls(mc)

    if (isVisitor) {
      const { data: profs } = await supabase.from('profiles').select('id, name, role')
      setProfilesMap(Object.fromEntries((profs || []).map(p => [p.id, p])))
    } else {
      // Pré-vendas: visitas de hoje que ele já respondeu no pop-up (coloridas)
      setAnsweredToday(await fetchAnsweredVisitsForDay(user.id, 0))
    }

    setLoading(false)
  }

  // Clicou num botão de resultado → muda o estágio automaticamente (otimista)
  async function handleStageChange(visit, newStage) {
    const oldStage = visit.matricula_stage
    if (oldStage === newStage) return
    setTodayVisits(vs => vs.map(x => x.id === visit.id ? { ...x, matricula_stage: newStage } : x))
    await updateClientStage({ clientId: visit.id, newStage, oldStage, userId: user.id, userName: profile?.name })
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
  const nothingToday = !showConfirm && todayVisits.length === 0 && todayCalls.length === 0 && answeredToday.length === 0 && reminders.length === 0

  return (
    <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>

      {/* Header */}
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.15em] mb-1 capitalize" style={{ color: '#C9A84C' }}>
          {today.label}
        </p>
        <h1 style={{ color: '#EFEFEF' }}>{isVisitor ? 'Visitas de Hoje' : 'Sua agenda'}</h1>
      </div>

      {/* Confirmar visitas (hoje + amanhã) — destaque dourado */}
      {!loading && showConfirm && (
        <div className="rounded-2xl" style={{ background: '#15140F', border: '1px solid rgba(201,168,76,0.22)', padding: '16px' }}>
          <SectionLabel color="#C9A84C">Confirmar visitas</SectionLabel>
          <p className="text-xs mt-1 mb-4" style={{ color: '#6B6560' }}>
            {toConfirm.length} {toConfirm.length === 1 ? 'visita marcada' : 'visitas marcadas'} por você (hoje e amanhã).
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
              sub={c.phone ? <><Phone size={10} /> {c.phone}</> : null}
              isPast={new Date(c.call_back_at) < new Date()}
              onClick={() => setSelected(c)}
            />
          ))}
        </div>
      )}

      {/* Lembretes chegando (≤3 dias) — clientes que a pessoa marcou p/ lembrar */}
      {!loading && reminders.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <SectionLabel color="#C9A84C"><span className="inline-flex items-center gap-1.5"><Bell size={12} /> Lembretes</span></SectionLabel>
          {reminders.map(c => (
            <CompactCard key={c.id}
              time={reminderLabel(c.daysUntil, c.reminderDate)}
              tag="Lembrete" tagColor="#C9A84C"
              name={c.contact_name} company={c.company_name}
              sub={c.phone ? <><Phone size={10} /> {c.phone}</> : null}
              onClick={() => setSelected(c)}
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
                  sub={c.phone ? <><Phone size={10} /> {c.phone}</> : null}
                  onClick={() => setSelected(c)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

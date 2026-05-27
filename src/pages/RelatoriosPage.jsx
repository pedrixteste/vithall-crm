import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const TRAININGS = ['Impacto', 'Perfil', 'Vendas', 'LORAP', 'Academia Vithall']
const ORIGINS = [
  { key: 'ligacao fria', label: 'Ligacao fria' },
  { key: 'lead',         label: 'Lead' },
  { key: 'feiras',       label: 'Feiras' },
  { key: 'indicacao',    label: 'Indicacao' },
]
const PERIODS = [
  { key: 7,   label: 'Semana' },
  { key: 30,  label: 'Mes' },
  { key: 365, label: 'Ano' },
]
const ROLE_LABELS = {
  pre_vendas: 'Pre-vendas',
  vendedor:   'Vendedor',
  gerente:    'Gerente',
}

// ── Componentes ────────────────────────────────────────────────────

function FunnelStep({ label, value, color, rateLabel, isLast }) {
  return (
    <div>
      <div className="rounded-2xl" style={{ background: '#161616', border: `1px solid ${color}28`, padding: '16px 20px' }}>
        <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: '#3A3A3A' }}>{label}</p>
        <p className="text-4xl font-bold tabular-nums" style={{ color, letterSpacing: '-1.5px' }}>{value ?? 0}</p>
      </div>
      {!isLast && (
        <div className="flex items-center gap-3" style={{ padding: '7px 16px 7px 22px' }}>
          <div style={{ width: '2px', height: '26px', background: `linear-gradient(${color}50, #1C1C1C)`, borderRadius: '1px', flexShrink: 0 }} />
          {rateLabel && (
            <span className="text-[11px] font-semibold rounded-lg"
              style={{ padding: '4px 10px', background: 'rgba(201,168,76,0.07)', border: '1px solid rgba(201,168,76,0.12)', color: '#7A6030' }}>
              {rateLabel}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

function RatioCard({ label, value, unit, color = '#C9A84C', sub }) {
  return (
    <div className="rounded-2xl flex flex-col" style={{ background: '#161616', border: '1px solid #252525', padding: '16px' }}>
      <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: '#3A3A3A' }}>{label}</p>
      <p className="text-3xl font-bold tabular-nums" style={{ color, letterSpacing: '-1px' }}>
        {value ?? '—'}
        {value != null && unit && (
          <span className="text-sm font-normal ml-1.5" style={{ color: color + '88' }}>{unit}</span>
        )}
      </p>
      {sub && <p className="text-[10px] mt-1.5" style={{ color: '#3A3A3A' }}>{sub}</p>}
    </div>
  )
}

function TrainingRow({ label, count, avgVisits, max }) {
  const pct = max > 0 ? Math.max((count / max) * 100, count > 0 ? 4 : 0) : 0
  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-medium" style={{ color: count > 0 ? '#EFEFEF' : '#3A3530' }}>{label}</span>
        <div className="flex items-center gap-2">
          {avgVisits && count > 0 && (
            <span className="text-[10px] font-semibold rounded-full"
              style={{ padding: '3px 8px', background: 'rgba(167,139,250,0.1)', color: '#A78BFA', border: '1px solid rgba(167,139,250,0.2)' }}>
              ~{avgVisits}x visitas/venda
            </span>
          )}
          <span className="text-sm font-bold tabular-nums w-5 text-right" style={{ color: count > 0 ? '#4ADE80' : '#2A2A2A' }}>{count}</span>
        </div>
      </div>
      <div style={{ height: '5px', borderRadius: '99px', background: '#1A1A1A', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: '#4ADE80', borderRadius: '99px', transition: 'width 0.5s ease' }} />
      </div>
    </div>
  )
}

function OriginRow({ label, count, max }) {
  const pct = max > 0 ? Math.max((count / max) * 100, count > 0 ? 4 : 0) : 0
  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-medium" style={{ color: count > 0 ? '#EFEFEF' : '#3A3530' }}>{label}</span>
        <span className="text-sm font-bold tabular-nums" style={{ color: count > 0 ? '#C9A84C' : '#2A2A2A' }}>{count}</span>
      </div>
      <div style={{ height: '5px', borderRadius: '99px', background: '#1A1A1A', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: '#C9A84C', borderRadius: '99px', transition: 'width 0.5s ease' }} />
      </div>
    </div>
  )
}

// ── Página principal ───────────────────────────────────────────────

export default function RelatoriosPage() {
  const { profile, user } = useAuth()
  const [clients, setClients]     = useState([])
  const [profiles, setProfiles]   = useState([])
  const [dailyLogs, setDailyLogs] = useState([])
  const [loading, setLoading]     = useState(true)
  const [period, setPeriod]       = useState(30)
  const [selectedPerson, setSelectedPerson] = useState('all')

  useEffect(() => { fetchData() }, [profile])

  async function fetchData() {
    let query = supabase.from('clients').select('*, visits(*)')
    if (profile?.role === 'pre_vendas') {
      query = query.eq('created_by', user.id)
    } else if (profile?.role === 'vendedor') {
      query = query.or(`assigned_to.eq.${user.id},created_by.eq.${user.id}`)
    }
    const { data: clientsData } = await query
    setClients(clientsData || [])

    if (profile?.role === 'gerente') {
      const { data: profilesData } = await supabase.from('profiles').select('*').order('name')
      setProfiles(profilesData || [])
    }

    // daily_logs: proprio usuario ou todos (gerente)
    let logsQuery = supabase.from('daily_logs').select('calls, appointments, log_date, user_id')
    if (profile?.role !== 'gerente') logsQuery = logsQuery.eq('user_id', user.id)
    const { data: logsData } = await logsQuery
    setDailyLogs(logsData || [])

    setLoading(false)
  }

  // ── Período ───────────────────────────────────────────────────

  const periodStart = new Date()
  periodStart.setDate(periodStart.getDate() - period)
  periodStart.setHours(0, 0, 0, 0)

  // ── Filtro por pessoa (gerente) ───────────────────────────────

  const filteredClients = (() => {
    if (profile?.role !== 'gerente' || selectedPerson === 'all') return clients
    const p = profiles.find(p => p.id === selectedPerson)
    if (!p) return clients
    return p.role === 'pre_vendas'
      ? clients.filter(c => c.created_by === selectedPerson)
      : clients.filter(c => c.assigned_to === selectedPerson || c.created_by === selectedPerson)
  })()

  const filteredLogs = (() => {
    if (profile?.role !== 'gerente') return dailyLogs
    if (selectedPerson === 'all') return dailyLogs
    return dailyLogs.filter(l => l.user_id === selectedPerson)
  })()

  // ── Cálculos do período ───────────────────────────────────────

  const clientsInPeriod = filteredClients.filter(c => new Date(c.created_at) >= periodStart)
  const visitsInPeriod  = filteredClients.flatMap(c =>
    (c.visits || []).filter(v => new Date(v.visit_date + 'T12:00:00') >= periodStart)
  )
  const enrolledInPeriod = clientsInPeriod.filter(c => c.matricula_stage === 'matriculado')
  const noShowsInPeriod  = clientsInPeriod.filter(c => c.matricula_stage === 'nao_apareceu')

  const totalCallsInPeriod = filteredLogs
    .filter(l => new Date(l.log_date + 'T12:00:00') >= periodStart)
    .reduce((sum, l) => sum + (l.calls || 0), 0)

  const hasCalls = totalCallsInPeriod > 0

  // ── All-time (escopo filtrado) ────────────────────────────────

  const allEnrolled = filteredClients.filter(c => c.matricula_stage === 'matriculado')

  // ── Métricas do funil ─────────────────────────────────────────

  const callsPerBooking = hasCalls && clientsInPeriod.length > 0
    ? (totalCallsInPeriod / clientsInPeriod.length).toFixed(1)
    : null

  const bookingShowRate = clientsInPeriod.length > 0 && visitsInPeriod.length > 0
    ? Math.round((visitsInPeriod.length / clientsInPeriod.length) * 100)
    : null

  const visitConvRate = visitsInPeriod.length > 0
    ? Math.round((enrolledInPeriod.length / visitsInPeriod.length) * 100)
    : null

  // ── Médias acumuladas ─────────────────────────────────────────

  const avgVisitsPerEnrollment = (() => {
    const valid = allEnrolled.filter(c => (c.visits || []).length > 0)
    if (!valid.length) return null
    return (valid.reduce((s, c) => s + c.visits.length, 0) / valid.length).toFixed(1)
  })()

  const totalCallsAllTime = filteredLogs.reduce((s, l) => s + (l.calls || 0), 0)

  const callsPerEnrollment = allEnrolled.length > 0 && totalCallsAllTime > 0
    ? Math.round(totalCallsAllTime / allEnrolled.length)
    : null

  // ── Por treinamento (acumulado) ───────────────────────────────

  const trainingStats = TRAININGS.map(t => {
    const enrolled = allEnrolled.filter(c => (c.matriculas || []).includes(t))
    const withVisits = enrolled.filter(c => (c.visits || []).length > 0)
    const avgVisits = withVisits.length > 0
      ? (withVisits.reduce((s, c) => s + c.visits.length, 0) / withVisits.length).toFixed(1)
      : null
    return { label: t, count: enrolled.length, avgVisits }
  })
  const maxTraining = Math.max(...trainingStats.map(t => t.count), 1)

  // ── Por origem (acumulado) ────────────────────────────────────

  const originStats = ORIGINS.map(o => ({
    label: o.label, key: o.key,
    count: allEnrolled.filter(c => c.origin === o.key).length,
  }))
  const maxOrigin = Math.max(...originStats.map(o => o.count), 1)

  // ── Ranking da equipe (gerente, visao geral) ──────────────────

  const teamStats = profiles
    .filter(p => p.role !== 'gerente')
    .map(p => {
      const mc = p.role === 'pre_vendas'
        ? clients.filter(c => c.created_by === p.id)
        : clients.filter(c => c.assigned_to === p.id || c.created_by === p.id)
      const inPeriod   = mc.filter(c => new Date(c.created_at) >= periodStart)
      const visits     = mc.flatMap(c => (c.visits || []).filter(v => new Date(v.visit_date + 'T12:00:00') >= periodStart))
      const matriculas = mc.filter(c => c.matricula_stage === 'matriculado')
      const calls      = dailyLogs
        .filter(l => l.user_id === p.id && new Date(l.log_date + 'T12:00:00') >= periodStart)
        .reduce((s, l) => s + (l.calls || 0), 0)
      const withVisits = matriculas.filter(c => (c.visits || []).length > 0)
      const avgV = withVisits.length > 0
        ? (withVisits.reduce((s, c) => s + c.visits.length, 0) / withVisits.length).toFixed(1)
        : null
      return {
        ...p,
        marcacoes:  inPeriod.length,
        visitas:    visits.length,
        matriculas: matriculas.length,
        ligacoes:   calls,
        avgVisits:  avgV,
        convRate:   visits.length > 0 ? Math.round((matriculas.length / visits.length) * 100) : null,
      }
    })

  // ── Render ────────────────────────────────────────────────────

  if (loading) return (
    <div className="flex justify-center" style={{ padding: '64px 0' }}>
      <div className="w-7 h-7 rounded-full border-2 animate-spin"
        style={{ borderColor: '#C9A84C', borderTopColor: 'transparent' }} />
    </div>
  )

  const selectedPersonProfile = profiles.find(p => p.id === selectedPerson)

  return (
    <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>

      {/* Header */}
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.15em] mb-1" style={{ color: '#C9A84C' }}>Analise</p>
        <h1 style={{ color: '#EFEFEF' }}>Relatorios</h1>
        {selectedPersonProfile && (
          <p className="text-sm mt-1 font-medium" style={{ color: '#C9A84C' }}>
            {selectedPersonProfile.name} · {ROLE_LABELS[selectedPersonProfile.role]}
          </p>
        )}
      </div>

      {/* Filtro de período */}
      <div className="flex p-1 rounded-xl gap-1" style={{ background: '#161616', border: '1px solid #252525' }}>
        {PERIODS.map(p => (
          <button key={p.key} onClick={() => setPeriod(p.key)}
            className="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all"
            style={{
              background: period === p.key ? 'rgba(201,168,76,0.12)' : 'transparent',
              color:      period === p.key ? '#C9A84C' : '#6B6560',
              border:     period === p.key ? '1px solid rgba(201,168,76,0.2)' : '1px solid transparent',
            }}>
            {p.label}
          </button>
        ))}
      </div>

      {/* Filtro por pessoa (gerente) */}
      {profile?.role === 'gerente' && profiles.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: '#333030' }}>Ver dados de</p>
          <div className="flex flex-wrap" style={{ gap: '8px' }}>
            <button onClick={() => setSelectedPerson('all')}
              className="text-xs font-semibold rounded-xl transition-all"
              style={{
                padding: '8px 14px',
                background: selectedPerson === 'all' ? 'rgba(201,168,76,0.12)' : '#161616',
                border: `1px solid ${selectedPerson === 'all' ? 'rgba(201,168,76,0.35)' : '#252525'}`,
                color: selectedPerson === 'all' ? '#C9A84C' : '#6B6560',
              }}>
              Equipe toda
            </button>
            {profiles.filter(p => p.role !== 'gerente').map(p => (
              <button key={p.id} onClick={() => setSelectedPerson(p.id)}
                className="text-xs font-semibold rounded-xl transition-all"
                style={{
                  padding: '8px 14px',
                  background: selectedPerson === p.id ? 'rgba(201,168,76,0.12)' : '#161616',
                  border: `1px solid ${selectedPerson === p.id ? 'rgba(201,168,76,0.35)' : '#252525'}`,
                  color: selectedPerson === p.id ? '#C9A84C' : '#6B6560',
                }}>
                {p.name?.split(' ')[0]} · {ROLE_LABELS[p.role]}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Funil de conversão ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#333030' }}>Funil de conversao</p>
          <p className="text-[10px]" style={{ color: '#2A2A2A' }}>periodo selecionado</p>
        </div>
        <div>
          {hasCalls && (
            <FunnelStep
              label="Ligacoes feitas"
              value={totalCallsInPeriod}
              color="#E8834A"
              rateLabel={callsPerBooking ? `${callsPerBooking} lig. por marcacao` : null}
            />
          )}
          <FunnelStep
            label="Marcacoes feitas"
            value={clientsInPeriod.length}
            color="#60A5FA"
            rateLabel={bookingShowRate !== null ? `${bookingShowRate}% compareceram` : null}
          />
          <FunnelStep
            label="Visitas realizadas"
            value={visitsInPeriod.length}
            color="#A78BFA"
            rateLabel={visitConvRate !== null ? `${visitConvRate}% viraram matricula` : null}
          />
          <FunnelStep
            label="Matriculas fechadas"
            value={enrolledInPeriod.length}
            color="#4ADE80"
            isLast
          />
        </div>
      </div>

      {/* ── Eficiência (acumulado) ── */}
      {(avgVisitsPerEnrollment || callsPerEnrollment || noShowsInPeriod.length > 0) && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#333030' }}>Eficiencia media</p>
            <p className="text-[10px]" style={{ color: '#2A2A2A' }}>acumulado</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {avgVisitsPerEnrollment && (
              <RatioCard
                label="Visitas por matricula"
                value={avgVisitsPerEnrollment}
                unit="vis."
                color="#A78BFA"
                sub="media ate fechar venda"
              />
            )}
            {callsPerEnrollment && hasCalls && (
              <RatioCard
                label="Ligacoes por matricula"
                value={callsPerEnrollment}
                unit="lig."
                color="#E8834A"
                sub="media total de contatos"
              />
            )}
            {callsPerBooking && hasCalls && (
              <RatioCard
                label="Ligacoes por marcacao"
                value={callsPerBooking}
                unit="lig."
                color="#60A5FA"
                sub="no periodo selecionado"
              />
            )}
            <RatioCard
              label="Nao apareceu"
              value={noShowsInPeriod.length}
              unit=""
              color="#E85555"
              sub={clientsInPeriod.length > 0 && noShowsInPeriod.length > 0
                ? `${Math.round((noShowsInPeriod.length / clientsInPeriod.length) * 100)}% das marcacoes`
                : 'no periodo'}
            />
          </div>
        </div>
      )}

      {/* ── Por treinamento ── */}
      <div className="rounded-2xl" style={{ background: '#161616', border: '1px solid #252525', padding: '18px' }}>
        <div className="flex items-center justify-between mb-4">
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#333030' }}>
            Matriculas por treinamento
          </p>
          <p className="text-[10px]" style={{ color: '#2A2A2A' }}>acumulado</p>
        </div>
        {allEnrolled.length === 0 ? (
          <p className="text-xs text-center" style={{ color: '#2A2A2A', padding: '16px 0' }}>Nenhuma matricula registrada</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {[...trainingStats].sort((a, b) => b.count - a.count).map(t => (
              <TrainingRow key={t.label} label={t.label} count={t.count} avgVisits={t.avgVisits} max={maxTraining} />
            ))}
          </div>
        )}
      </div>

      {/* ── Por origem ── */}
      <div className="rounded-2xl" style={{ background: '#161616', border: '1px solid #252525', padding: '18px' }}>
        <div className="flex items-center justify-between mb-4">
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#333030' }}>
            Matriculas por origem
          </p>
          <p className="text-[10px]" style={{ color: '#2A2A2A' }}>acumulado</p>
        </div>
        {allEnrolled.length === 0 ? (
          <p className="text-xs text-center" style={{ color: '#2A2A2A', padding: '16px 0' }}>Nenhuma matricula registrada</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {[...originStats].sort((a, b) => b.count - a.count).map(o => (
              <OriginRow key={o.key} label={o.label} count={o.count} max={maxOrigin} />
            ))}
          </div>
        )}
      </div>

      {/* ── Ranking da equipe (gerente, visão geral) ── */}
      {profile?.role === 'gerente' && selectedPerson === 'all' && teamStats.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: '#333030' }}>
            Ranking da equipe
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[...teamStats].sort((a, b) => b.matriculas - a.matriculas).map(m => (
              <button key={m.id}
                onClick={() => setSelectedPerson(m.id)}
                className="rounded-2xl text-left w-full transition-all"
                style={{ background: '#161616', border: '1px solid #252525', padding: '16px 18px' }}>

                {/* Nome + cargo + taxa de conv */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center font-bold flex-shrink-0"
                    style={{ background: 'rgba(201,168,76,0.08)', color: '#C9A84C', border: '1px solid rgba(201,168,76,0.15)' }}>
                    {m.name?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold" style={{ color: '#EFEFEF' }}>{m.name || 'Sem nome'}</p>
                    <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#444040' }}>
                      {ROLE_LABELS[m.role] || m.role}
                    </p>
                  </div>
                  {m.convRate !== null && m.visitas > 0 && (
                    <span className="text-xs font-bold rounded-lg"
                      style={{ padding: '4px 10px', background: 'rgba(74,222,128,0.08)', color: '#4ADE80', border: '1px solid rgba(74,222,128,0.18)' }}>
                      {m.convRate}% conv.
                    </span>
                  )}
                </div>

                {/* Métricas em grid */}
                <div style={{ display: 'grid', gridTemplateColumns: m.ligacoes > 0 ? '1fr 1fr 1fr 1fr' : '1fr 1fr 1fr', gap: '8px' }}>
                  {m.ligacoes > 0 && (
                    <div className="rounded-xl text-center" style={{ background: '#111', padding: '10px 4px' }}>
                      <p className="text-lg font-bold tabular-nums" style={{ color: '#E8834A' }}>{m.ligacoes}</p>
                      <p className="text-[9px] font-bold uppercase tracking-wider mt-0.5" style={{ color: '#333030' }}>Lig.</p>
                    </div>
                  )}
                  {[
                    { label: 'Marc.', value: m.marcacoes,  color: '#60A5FA' },
                    { label: 'Vis.',  value: m.visitas,    color: '#A78BFA' },
                    { label: 'Mat.',  value: m.matriculas, color: '#4ADE80' },
                  ].map(s => (
                    <div key={s.label} className="rounded-xl text-center" style={{ background: '#111', padding: '10px 4px' }}>
                      <p className="text-lg font-bold tabular-nums" style={{ color: s.color }}>{s.value}</p>
                      <p className="text-[9px] font-bold uppercase tracking-wider mt-0.5" style={{ color: '#333030' }}>{s.label}</p>
                    </div>
                  ))}
                </div>

                {/* Média de visitas */}
                {m.avgVisits && (
                  <p className="text-[10px] mt-2.5 font-semibold text-center" style={{ color: '#444040' }}>
                    ~{m.avgVisits} visitas por matricula · toque para ver detalhes
                  </p>
                )}
                {!m.avgVisits && (
                  <p className="text-[10px] mt-2 text-center" style={{ color: '#2A2A2A' }}>
                    Toque para ver detalhes
                  </p>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}

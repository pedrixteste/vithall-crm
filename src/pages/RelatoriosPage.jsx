import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { generateReportHTML } from '../lib/reportExport'
import { localDateStr } from '../lib/utils'
import RelatoriosListas from '../components/RelatoriosListas'

// ── Constantes ─────────────────────────────────────────────────────

const TRAININGS = ['Impacto', 'Perfil', 'Vendas', 'LORAP', 'Academia Vithall', 'Mentoria']
const TRAINING_COLORS = {
  'Impacto':          '#E85555',
  'Perfil':           '#E8834A',
  'Vendas':           '#C9A84C',
  'LORAP':            '#4ADE80',
  'Academia Vithall': '#60A5FA',
  'Mentoria':         '#A78BFA',
}
const ORIGINS = [
  { key: 'frias contatinhos', label: 'Frias contatinhos' },
  { key: 'frias listas',      label: 'Frias listas' },
  { key: 'lead campanha',     label: 'Lead campanha' },
  { key: 'lead organico',    label: 'Lead orgânico' },
  { key: 'feiras',            label: 'Eventos' },
  { key: 'indicacao',         label: 'Indicacao' },
]
const PERIODS = [
  { key: 'week',  label: 'Semana' },
  { key: 'month', label: 'Mês'   },
  { key: 'year',  label: 'Ano'   },
]
const ROLE_LABELS = {
  pre_vendas: 'Pre-vendas',
  vendedor:   'Vendedor',
  gerente:    'Gerente',
}
const WEEK_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab']

// ── SVG helpers ────────────────────────────────────────────────────

/** Smooth cubic bezier path through ordered points */
function bezierPath(pts) {
  if (!pts.length) return ''
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`
  let d = `M ${pts[0].x} ${pts[0].y}`
  for (let i = 1; i < pts.length; i++) {
    const t = 0.38
    const dx = pts[i].x - pts[i - 1].x
    d += ` C ${pts[i-1].x + dx*t} ${pts[i-1].y} ${pts[i].x - dx*t} ${pts[i].y} ${pts[i].x} ${pts[i].y}`
  }
  return d
}

// ── Gráfico de tendência (multi-série, área + linha) ───────────────

function TrendChart({ series, labels }) {
  if (!series.length || series[0].data.length < 2) return null
  const n    = series[0].data.length
  const max  = Math.max(...series.flatMap(s => s.data), 1)
  const VW = 300, VH = 88, PT = 10, PB = 4
  const xi   = i => (i / (n - 1)) * VW
  const yi   = v => PT + (1 - v / max) * (VH - PT - PB)
  const pts  = s => s.data.map((v, i) => ({ x: xi(i), y: yi(v) }))

  // Show 4 x-axis labels at even intervals
  const idxs = n <= 7
    ? Array.from({ length: n }, (_, i) => i)
    : [0, Math.floor(n / 3), Math.floor(2 * n / 3), n - 1]

  return (
    <div>
      <svg viewBox={`0 0 ${VW} ${VH}`}
        style={{ width: '100%', display: 'block', height: '88px' }}
        preserveAspectRatio="none">
        <defs>
          {series.map(s => (
            <linearGradient key={s.key} id={`tg-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={s.color} stopOpacity="0.28" />
              <stop offset="100%" stopColor={s.color} stopOpacity="0"    />
            </linearGradient>
          ))}
        </defs>

        {/* Subtle grid lines */}
        {[0.5, 1].map(f => (
          <line key={f}
            x1={0} y1={yi(f * max)} x2={VW} y2={yi(f * max)}
            stroke="#1E1E1E" strokeWidth="0.6" strokeDasharray="3 4" />
        ))}

        {/* Area fills — drawn back to front */}
        {[...series].reverse().map(s => {
          const p   = pts(s)
          const line = bezierPath(p)
          const area = `${line} L ${xi(n-1)} ${VH} L ${xi(0)} ${VH} Z`
          return <path key={`a-${s.key}`} d={area} fill={`url(#tg-${s.key})`} />
        })}

        {/* Lines */}
        {series.map(s => (
          <path key={`l-${s.key}`} d={bezierPath(pts(s))}
            fill="none" stroke={s.color} strokeWidth="1.8"
            strokeLinecap="round" strokeLinejoin="round" />
        ))}

        {/* Data dots */}
        {series.map(s =>
          pts(s).map((pt, i) => s.data[i] > 0 && (
            <circle key={`d-${s.key}-${i}`} cx={pt.x} cy={pt.y} r="2.4"
              fill={s.color} />
          ))
        )}
      </svg>

      {/* X-axis labels */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', padding: '0 2px' }}>
        {idxs.map(i => (
          <span key={i} style={{ fontSize: '9px', fontWeight: 600, color: '#3A3A3A' }}>
            {labels[i]}
          </span>
        ))}
      </div>
    </div>
  )
}

// ── Donut chart ─────────────────────────────────────────────────────

function DonutChart({ segments }) {
  const total = segments.reduce((s, g) => s + g.value, 0)
  if (!total) return null

  const r = 46, cx = 60, cy = 60
  const C = 2 * Math.PI * r
  const GAP_LEN = 0.012 * C  // gap between segments

  let cum = 0
  const arcs = segments
    .filter(s => s.value > 0)
    .map(seg => {
      const frac   = seg.value / total
      const dash   = Math.max(frac * C - GAP_LEN, 0)
      const offset = cum
      cum += dash + GAP_LEN
      return { ...seg, dash, offset }
    })

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
      <svg viewBox="0 0 120 120" width={110} height={110} style={{ flexShrink: 0 }}>
        {/* Track */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#181818" strokeWidth={15} />
        {/* Segments */}
        {arcs.map((arc, i) => (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none"
            stroke={arc.color} strokeWidth={13}
            strokeDasharray={`${arc.dash} ${C}`}
            strokeDashoffset={-arc.offset}
            style={{ transform: 'rotate(-90deg)', transformOrigin: `${cx}px ${cy}px` }}
          />
        ))}
        {/* Center */}
        <text x={cx} y={cy - 5} textAnchor="middle"
          style={{ fill: '#EFEFEF', fontSize: '22px', fontWeight: '800', letterSpacing: '-1px' }}>
          {total}
        </text>
        <text x={cx} y={cy + 11} textAnchor="middle"
          style={{ fill: '#3A3A3A', fontSize: '7px', fontWeight: '700', letterSpacing: '1.5px' }}>
          MATRÍCULAS
        </text>
      </svg>

      {/* Legend */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', flex: 1, minWidth: 0 }}>
        {segments.filter(s => s.value > 0).map(s => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: s.color, flexShrink: 0 }} />
            <span style={{ fontSize: '12px', color: '#EFEFEF', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {s.label}
            </span>
            <span style={{ fontSize: '12px', fontWeight: 700, color: s.color }}>
              {s.value}
            </span>
          </div>
        ))}
        {segments.every(s => s.value === 0) && (
          <p style={{ fontSize: '11px', color: '#2A2A2A' }}>Sem dados</p>
        )}
      </div>
    </div>
  )
}

// ── Heatmap semanal (barras horizontais) ───────────────────────────

function WeekChart({ data, color, emptyText }) {
  const max = Math.max(...data, 1)
  const hasData = data.some(v => v > 0)
  if (!hasData) return (
    <p style={{ fontSize: '11px', color: '#2A2A2A', padding: '8px 0' }}>{emptyText || 'Sem dados'}</p>
  )
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {data.map((v, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ width: '26px', fontSize: '10px', fontWeight: 700, color: '#3A3A3A', textAlign: 'right', flexShrink: 0 }}>
            {WEEK_LABELS[i]}
          </span>
          <div style={{ flex: 1, height: '16px', background: '#111', borderRadius: '5px', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: v > 0 ? `${Math.max((v / max) * 100, 7)}%` : '0%',
              background: `linear-gradient(90deg, ${color}DD, ${color}77)`,
              borderRadius: '5px',
              transition: 'width 0.6s ease',
            }} />
          </div>
          <span style={{ width: '20px', fontSize: '11px', fontWeight: 700, color: v > 0 ? color : '#2A2A2A', textAlign: 'right', flexShrink: 0 }}>
            {v || ''}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── Componentes existentes ─────────────────────────────────────────

function FunnelStep({ label, value, color, rateLabel, isLast }) {
  return (
    <div>
      <div className="rounded-2xl" style={{ background: '#161616', border: `1px solid ${color}28`, padding: '16px 20px' }}>
        <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#3A3A3A', marginBottom: '6px' }}>{label}</p>
        <p style={{ fontSize: '38px', fontWeight: 800, color, letterSpacing: '-1.5px', lineHeight: 1 }}>{value ?? 0}</p>
      </div>
      {!isLast && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '7px 0 7px 22px' }}>
          <div style={{ width: '2px', height: '22px', background: `linear-gradient(${color}55, #1C1C1C)`, borderRadius: '1px', flexShrink: 0 }} />
          {rateLabel && (
            <span style={{ fontSize: '11px', fontWeight: 600, padding: '4px 10px',
              background: 'rgba(201,168,76,0.07)', border: '1px solid rgba(201,168,76,0.12)',
              borderRadius: '8px', color: '#7A6030' }}>
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
    <div className="rounded-2xl" style={{ background: '#161616', border: '1px solid #252525', padding: '16px' }}>
      <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#3A3A3A', marginBottom: '8px' }}>{label}</p>
      <p style={{ fontSize: '30px', fontWeight: 800, color, letterSpacing: '-1px', lineHeight: 1 }}>
        {value ?? '—'}
        {value != null && unit && (
          <span style={{ fontSize: '13px', fontWeight: 400, marginLeft: '6px', color: color + '88' }}>{unit}</span>
        )}
      </p>
      {sub && <p style={{ fontSize: '10px', color: '#3A3A3A', marginTop: '6px' }}>{sub}</p>}
    </div>
  )
}

function TrainingRow({ label, count, avgVisits, max, color }) {
  const pct = max > 0 ? Math.max((count / max) * 100, count > 0 ? 4 : 0) : 0
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: color, flexShrink: 0, opacity: count > 0 ? 1 : 0.2 }} />
          <span style={{ fontSize: '13px', fontWeight: 500, color: count > 0 ? '#EFEFEF' : '#3A3530' }}>{label}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {avgVisits && count > 0 && (
            <span style={{ fontSize: '10px', fontWeight: 600, padding: '3px 8px',
              background: 'rgba(167,139,250,0.1)', color: '#A78BFA',
              border: '1px solid rgba(167,139,250,0.2)', borderRadius: '99px' }}>
              ~{avgVisits}x vis./venda
            </span>
          )}
          <span style={{ fontSize: '13px', fontWeight: 700, color: count > 0 ? color : '#2A2A2A', minWidth: '16px', textAlign: 'right' }}>{count}</span>
        </div>
      </div>
      <div style={{ height: '5px', borderRadius: '99px', background: '#1A1A1A', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: '99px', opacity: 0.8, transition: 'width 0.5s ease' }} />
      </div>
    </div>
  )
}

function OriginRow({ label, count, max }) {
  const pct = max > 0 ? Math.max((count / max) * 100, count > 0 ? 4 : 0) : 0
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <span style={{ fontSize: '13px', fontWeight: 500, color: count > 0 ? '#EFEFEF' : '#3A3530' }}>{label}</span>
        <span style={{ fontSize: '13px', fontWeight: 700, color: count > 0 ? '#C9A84C' : '#2A2A2A' }}>{count}</span>
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
  const [period, setPeriod]           = useState('month')
  const [customFrom, setCustomFrom]   = useState('')
  const [customTo, setCustomTo]       = useState('')
  const [selectedPerson, setSelectedPerson] = useState('all')
  const [showExportModal, setShowExportModal] = useState(false)
  const [exportScope, setExportScope]         = useState('all')
  const [exportPersonId, setExportPersonId]   = useState(null)
  const [visibleSeries, setVisibleSeries]     = useState({ calls: true, atendidas: false, marcacoes: true, visitas: true, matriculas: false })
  const [credits, setCredits]                 = useState([]) // matricula_credits (comissões)
  const [reschedules, setReschedules]         = useState({}) // client_id → datas das remarcações
  const [view, setView]                       = useState('graficos') // graficos | listas

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

    // Datas das remarcações (p/ o CSV): as colunas do cliente só guardam a
    // primeira e a atual — a lista completa vive no histórico.
    const { data: bookings } = await supabase
      .from('client_history')
      .select('client_id, created_at, event_data')
      .eq('event_type', 'visit_scheduled')
      .order('created_at', { ascending: true })
    const byClient = {}
    for (const b of bookings || []) {
      if (!b.event_data?.from) continue // primeira marcação não é remarcação
      ;(byClient[b.client_id] ||= []).push(b.created_at)
    }
    setReschedules(byClient)

    const { data: profilesData } = await supabase.from('profiles').select('*').order('name')
    setProfiles(profilesData || [])

    let logsQuery = supabase.from('daily_logs').select('calls, answered, appointments, log_date, user_id')
    if (profile?.role !== 'gerente') logsQuery = logsQuery.eq('user_id', user.id)
    const { data: logsData } = await logsQuery
    setDailyLogs(logsData || [])

    // Créditos de matrícula (comissão de quem marcou a visita)
    let credQuery = supabase.from('matricula_credits').select('credited_to, enrolled_by, credit_date, client_id')
    if (profile?.role !== 'gerente') credQuery = credQuery.eq('credited_to', user.id)
    const { data: credData } = await credQuery
    setCredits(credData || [])
    setLoading(false)
  }

  // ── Período ─────────────────────────────────────────────────────

  const periodEnd = (() => {
    if (period === 'custom' && customTo) return new Date(customTo + 'T23:59:59')
    const d = new Date(); d.setHours(23, 59, 59, 999); return d
  })()

  const periodStart = (() => {
    if (period === 'custom') return customFrom ? new Date(customFrom + 'T00:00:00') : null
    const d = new Date(); d.setHours(0, 0, 0, 0)
    if (period === 'week')  d.setDate(d.getDate() - 7)
    if (period === 'month') d.setDate(d.getDate() - 30)
    if (period === 'year')  d.setFullYear(d.getFullYear() - 1)
    return d
  })()

  const periodDays = !periodStart ? 30
    : Math.max(1, Math.ceil((periodEnd - periodStart) / (1000 * 60 * 60 * 24)))

  // ── Filtro por pessoa ────────────────────────────────────────────

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

  // ── Cálculos do período ──────────────────────────────────────────

  const inRange = (d) => {
    if (periodStart && d < periodStart) return false
    if (d > periodEnd) return false
    return true
  }

  const clientsInPeriod  = filteredClients.filter(c => inRange(new Date(c.created_at)))
  const visitsInPeriod   = filteredClients.flatMap(c =>
    (c.visits || []).filter(v => inRange(new Date(v.visit_date + 'T12:00:00')))
  )
  const enrolledInPeriod = clientsInPeriod.filter(c => c.matricula_stage === 'matriculado')
  const noShowsInPeriod  = clientsInPeriod.filter(c => c.matricula_stage === 'nao_apareceu')
  const totalCallsPeriod = filteredLogs
    .filter(l => inRange(new Date(l.log_date + 'T12:00:00')))
    .reduce((s, l) => s + (l.calls || 0), 0)
  const hasCalls = totalCallsPeriod > 0
  const totalAnsweredPeriod = filteredLogs
    .filter(l => inRange(new Date(l.log_date + 'T12:00:00')))
    .reduce((s, l) => s + (l.answered || 0), 0)
  const answerRate = totalCallsPeriod > 0 && totalAnsweredPeriod > 0
    ? Math.round((totalAnsweredPeriod / totalCallsPeriod) * 100) : null

  // Créditos de matrícula no período (comissão de quem marcou a visita)
  const creditsInPeriod = credits.filter(cr => inRange(new Date(cr.credit_date + 'T12:00:00')))
  const filteredCredits = profile?.role === 'gerente' && selectedPerson !== 'all'
    ? creditsInPeriod.filter(cr => cr.credited_to === selectedPerson)
    : creditsInPeriod
  // Contagem por pessoa (visão de comissões do gerente)
  const creditsByPerson = (() => {
    const map = {}
    creditsInPeriod.forEach(cr => { map[cr.credited_to] = (map[cr.credited_to] || 0) + 1 })
    return map
  })()

  // ── All-time ─────────────────────────────────────────────────────

  const allEnrolled = filteredClients.filter(c => c.matricula_stage === 'matriculado')

  // ── Métricas do funil ────────────────────────────────────────────

  const callsPerBooking = hasCalls && clientsInPeriod.length > 0
    ? (totalCallsPeriod / clientsInPeriod.length).toFixed(1) : null
  const bookingShowRate = clientsInPeriod.length > 0 && visitsInPeriod.length > 0
    ? Math.round((visitsInPeriod.length / clientsInPeriod.length) * 100) : null
  const visitConvRate = visitsInPeriod.length > 0
    ? Math.round((enrolledInPeriod.length / visitsInPeriod.length) * 100) : null

  // ── Médias acumuladas ─────────────────────────────────────────────

  const avgVisitsPerEnrollment = (() => {
    const valid = allEnrolled.filter(c => (c.visits || []).length > 0)
    if (!valid.length) return null
    return (valid.reduce((s, c) => s + c.visits.length, 0) / valid.length).toFixed(1)
  })()

  const totalCallsAllTime = filteredLogs.reduce((s, l) => s + (l.calls || 0), 0)
  const callsPerEnrollment = allEnrolled.length > 0 && totalCallsAllTime > 0
    ? Math.round(totalCallsAllTime / allEnrolled.length) : null

  // ── Dados de tendência (gráfico de linha) ─────────────────────────

  const trendData = (() => {
    if (!periodStart) return []
    const allVisits = filteredClients.flatMap(c => c.visits || [])

    if (periodDays > 90) {
      // Vista mensal
      const months = []
      const cur = new Date(periodStart.getFullYear(), periodStart.getMonth(), 1)
      const endM = new Date(periodEnd.getFullYear(), periodEnd.getMonth(), 1)
      while (cur <= endM) { months.push(new Date(cur)); cur.setMonth(cur.getMonth() + 1) }
      return months.map(d => {
        const m  = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        const yr = d.getFullYear() !== new Date().getFullYear()
          ? d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
          : d.toLocaleDateString('pt-BR', { month: 'short' })
        return {
          label:      yr,
          // created_at é timestamp UTC — agrupa pelo dia LOCAL p/ não deslocar registros feitos à noite
          marcacoes:  filteredClients.filter(c => c.created_at && localDateStr(c.created_at).startsWith(m)).length,
          visitas:    allVisits.filter(v => v.visit_date?.startsWith(m)).length,
          calls:      filteredLogs.filter(l => l.log_date?.startsWith(m)).reduce((s, l) => s + (l.calls || 0), 0),
          atendidas:  filteredLogs.filter(l => l.log_date?.startsWith(m)).reduce((s, l) => s + (l.answered || 0), 0),
          matriculas: filteredClients.filter(c => c.matricula_stage === 'matriculado' && c.created_at && localDateStr(c.created_at).startsWith(m)).length,
        }
      })
    }

    // Vista diária
    const days = []
    const cur = new Date(periodStart); cur.setHours(0, 0, 0, 0)
    const endD = new Date(periodEnd);  endD.setHours(23, 59, 59, 999)
    while (cur <= endD) { days.push(new Date(cur)); cur.setDate(cur.getDate() + 1) }
    return days.map(d => {
      const ds    = localDateStr(d)
      const label = periodDays <= 7
        ? d.toLocaleDateString('pt-BR', { weekday: 'short' })
        : d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })
      return {
        label,
        // created_at é timestamp UTC — agrupa pelo dia LOCAL p/ não deslocar registros feitos à noite
        marcacoes:  filteredClients.filter(c => c.created_at && localDateStr(c.created_at) === ds).length,
        visitas:    allVisits.filter(v => v.visit_date === ds).length,
        calls:      filteredLogs.filter(l => l.log_date === ds).reduce((s, l) => s + (l.calls || 0), 0),
        atendidas:  filteredLogs.filter(l => l.log_date === ds).reduce((s, l) => s + (l.answered || 0), 0),
        matriculas: filteredClients.filter(c => c.matricula_stage === 'matriculado' && c.created_at && localDateStr(c.created_at) === ds).length,
      }
    })
  })()

  const trendHasData = trendData.some(d => d.marcacoes > 0 || d.visitas > 0 || d.calls > 0)

  const ALL_SERIES = [
    { key: 'calls',      label: 'Ligações',   color: '#E8834A', data: trendData.map(d => d.calls) },
    { key: 'atendidas',  label: 'Atendidas',  color: '#22D3EE', data: trendData.map(d => d.atendidas) },
    { key: 'marcacoes',  label: 'Marcações',  color: '#60A5FA', data: trendData.map(d => d.marcacoes) },
    { key: 'visitas',    label: 'Visitas',    color: '#A78BFA', data: trendData.map(d => d.visitas) },
    { key: 'matriculas', label: 'Matrículas', color: '#4ADE80', data: trendData.map(d => d.matriculas) },
  ]
  const trendSeries = ALL_SERIES.filter(s => visibleSeries[s.key])
  const trendLabels = trendData.map(d => d.label)

  // ── Heatmaps por dia da semana ─────────────────────────────────────

  const visitsByWeekday = Array(7).fill(0)
  filteredClients.forEach(c => {
    ;(c.visits || []).forEach(v => {
      const day = new Date(v.visit_date + 'T12:00:00').getDay()
      visitsByWeekday[day]++
    })
  })

  const bookingsByWeekday = Array(7).fill(0)
  clientsInPeriod.forEach(c => {
    const day = new Date(c.created_at).getDay()
    bookingsByWeekday[day]++
  })

  // ── Por treinamento (all-time) ─────────────────────────────────────

  const trainingStats = TRAININGS.map(t => {
    const enrolled  = allEnrolled.filter(c => (c.matriculas || []).includes(t))
    const withVisits = enrolled.filter(c => (c.visits || []).length > 0)
    const avgVisits = withVisits.length > 0
      ? (withVisits.reduce((s, c) => s + c.visits.length, 0) / withVisits.length).toFixed(1)
      : null
    return { label: t, count: enrolled.length, avgVisits, color: TRAINING_COLORS[t] }
  })
  const maxTraining = Math.max(...trainingStats.map(t => t.count), 1)

  const donutSegments = TRAININGS.map(t => ({
    label: t,
    value: allEnrolled.filter(c => (c.matriculas || []).includes(t)).length,
    color: TRAINING_COLORS[t],
  }))

  // ── Por origem (all-time) ──────────────────────────────────────────

  const originStats = ORIGINS.map(o => ({
    label: o.label, key: o.key,
    count: allEnrolled.filter(c => c.origin === o.key).length,
  }))
  const maxOrigin = Math.max(...originStats.map(o => o.count), 1)

  // ── Ranking da equipe ──────────────────────────────────────────────

  const teamStats = profiles
    .filter(p => p.role !== 'gerente')
    .map(p => {
      const mc = p.role === 'pre_vendas'
        ? clients.filter(c => c.created_by === p.id)
        : clients.filter(c => c.assigned_to === p.id || c.created_by === p.id)
      const inPeriod   = mc.filter(c => inRange(new Date(c.created_at)))
      const visits     = mc.flatMap(c => (c.visits || []).filter(v => inRange(new Date(v.visit_date + 'T12:00:00'))))
      const matriculas = mc.filter(c => c.matricula_stage === 'matriculado')
      const logsInRange = dailyLogs.filter(l => l.user_id === p.id && inRange(new Date(l.log_date + 'T12:00:00')))
      const calls      = logsInRange.reduce((s, l) => s + (l.calls || 0), 0)
      const atendidas  = logsInRange.reduce((s, l) => s + (l.answered || 0), 0)
      const withV = matriculas.filter(c => (c.visits || []).length > 0)
      const avgV  = withV.length > 0
        ? (withV.reduce((s, c) => s + c.visits.length, 0) / withV.length).toFixed(1)
        : null
      return {
        ...p,
        marcacoes:  inPeriod.length,
        visitas:    visits.length,
        matriculas: matriculas.length,
        ligacoes:   calls,
        atendidas,
        creditos:   creditsByPerson[p.id] || 0, // matrículas de clientes marcados por ela (comissão)
        avgVisits:  avgV,
        convRate:   visits.length > 0 ? Math.round((matriculas.length / visits.length) * 100) : null,
      }
    })

  // ── Exportar relatório ─────────────────────────────────────────────

  function handleExport() {
    let exportProfiles = []
    if (exportScope === 'all') {
      exportProfiles = profiles.filter(p => p.role !== 'gerente')
    } else if (exportScope === 'pre_vendas') {
      exportProfiles = profiles.filter(p => p.role === 'pre_vendas')
    } else if (exportScope === 'vendedores') {
      exportProfiles = profiles.filter(p => p.role === 'vendedor')
    } else if (exportScope === 'individual') {
      const person = exportPersonId ? profiles.find(p => p.id === exportPersonId) : null
      exportProfiles = person ? [person] : []
    }
    if (!exportProfiles.length) return

    const members = exportProfiles.map(p => {
      const memberClients = p.role === 'pre_vendas'
        ? clients.filter(c => c.created_by === p.id)
        : clients.filter(c => c.assigned_to === p.id || c.created_by === p.id)
      const logs = dailyLogs.filter(l => l.user_id === p.id)
      // matrículas de clientes que a pessoa marcou (comissão), no período
      const creditos = credits.filter(cr => cr.credited_to === p.id && inRange(new Date(cr.credit_date + 'T12:00:00'))).length
      return { ...p, memberClients, logs, creditos }
    })

    const fmtDate = (s) => s ? new Date(s + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : ''
    const pLabel = period === 'week'  ? 'Últimos 7 dias'
      : period === 'month' ? 'Últimos 30 dias'
      : period === 'year'  ? 'Últimos 12 meses'
      : customFrom && customTo ? `${fmtDate(customFrom)} a ${fmtDate(customTo)}`
      : customFrom ? `A partir de ${fmtDate(customFrom)}`
      : 'Período personalizado'

    const html = generateReportHTML({
      scope:       exportScope,
      members,
      periodDays:  periodDays,
      periodStart,
      periodLabel: pLabel,
      exportedBy:  profile?.name || 'Gerente',
    })

    const win = window.open('', '_blank')
    if (win) { win.document.write(html); win.document.close() }
    setShowExportModal(false)
  }

  // ── Render ─────────────────────────────────────────────────────────

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '64px 0' }}>
      <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid #C9A84C',
        borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
    </div>
  )

  const selectedProfile = profiles.find(p => p.id === selectedPerson)

  return (
    <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', color: '#C9A84C', marginBottom: '4px' }}>
            Analise
          </p>
          <h1 style={{ color: '#EFEFEF' }}>Relatorios</h1>
          {selectedProfile && (
            <p style={{ fontSize: '13px', fontWeight: 500, color: '#C9A84C', marginTop: '4px' }}>
              {selectedProfile.name} · {ROLE_LABELS[selectedProfile.role]}
            </p>
          )}
        </div>
        {profile?.role === 'gerente' && view === 'graficos' && (
          <button
            onClick={() => setShowExportModal(true)}
            style={{
              marginTop: '4px', padding: '10px 16px', borderRadius: '12px', cursor: 'pointer',
              background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.25)',
              color: '#C9A84C', fontSize: '13px', fontWeight: 700,
              display: 'flex', alignItems: 'center', gap: '7px', flexShrink: 0,
            }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Exportar
          </button>
        )}
      </div>

      {/* Seletor de modo: Gráficos | Listas */}
      <div style={{ display: 'flex', padding: '4px', borderRadius: '12px', gap: '4px', background: '#161616', border: '1px solid #252525' }}>
        {[['graficos', 'Gráficos'], ['listas', 'Listas']].map(([k, l]) => (
          <button key={k} onClick={() => setView(k)}
            style={{
              flex: 1, padding: '10px', borderRadius: '10px', fontSize: '14px', fontWeight: 600, cursor: 'pointer',
              background: view === k ? 'rgba(201,168,76,0.12)' : 'transparent',
              color:      view === k ? '#C9A84C' : '#6B6560',
              border:     view === k ? '1px solid rgba(201,168,76,0.2)' : '1px solid transparent',
            }}>
            {l}
          </button>
        ))}
      </div>

      {view === 'listas' && (
        <RelatoriosListas clients={clients} profiles={profiles} role={profile?.role} reschedules={reschedules} />
      )}

      {view === 'graficos' && (<>

      {/* ── Filtro de período ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', padding: '4px', borderRadius: '12px', gap: '4px', background: '#161616', border: '1px solid #252525' }}>
          {PERIODS.map(p => {
            const active = period === p.key
            return (
              <button key={p.key}
                onClick={() => setPeriod(p.key)}
                style={{
                  flex: 1, padding: '10px', borderRadius: '10px', fontSize: '14px', fontWeight: 600,
                  background: active ? 'rgba(201,168,76,0.12)' : 'transparent',
                  color:      active ? '#C9A84C' : '#6B6560',
                  border:     active ? '1px solid rgba(201,168,76,0.2)' : '1px solid transparent',
                }}>
                {p.label}
              </button>
            )
          })}
          <button
            onClick={() => setPeriod('custom')}
            style={{
              flex: 1, padding: '10px', borderRadius: '10px', fontSize: '14px', fontWeight: 600,
              background: period === 'custom' ? 'rgba(201,168,76,0.12)' : 'transparent',
              color:      period === 'custom' ? '#C9A84C' : '#6B6560',
              border:     period === 'custom' ? '1px solid rgba(201,168,76,0.2)' : '1px solid transparent',
            }}>
            Datas
          </button>
        </div>

        {period === 'custom' && (
          <div style={{ display: 'flex', gap: '10px' }}>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#444040', marginBottom: '6px' }}>De</p>
              <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                style={{
                  width: '100%', background: '#161616', border: '1px solid #252525',
                  borderRadius: '12px', padding: '10px 12px', color: customFrom ? '#EFEFEF' : '#6B6560',
                  fontSize: '13px', outline: 'none',
                }}
                onFocus={e => e.target.style.borderColor = 'rgba(201,168,76,0.4)'}
                onBlur={e  => e.target.style.borderColor = '#252525'}
              />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#444040', marginBottom: '6px' }}>Até</p>
              <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                style={{
                  width: '100%', background: '#161616', border: '1px solid #252525',
                  borderRadius: '12px', padding: '10px 12px', color: customTo ? '#EFEFEF' : '#6B6560',
                  fontSize: '13px', outline: 'none',
                }}
                onFocus={e => e.target.style.borderColor = 'rgba(201,168,76,0.4)'}
                onBlur={e  => e.target.style.borderColor = '#252525'}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Filtro por pessoa (gerente) ── */}
      {profile?.role === 'gerente' && profiles.length > 0 && (
        <div>
          <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#333030', marginBottom: '10px' }}>
            Ver dados de
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {[{ id: 'all', name: 'Equipe toda', role: null }, ...profiles.filter(p => p.role !== 'gerente')].map(p => (
              <button key={p.id} onClick={() => setSelectedPerson(p.id)}
                style={{
                  padding: '8px 14px', borderRadius: '12px', fontSize: '12px', fontWeight: 600,
                  background: selectedPerson === p.id ? 'rgba(201,168,76,0.12)' : '#161616',
                  border: `1px solid ${selectedPerson === p.id ? 'rgba(201,168,76,0.35)' : '#252525'}`,
                  color: selectedPerson === p.id ? '#C9A84C' : '#6B6560',
                }}>
                {p.role ? `${p.name?.split(' ')[0]} · ${ROLE_LABELS[p.role]}` : p.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Gráfico de tendência ── */}
      <div className="rounded-2xl" style={{ background: '#161616', border: '1px solid #252525', padding: '18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
          <div>
            <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#333030', marginBottom: '4px' }}>
              Tendencia
            </p>
            <p style={{ fontSize: '11px', color: '#2A2A2A' }}>
              {period === 'week'  ? 'últimos 7 dias'
               : period === 'month' ? 'últimos 30 dias'
               : period === 'year'  ? 'últimos 12 meses'
               : customFrom && customTo
                 ? `${new Date(customFrom+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})} – ${new Date(customTo+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})}`
                 : customFrom ? `a partir de ${new Date(customFrom+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})}` : 'personalizado'}
            </p>
          </div>
          {/* Toggle chips */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', alignItems: 'flex-end' }}>
            {ALL_SERIES.map(s => {
              const on = visibleSeries[s.key]
              return (
                <button key={s.key}
                  onClick={() => setVisibleSeries(v => ({ ...v, [s.key]: !v[s.key] }))}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '5px',
                    background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0',
                    opacity: on ? 1 : 0.3,
                  }}>
                  <div style={{ width: '20px', height: '2.5px', background: s.color, borderRadius: '1px' }} />
                  <span style={{ fontSize: '9px', fontWeight: 700, color: on ? s.color : '#3A3A3A', letterSpacing: '0.04em' }}>
                    {s.label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
        {trendSeries.length > 0 && trendHasData
          ? <TrendChart series={trendSeries} labels={trendLabels} />
          : <p style={{ fontSize: '12px', color: '#2A2A2A', textAlign: 'center', padding: '24px 0' }}>Nenhuma série selecionada</p>
        }
      </div>

      {/* ── Funil de conversão ── */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#333030' }}>
            Funil de conversao
          </p>
          <p style={{ fontSize: '10px', color: '#2A2A2A' }}>periodo selecionado</p>
        </div>
        <div>
          {hasCalls && (
            <FunnelStep label="Ligacoes feitas" value={totalCallsPeriod} color="#E8834A"
              rateLabel={callsPerBooking ? `${callsPerBooking} lig. por marcacao` : null} />
          )}
          {totalAnsweredPeriod > 0 && (
            <FunnelStep label="Ligacoes atendidas" value={totalAnsweredPeriod} color="#22D3EE"
              rateLabel={answerRate !== null ? `${answerRate}% das ligacoes` : null} />
          )}
          <FunnelStep label="Marcacoes feitas" value={clientsInPeriod.length} color="#60A5FA"
            rateLabel={bookingShowRate !== null ? `${bookingShowRate}% compareceram` : null} />
          <FunnelStep label="Visitas realizadas" value={visitsInPeriod.length} color="#A78BFA"
            rateLabel={visitConvRate !== null ? `${visitConvRate}% viraram matricula` : null} />
          <FunnelStep label="Matriculas fechadas" value={enrolledInPeriod.length} color="#4ADE80" isLast />
        </div>
      </div>

      {/* ── Comissões: matrículas por quem marcou a visita ── */}
      {profile?.role === 'gerente' ? (
        creditsInPeriod.length > 0 && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#333030' }}>
                🎓 Comissoes — matriculas por marcador
              </p>
              <p style={{ fontSize: '10px', color: '#2A2A2A' }}>periodo selecionado</p>
            </div>
            <div className="rounded-2xl" style={{ background: '#161616', border: '1px solid #252525', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {(() => {
                const rows = Object.entries(creditsByPerson)
                  .map(([pid, count]) => ({ p: profiles.find(x => x.id === pid), count }))
                  .filter(r => r.p)
                  .sort((a, b) => b.count - a.count)
                const maxC = Math.max(...rows.map(r => r.count), 1)
                return rows.map(({ p, count }) => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ width: '90px', flexShrink: 0, fontSize: '12px', fontWeight: 600, color: '#B0A99F' }} className="truncate">
                      {p.name?.split(' ')[0] || '—'}
                    </span>
                    <div style={{ flex: 1, height: '8px', borderRadius: '99px', background: '#111' }}>
                      <div style={{ width: `${Math.round((count / maxC) * 100)}%`, height: '100%', borderRadius: '99px', background: 'linear-gradient(90deg, #7B1C3A, #C9A84C)' }} />
                    </div>
                    <span style={{ width: '28px', textAlign: 'right', fontSize: '15px', fontWeight: 800, color: '#C9A84C' }} className="tabular-nums">{count}</span>
                  </div>
                ))
              })()}
              <p style={{ fontSize: '10px', color: '#444040', marginTop: '2px' }}>
                Matrícula conta para quem marcou a visita atual do cliente (remarcou → de quem remarcou).
              </p>
            </div>
          </div>
        )
      ) : (
        <div className="rounded-2xl" style={{ background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.18)', padding: '16px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontSize: '13px', fontWeight: 600, color: '#EFEFEF' }}>🎓 Matrículas das suas marcações</p>
            <p style={{ fontSize: '11px', color: '#6B6560', marginTop: '2px' }}>clientes que você marcou e matricularam · período selecionado</p>
          </div>
          <span className="tabular-nums" style={{ fontSize: '26px', fontWeight: 800, color: '#C9A84C' }}>{filteredCredits.length}</span>
        </div>
      )}

      {/* ── Eficiência ── */}
      {(avgVisitsPerEnrollment || callsPerEnrollment || noShowsInPeriod.length > 0) && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#333030' }}>
              Eficiencia media
            </p>
            <p style={{ fontSize: '10px', color: '#2A2A2A' }}>acumulado</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {avgVisitsPerEnrollment && (
              <RatioCard label="Visitas por matricula" value={avgVisitsPerEnrollment} unit="vis."
                color="#A78BFA" sub="media ate fechar venda" />
            )}
            {callsPerEnrollment && (
              <RatioCard label="Ligacoes por matricula" value={callsPerEnrollment} unit="lig."
                color="#E8834A" sub="media total de contatos" />
            )}
            {callsPerBooking && (
              <RatioCard label="Ligacoes por marcacao" value={callsPerBooking} unit="lig."
                color="#60A5FA" sub="no periodo selecionado" />
            )}
            <RatioCard label="Nao apareceu" value={noShowsInPeriod.length} unit="" color="#E85555"
              sub={clientsInPeriod.length > 0 && noShowsInPeriod.length > 0
                ? `${Math.round((noShowsInPeriod.length / clientsInPeriod.length) * 100)}% das marcacoes`
                : 'no periodo'} />
          </div>
        </div>
      )}

      {/* ── Heatmap dia da semana ── */}
      {(visitsInPeriod.length > 0 || clientsInPeriod.length > 0) && (
        <div className="rounded-2xl" style={{ background: '#161616', border: '1px solid #252525', padding: '18px' }}>
          <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#333030', marginBottom: '20px' }}>
            Ritmo por dia da semana
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            <div>
              <p style={{ fontSize: '10px', fontWeight: 700, color: '#A78BFA', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '12px' }}>
                Visitas
              </p>
              <WeekChart data={visitsByWeekday} color="#A78BFA" emptyText="Nenhuma visita ainda" />
            </div>
            <div>
              <p style={{ fontSize: '10px', fontWeight: 700, color: '#60A5FA', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '12px' }}>
                Marcacoes
              </p>
              <WeekChart data={bookingsByWeekday} color="#60A5FA" emptyText="Nenhuma marcacao ainda" />
            </div>
          </div>
        </div>
      )}

      {/* ── Por treinamento ── */}
      <div className="rounded-2xl" style={{ background: '#161616', border: '1px solid #252525', padding: '18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#333030' }}>
            Mix de matriculas
          </p>
          <p style={{ fontSize: '10px', color: '#2A2A2A' }}>acumulado</p>
        </div>

        {allEnrolled.length === 0 ? (
          <p style={{ fontSize: '12px', textAlign: 'center', color: '#2A2A2A', padding: '16px 0' }}>Nenhuma matricula registrada</p>
        ) : (
          <>
            {/* Donut chart */}
            <div style={{ marginBottom: '24px' }}>
              <DonutChart segments={donutSegments} />
            </div>

            {/* Divider */}
            <div style={{ height: '1px', background: '#1E1E1E', marginBottom: '20px' }} />

            {/* Bars com avg visitas */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {[...trainingStats].sort((a, b) => b.count - a.count).map(t => (
                <TrainingRow key={t.label} label={t.label} count={t.count}
                  avgVisits={t.avgVisits} max={maxTraining} color={t.color} />
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── Por origem ── */}
      <div className="rounded-2xl" style={{ background: '#161616', border: '1px solid #252525', padding: '18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#333030' }}>
            Matriculas por origem
          </p>
          <p style={{ fontSize: '10px', color: '#2A2A2A' }}>acumulado</p>
        </div>
        {allEnrolled.length === 0 ? (
          <p style={{ fontSize: '12px', textAlign: 'center', color: '#2A2A2A', padding: '16px 0' }}>Nenhuma matricula registrada</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {[...originStats].sort((a, b) => b.count - a.count).map(o => (
              <OriginRow key={o.key} label={o.label} count={o.count} max={maxOrigin} />
            ))}
          </div>
        )}
      </div>

      {/* ── Avaliação de visitas ── */}
      {(() => {
        const allVisits = filteredClients.flatMap(c => c.visits || []).filter(v => inRange(new Date(v.visit_date + 'T12:00:00')))
        const ratingDefs = [
          { key: 'pessima',  label: 'Péssima',  color: '#E85555' },
          { key: 'razoavel', label: 'Razoável', color: '#E8834A' },
          { key: 'boa',      label: 'Boa',      color: '#60A5FA' },
          { key: 'otima',    label: 'Ótima',    color: '#4ADE80' },
        ]
        const counts = ratingDefs.map(r => ({ ...r, count: allVisits.filter(v => v.rating === r.key).length }))
        const rated  = allVisits.filter(v => v.rating).length
        const maxCount = Math.max(...counts.map(r => r.count), 1)
        if (allVisits.length === 0) return null
        return (
          <div className="rounded-2xl" style={{ background: '#161616', border: '1px solid #252525', padding: '18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#333030' }}>
                Avaliação de visitas
              </p>
              <p style={{ fontSize: '10px', color: '#2A2A2A' }}>{rated} de {allVisits.length} avaliadas</p>
            </div>
            {rated === 0 ? (
              <p style={{ fontSize: '12px', textAlign: 'center', color: '#2A2A2A', padding: '8px 0' }}>Nenhuma visita avaliada ainda</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {counts.map(r => {
                  const pct = maxCount > 0 ? Math.max((r.count / maxCount) * 100, r.count > 0 ? 4 : 0) : 0
                  return (
                    <div key={r.key}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 500, color: r.count > 0 ? '#EFEFEF' : '#3A3530' }}>{r.label}</span>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: r.count > 0 ? r.color : '#2A2A2A' }}>{r.count}</span>
                      </div>
                      <div style={{ height: '5px', borderRadius: '99px', background: '#1A1A1A', overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: r.color, borderRadius: '99px', transition: 'width 0.5s ease' }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })()}

      {/* ── Modal de exportação ── */}
      {showExportModal && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setShowExportModal(false) }}
          style={{
            position: 'fixed', inset: 0, zIndex: 100,
            background: 'rgba(0,0,0,0.88)',
            display: 'flex', alignItems: 'flex-end', padding: '12px',
          }}>
          <div style={{
            width: '100%', background: '#0E0E0E', borderRadius: '20px',
            border: '1px solid #252525', overflow: 'hidden',
            maxHeight: '92vh', overflowY: 'auto',
          }}>
            {/* Modal header */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '20px 20px 0',
            }}>
              <p style={{ fontSize: '16px', fontWeight: 700, color: '#EFEFEF' }}>Exportar Relatório</p>
              <button onClick={() => setShowExportModal(false)}
                style={{ background: 'none', border: 'none', color: '#6B6560', fontSize: '22px', cursor: 'pointer', lineHeight: 1, padding: '0 4px' }}>
                ✕
              </button>
            </div>

            <div style={{ padding: '16px 20px 24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>

              {/* Período atual */}
              <div style={{
                background: '#161616', borderRadius: '12px', padding: '12px 16px',
                border: '1px solid #252525',
              }}>
                <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#3A3A3A', marginBottom: '4px' }}>
                  Período do relatório
                </p>
                <p style={{ fontSize: '14px', fontWeight: 600, color: '#C9A84C' }}>
                  {period === 'week'  ? 'Últimos 7 dias'
                   : period === 'month' ? 'Últimos 30 dias'
                   : period === 'year'  ? 'Últimos 12 meses'
                   : customFrom || customTo
                     ? `${customFrom || '...'} a ${customTo || 'hoje'}`
                     : 'Personalizado'}
                </p>
                <p style={{ fontSize: '11px', color: '#3A3A3A', marginTop: '2px' }}>
                  Ajuste o filtro de período antes de exportar
                </p>
              </div>

              {/* Escopo */}
              <div>
                <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#3A3A3A', marginBottom: '10px' }}>
                  Exportar dados de
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {[
                    { key: 'all',        label: 'Equipe completa',   sub: 'Todos os vendedores e pré-vendas' },
                    { key: 'vendedores', label: 'Vendedores',         sub: 'Apenas a equipe de vendas' },
                    { key: 'pre_vendas', label: 'Pré-vendas',         sub: 'Apenas a equipe de pré-vendas' },
                    { key: 'individual', label: 'Pessoa individual',  sub: 'Selecionar uma pessoa específica' },
                  ].map(opt => (
                    <button key={opt.key} onClick={() => setExportScope(opt.key)}
                      style={{
                        padding: '12px 16px', borderRadius: '12px', textAlign: 'left', cursor: 'pointer',
                        background: exportScope === opt.key ? 'rgba(201,168,76,0.08)' : '#161616',
                        border: `1px solid ${exportScope === opt.key ? 'rgba(201,168,76,0.35)' : '#252525'}`,
                      }}>
                      <p style={{ fontSize: '13px', fontWeight: 600, color: exportScope === opt.key ? '#C9A84C' : '#EFEFEF' }}>
                        {opt.label}
                      </p>
                      <p style={{ fontSize: '11px', color: '#6B6560', marginTop: '2px' }}>{opt.sub}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Seletor de pessoa */}
              {exportScope === 'individual' && (
                <div>
                  <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#3A3A3A', marginBottom: '10px' }}>
                    Pessoa
                  </p>
                  <select
                    value={exportPersonId || ''}
                    onChange={e => setExportPersonId(e.target.value || null)}
                    style={{
                      width: '100%', background: '#161616', border: '1px solid #252525',
                      borderRadius: '12px', padding: '13px 16px', color: exportPersonId ? '#EFEFEF' : '#6B6560',
                      fontSize: '14px', outline: 'none', appearance: 'none',
                    }}>
                    <option value="">Selecionar pessoa...</option>
                    {profiles.filter(p => p.role !== 'gerente').map(p => (
                      <option key={p.id} value={p.id}>{p.name} — {ROLE_LABELS[p.role]}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Botão gerar */}
              <button
                onClick={handleExport}
                disabled={exportScope === 'individual' && !exportPersonId}
                style={{
                  width: '100%', padding: '15px', borderRadius: '14px', cursor: exportScope === 'individual' && !exportPersonId ? 'not-allowed' : 'pointer',
                  background: exportScope === 'individual' && !exportPersonId
                    ? 'rgba(201,168,76,0.03)'
                    : 'linear-gradient(135deg, rgba(123,28,58,0.35), rgba(201,168,76,0.22))',
                  border: `1px solid ${exportScope === 'individual' && !exportPersonId ? '#252525' : 'rgba(201,168,76,0.35)'}`,
                  color: exportScope === 'individual' && !exportPersonId ? '#3A3A3A' : '#C9A84C',
                  fontSize: '15px', fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Gerar relatório
              </button>

              <p style={{ fontSize: '11px', color: '#2A2A2A', textAlign: 'center', lineHeight: 1.5 }}>
                Abre em nova aba · imprima ou salve como PDF
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Ranking da equipe (gerente, visão geral) ── */}
      {profile?.role === 'gerente' && selectedPerson === 'all' && teamStats.length > 0 && (
        <div>
          <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#333030', marginBottom: '12px' }}>
            Ranking da equipe
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[...teamStats].sort((a, b) => b.matriculas - a.matriculas).map((m, rank) => (
              <button key={m.id} onClick={() => setSelectedPerson(m.id)}
                className="rounded-2xl text-left w-full"
                style={{ background: '#161616', border: '1px solid #252525', padding: '16px 18px' }}>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  {/* Rank badge */}
                  <div style={{ width: '22px', height: '22px', borderRadius: '8px', flexShrink: 0,
                    background: rank === 0 ? 'rgba(201,168,76,0.15)' : '#111',
                    border: `1px solid ${rank === 0 ? 'rgba(201,168,76,0.4)' : '#252525'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '11px', fontWeight: 800, color: rank === 0 ? '#C9A84C' : '#3A3A3A' }}>
                    {rank + 1}
                  </div>
                  <div style={{ width: '34px', height: '34px', borderRadius: '12px', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700,
                    background: 'rgba(201,168,76,0.08)', color: '#C9A84C', border: '1px solid rgba(201,168,76,0.15)',
                    fontSize: '14px' }}>
                    {m.name?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '13px', fontWeight: 600, color: '#EFEFEF' }}>{m.name || 'Sem nome'}</p>
                    <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#444040' }}>
                      {ROLE_LABELS[m.role] || m.role}
                    </p>
                  </div>
                  {m.convRate !== null && m.visitas > 0 && (
                    <span style={{ fontSize: '12px', fontWeight: 700, padding: '4px 10px',
                      background: 'rgba(74,222,128,0.08)', color: '#4ADE80',
                      border: '1px solid rgba(74,222,128,0.18)', borderRadius: '10px' }}>
                      {m.convRate}% conv.
                    </span>
                  )}
                </div>

                {/* Mini trend de matrículas para o membro */}
                {(() => {
                  const tiles = [
                    ...(m.ligacoes  > 0 ? [{ l: 'Lig.',   v: m.ligacoes,  c: '#E8834A' }] : []),
                    ...(m.atendidas > 0 ? [{ l: 'Atend.', v: m.atendidas, c: '#22D3EE' }] : []),
                    { l: 'Marc.',  v: m.marcacoes,  c: '#60A5FA' },
                    { l: 'Vis.',   v: m.visitas,    c: '#A78BFA' },
                    { l: 'Mat.',   v: m.matriculas, c: '#4ADE80' },
                    ...(m.creditos > 0 ? [{ l: 'Comis.', v: m.creditos, c: '#C9A84C' }] : []),
                  ]
                  return (
                    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${tiles.length}, 1fr)`, gap: '6px', marginBottom: 8 }}>
                      {tiles.map(s => (
                        <div key={s.l} style={{ borderRadius: '10px', textAlign: 'center', background: '#111', padding: '9px 4px' }}>
                          <p style={{ fontSize: '18px', fontWeight: 800, color: s.c, lineHeight: 1 }}>{s.v}</p>
                          <p style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#333030', marginTop: '3px' }}>{s.l}</p>
                        </div>
                      ))}
                    </div>
                  )
                })()}

                <p style={{ fontSize: '10px', fontWeight: 500, color: '#2A2A2A', textAlign: 'center' }}>
                  {m.avgVisits
                    ? `~${m.avgVisits} visitas por matricula · toque para detalhar`
                    : 'Toque para detalhar'}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      </>)}

    </div>
  )
}

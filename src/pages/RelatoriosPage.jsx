import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

// ── Constantes ─────────────────────────────────────────────────────

const TRAININGS = ['Impacto', 'Perfil', 'Vendas', 'LORAP', 'Academia Vithall']
const TRAINING_COLORS = {
  'Impacto':          '#E85555',
  'Perfil':           '#E8834A',
  'Vendas':           '#C9A84C',
  'LORAP':            '#4ADE80',
  'Academia Vithall': '#60A5FA',
}
const ORIGINS = [
  { key: 'frias contatinhos', label: 'Frias contatinhos' },
  { key: 'frias listas',      label: 'Frias listas' },
  { key: 'lead',              label: 'Lead' },
  { key: 'feiras',            label: 'Feiras' },
  { key: 'indicacao',         label: 'Indicacao' },
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

    let logsQuery = supabase.from('daily_logs').select('calls, appointments, log_date, user_id')
    if (profile?.role !== 'gerente') logsQuery = logsQuery.eq('user_id', user.id)
    const { data: logsData } = await logsQuery
    setDailyLogs(logsData || [])
    setLoading(false)
  }

  // ── Período ─────────────────────────────────────────────────────

  const periodStart = new Date()
  periodStart.setDate(periodStart.getDate() - period)
  periodStart.setHours(0, 0, 0, 0)

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

  const clientsInPeriod  = filteredClients.filter(c => new Date(c.created_at) >= periodStart)
  const visitsInPeriod   = filteredClients.flatMap(c =>
    (c.visits || []).filter(v => new Date(v.visit_date + 'T12:00:00') >= periodStart)
  )
  const enrolledInPeriod = clientsInPeriod.filter(c => c.matricula_stage === 'matriculado')
  const noShowsInPeriod  = clientsInPeriod.filter(c => c.matricula_stage === 'nao_apareceu')
  const totalCallsPeriod = filteredLogs
    .filter(l => new Date(l.log_date + 'T12:00:00') >= periodStart)
    .reduce((s, l) => s + (l.calls || 0), 0)
  const hasCalls = totalCallsPeriod > 0

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
    if (period === 365) {
      return Array.from({ length: 12 }, (_, i) => {
        const d = new Date()
        d.setDate(1)
        d.setMonth(d.getMonth() - (11 - i))
        const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        return {
          label: d.toLocaleDateString('pt-BR', { month: 'short' }),
          marcacoes: filteredClients.filter(c => c.created_at?.startsWith(m)).length,
          visitas:   filteredClients.flatMap(c => c.visits || []).filter(v => v.visit_date?.startsWith(m)).length,
          calls:     filteredLogs.filter(l => l.log_date?.startsWith(m)).reduce((s, l) => s + (l.calls || 0), 0),
        }
      })
    }
    return Array.from({ length: period }, (_, i) => {
      const d = new Date()
      d.setDate(d.getDate() - (period - 1 - i))
      const ds = d.toISOString().split('T')[0]
      const monthLabel = period === 7
        ? d.toLocaleDateString('pt-BR', { weekday: 'short' })
        : d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })
      return {
        label:     monthLabel,
        marcacoes: filteredClients.filter(c => c.created_at?.startsWith(ds)).length,
        visitas:   filteredClients.flatMap(c => c.visits || []).filter(v => v.visit_date === ds).length,
        calls:     filteredLogs.filter(l => l.log_date === ds).reduce((s, l) => s + (l.calls || 0), 0),
      }
    })
  })()

  const trendHasData = trendData.some(d => d.marcacoes > 0 || d.visitas > 0 || d.calls > 0)

  const trendSeries = [
    ...(trendData.some(d => d.calls > 0)
      ? [{ key: 'calls', label: 'Ligacoes', color: '#E8834A', data: trendData.map(d => d.calls) }]
      : []),
    { key: 'marcacoes', label: 'Marcacoes', color: '#60A5FA', data: trendData.map(d => d.marcacoes) },
    { key: 'visitas',   label: 'Visitas',   color: '#A78BFA', data: trendData.map(d => d.visitas) },
  ]
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
      const inPeriod   = mc.filter(c => new Date(c.created_at) >= periodStart)
      const visits     = mc.flatMap(c => (c.visits || []).filter(v => new Date(v.visit_date + 'T12:00:00') >= periodStart))
      const matriculas = mc.filter(c => c.matricula_stage === 'matriculado')
      const calls      = dailyLogs
        .filter(l => l.user_id === p.id && new Date(l.log_date + 'T12:00:00') >= periodStart)
        .reduce((s, l) => s + (l.calls || 0), 0)
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
        avgVisits:  avgV,
        convRate:   visits.length > 0 ? Math.round((matriculas.length / visits.length) * 100) : null,
      }
    })

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

      {/* ── Filtro de período ── */}
      <div style={{ display: 'flex', padding: '4px', borderRadius: '12px', gap: '4px', background: '#161616', border: '1px solid #252525' }}>
        {PERIODS.map(p => (
          <button key={p.key} onClick={() => setPeriod(p.key)}
            style={{
              flex: 1, padding: '10px', borderRadius: '10px', fontSize: '14px', fontWeight: 600,
              background: period === p.key ? 'rgba(201,168,76,0.12)' : 'transparent',
              color:      period === p.key ? '#C9A84C' : '#6B6560',
              border:     period === p.key ? '1px solid rgba(201,168,76,0.2)' : '1px solid transparent',
            }}>
            {p.label}
          </button>
        ))}
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
      {trendHasData && (
        <div className="rounded-2xl" style={{ background: '#161616', border: '1px solid #252525', padding: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <div>
              <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#333030', marginBottom: '4px' }}>
                Tendencia
              </p>
              <p style={{ fontSize: '11px', color: '#2A2A2A' }}>
                {period === 365 ? 'ultimos 12 meses' : period === 7 ? 'ultimos 7 dias' : 'ultimos 30 dias'}
              </p>
            </div>
            {/* Legend */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', alignItems: 'flex-end' }}>
              {trendSeries.map(s => (
                <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <div style={{ width: '20px', height: '2px', background: s.color, borderRadius: '1px' }} />
                  <span style={{ fontSize: '9px', fontWeight: 600, color: '#3A3A3A' }}>{s.label}</span>
                </div>
              ))}
            </div>
          </div>
          <TrendChart series={trendSeries} labels={trendLabels} />
        </div>
      )}

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
          <FunnelStep label="Marcacoes feitas" value={clientsInPeriod.length} color="#60A5FA"
            rateLabel={bookingShowRate !== null ? `${bookingShowRate}% compareceram` : null} />
          <FunnelStep label="Visitas realizadas" value={visitsInPeriod.length} color="#A78BFA"
            rateLabel={visitConvRate !== null ? `${visitConvRate}% viraram matricula` : null} />
          <FunnelStep label="Matriculas fechadas" value={enrolledInPeriod.length} color="#4ADE80" isLast />
        </div>
      </div>

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
                <div style={{ display: 'grid', gridTemplateColumns: m.ligacoes > 0 ? '1fr 1fr 1fr 1fr' : '1fr 1fr 1fr', gap: '6px', marginBottom: 8 }}>
                  {m.ligacoes > 0 && (
                    <div style={{ borderRadius: '10px', textAlign: 'center', background: '#111', padding: '9px 4px' }}>
                      <p style={{ fontSize: '18px', fontWeight: 800, color: '#E8834A', lineHeight: 1 }}>{m.ligacoes}</p>
                      <p style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#333030', marginTop: '3px' }}>Lig.</p>
                    </div>
                  )}
                  {[
                    { l: 'Marc.', v: m.marcacoes,  c: '#60A5FA' },
                    { l: 'Vis.',  v: m.visitas,    c: '#A78BFA' },
                    { l: 'Mat.',  v: m.matriculas, c: '#4ADE80' },
                  ].map(s => (
                    <div key={s.l} style={{ borderRadius: '10px', textAlign: 'center', background: '#111', padding: '9px 4px' }}>
                      <p style={{ fontSize: '18px', fontWeight: 800, color: s.c, lineHeight: 1 }}>{s.v}</p>
                      <p style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#333030', marginTop: '3px' }}>{s.l}</p>
                    </div>
                  ))}
                </div>

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

    </div>
  )
}

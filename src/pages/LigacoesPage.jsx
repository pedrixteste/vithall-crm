import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Phone, PhoneIncoming, MapPin } from 'lucide-react'

const DAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

// Metadados das 3 métricas do registro diário
const METRICS = {
  calls:        { label: 'Ligações',  Icon: Phone,         color: '#60A5FA', rgb: '96,165,250'  },
  answered:     { label: 'Atendidas', Icon: PhoneIncoming, color: '#4ADE80', rgb: '74,222,128'  },
  appointments: { label: 'Marcações', Icon: MapPin,        color: '#A78BFA', rgb: '167,139,250' },
}
const metricVal = (log, metric) => (log ? log[metric] : 0) || 0

export default function LigacoesPage() {
  const { user } = useAuth()
  const [logCalls, setLogCalls]               = useState(0)
  const [logAnswered, setLogAnswered]         = useState(0)
  const [logAppointments, setLogAppointments] = useState(0)
  const [saving, setSaving]                   = useState(false)
  const [saved, setSaved]                     = useState(false)
  const [allLogs, setAllLogs]                 = useState([])
  const [calView, setCalView]                 = useState('month') // 'month' | 'week'
  const [calMetric, setCalMetric]             = useState('calls') // 'calls' | 'answered' | 'appointments'

  const today = new Date().toISOString().split('T')[0]

  useEffect(() => {
    if (user) {
      fetchTodayLog()
      fetchAllLogs()
    }
  }, [user])

  async function fetchTodayLog() {
    const { data } = await supabase
      .from('daily_logs')
      .select('*')
      .eq('user_id', user.id)
      .eq('log_date', today)
      .single()
    if (data) {
      setLogCalls(data.calls)
      setLogAnswered(data.answered || 0)
      setLogAppointments(data.appointments)
    }
  }

  async function fetchAllLogs() {
    const { data } = await supabase
      .from('daily_logs')
      .select('*')
      .eq('user_id', user.id)
      .order('log_date', { ascending: false })
    setAllLogs(data || [])
  }

  async function saveLog() {
    setSaving(true)
    await supabase.from('daily_logs').upsert({
      user_id:      user.id,
      log_date:     today,
      calls:        logCalls,
      answered:     logAnswered,
      appointments: logAppointments,
    }, { onConflict: 'user_id,log_date' })
    setSaving(false)
    setSaved(true)
    fetchAllLogs()
    setTimeout(() => setSaved(false), 2500)
  }

  // date → log lookup
  const logsByDate = useMemo(() => {
    const map = {}
    allLogs.forEach(l => { map[l.log_date] = l })
    return map
  }, [allLogs])

  // Yesterday
  const yesterdayDate = new Date()
  yesterdayDate.setDate(yesterdayDate.getDate() - 1)
  const yesterdayStr = yesterdayDate.toISOString().split('T')[0]
  const yesterdayLog = logsByDate[yesterdayStr]

  // All-time records
  const recordCalls    = allLogs.length ? Math.max(...allLogs.map(l => l.calls))         : 0
  const recordAnswered = allLogs.length ? Math.max(...allLogs.map(l => l.answered || 0)) : 0
  const recordAppts    = allLogs.length ? Math.max(...allLogs.map(l => l.appointments))  : 0

  // Calendar days array
  const calDays = useMemo(() => {
    const now = new Date()
    if (calView === 'week') {
      const mon = new Date(now)
      const dow = now.getDay() // 0=Sun
      mon.setDate(now.getDate() + (dow === 0 ? -6 : 1 - dow))
      return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(mon)
        d.setDate(mon.getDate() + i)
        return d.toISOString().split('T')[0]
      })
    }
    // Month
    const year  = now.getFullYear()
    const month = now.getMonth()
    const first = new Date(year, month, 1).getDay()   // 0=Sun
    const last  = new Date(year, month + 1, 0).getDate()
    const cells = Array.from({ length: first }, () => null)
    for (let d = 1; d <= last; d++) {
      cells.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
    }
    return cells
  }, [calView])

  // Max value in the current view period (for intensity)
  const maxVal = useMemo(() => {
    const vals = calDays
      .filter(Boolean)
      .map(d => metricVal(logsByDate[d], calMetric))
    return Math.max(1, ...vals)
  }, [calDays, logsByDate, calMetric])

  const now = new Date()
  const monthLabel = now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  const todayLabel = now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })

  const weekStartDate = new Date(now)
  const dow = now.getDay()
  weekStartDate.setDate(now.getDate() + (dow === 0 ? -6 : 1 - dow))
  const weekEndDate = new Date(weekStartDate)
  weekEndDate.setDate(weekStartDate.getDate() + 6)
  const weekLabel = `${weekStartDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} – ${weekEndDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}`

  const accentRGB  = METRICS[calMetric].rgb
  const accentHex  = METRICS[calMetric].color

  function cellBg(dateStr, val) {
    if (dateStr === today)  return 'rgba(201,168,76,0.12)'
    if (val > 0) {
      const alpha = Math.max(0.12, (val / maxVal) * 0.35)
      return `rgba(${accentRGB}, ${alpha})`
    }
    return '#111'
  }

  return (
    <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>

      {/* Header */}
      <div className="pt-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] mb-2 capitalize" style={{ color: '#C9A84C' }}>
          {todayLabel}
        </p>
        <h1 style={{ color: '#EFEFEF' }}>Registro do dia</h1>
        <p className="text-sm mt-1" style={{ color: '#6B6560' }}>Registre suas ligações e marcações</p>
      </div>

      {/* Card de registro */}
      <div className="rounded-2xl" style={{ background: '#161616', border: '1px solid #252525', padding: '24px' }}>

        {/* Ligações */}
        <div className="flex items-center justify-between" style={{ marginBottom: '24px' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)' }}>
              <Phone size={14} style={{ color: '#60A5FA' }} />
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: '#EFEFEF' }}>Ligações feitas</p>
              <p className="text-xs" style={{ color: '#6B6560' }}>Contatos realizados hoje</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setLogCalls(n => Math.max(0, n - 1))}
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-all"
              style={{ background: '#111', border: '1px solid #2A2A2A', color: '#6B6560', fontSize: '18px' }}>
              −
            </button>
            <input
              type="number" min="0" inputMode="numeric"
              value={logCalls}
              onChange={e => setLogCalls(Math.max(0, parseInt(e.target.value) || 0))}
              onFocus={e => e.target.select()}
              className="text-2xl font-bold tabular-nums text-center outline-none bg-transparent"
              style={{ color: '#60A5FA', letterSpacing: '-1px', width: '48px', border: 'none', MozAppearance: 'textfield' }}
            />
            <button onClick={() => setLogCalls(n => n + 1)}
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-all"
              style={{ background: 'rgba(96,165,250,0.12)', border: '1px solid rgba(96,165,250,0.25)', color: '#60A5FA', fontSize: '18px' }}>
              +
            </button>
          </div>
        </div>

        {/* Ligações atendidas */}
        <div className="flex items-center justify-between" style={{ marginBottom: '24px' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.2)' }}>
              <PhoneIncoming size={14} style={{ color: '#4ADE80' }} />
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: '#EFEFEF' }}>Ligações atendidas</p>
              <p className="text-xs" style={{ color: '#6B6560' }}>Quantas foram atendidas hoje</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setLogAnswered(n => Math.max(0, n - 1))}
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-all"
              style={{ background: '#111', border: '1px solid #2A2A2A', color: '#6B6560', fontSize: '18px' }}>
              −
            </button>
            <input
              type="number" min="0" inputMode="numeric"
              value={logAnswered}
              onChange={e => setLogAnswered(Math.max(0, parseInt(e.target.value) || 0))}
              onFocus={e => e.target.select()}
              className="text-2xl font-bold tabular-nums text-center outline-none bg-transparent"
              style={{ color: '#4ADE80', letterSpacing: '-1px', width: '48px', border: 'none', MozAppearance: 'textfield' }}
            />
            <button onClick={() => setLogAnswered(n => n + 1)}
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-all"
              style={{ background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.25)', color: '#4ADE80', fontSize: '18px' }}>
              +
            </button>
          </div>
        </div>

        {/* Marcações */}
        <div className="flex items-center justify-between" style={{ marginBottom: '24px' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.2)' }}>
              <MapPin size={14} style={{ color: '#A78BFA' }} />
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: '#EFEFEF' }}>Marcações de visita</p>
              <p className="text-xs" style={{ color: '#6B6560' }}>Visitas agendadas hoje</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setLogAppointments(n => Math.max(0, n - 1))}
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-all"
              style={{ background: '#111', border: '1px solid #2A2A2A', color: '#6B6560', fontSize: '18px' }}>
              −
            </button>
            <input
              type="number" min="0" inputMode="numeric"
              value={logAppointments}
              onChange={e => setLogAppointments(Math.max(0, parseInt(e.target.value) || 0))}
              onFocus={e => e.target.select()}
              className="text-2xl font-bold tabular-nums text-center outline-none bg-transparent"
              style={{ color: '#A78BFA', letterSpacing: '-1px', width: '48px', border: 'none', MozAppearance: 'textfield' }}
            />
            <button onClick={() => setLogAppointments(n => n + 1)}
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-all"
              style={{ background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.25)', color: '#A78BFA', fontSize: '18px' }}>
              +
            </button>
          </div>
        </div>

        <button onClick={saveLog} disabled={saving}
          className="w-full py-3 rounded-xl text-sm font-semibold transition-all"
          style={{
            background: saved ? 'rgba(74,222,128,0.12)' : 'linear-gradient(135deg, #7B1C3A 0%, #C9A84C 100%)',
            color: saved ? '#4ADE80' : '#F0EAD6',
            border: saved ? '1px solid rgba(74,222,128,0.3)' : 'none',
            boxShadow: saved ? 'none' : '0 2px 12px rgba(201,168,76,0.2)',
          }}>
          {saved ? '✓ Salvo' : saving ? 'Salvando...' : 'Salvar registro'}
        </button>
      </div>

      {/* ── Calendário ── */}
      <div className="rounded-2xl" style={{ background: '#161616', border: '1px solid #252525', padding: '20px' }}>

        {/* Topo: label + toggle mês/semana */}
        <div className="flex items-center justify-between" style={{ marginBottom: '14px' }}>
          <p className="text-sm font-semibold capitalize" style={{ color: '#EFEFEF' }}>
            {calView === 'month' ? monthLabel : weekLabel}
          </p>
          <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid #252525' }}>
            {[['month', 'Mês'], ['week', 'Semana']].map(([v, label], i) => (
              <button key={v} onClick={() => setCalView(v)}
                className="px-3 py-1.5 text-xs font-semibold"
                style={{
                  background: calView === v ? 'rgba(201,168,76,0.15)' : '#111',
                  color:      calView === v ? '#C9A84C' : '#6B6560',
                  borderRight: i === 0 ? '1px solid #252525' : 'none',
                }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Toggle métrica */}
        <div className="flex gap-2" style={{ marginBottom: '14px' }}>
          {Object.entries(METRICS).map(([key, { label, Icon, color, rgb }]) => (
            <button key={key} onClick={() => setCalMetric(key)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
              style={{
                background: calMetric === key ? `rgba(${rgb},0.12)` : '#111',
                color:      calMetric === key ? color : '#6B6560',
                border:     `1px solid ${calMetric === key ? `rgba(${rgb},0.3)` : '#1C1C1C'}`,
              }}>
              <Icon size={10} />
              {label}
            </button>
          ))}
        </div>

        {/* Cabeçalho dos dias da semana */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '4px' }}>
          {DAYS_SHORT.map(d => (
            <div key={d} className="text-center text-[10px] font-bold uppercase" style={{ color: '#2A2A2A' }}>
              {d}
            </div>
          ))}
        </div>

        {/* Grade do calendário */}
        {calView === 'month' ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
            {calDays.map((dateStr, idx) => {
              if (!dateStr) return <div key={`pad-${idx}`} />
              const log  = logsByDate[dateStr]
              const val  = metricVal(log, calMetric)
              const isToday  = dateStr === today
              const isFuture = dateStr > today
              const dayNum   = parseInt(dateStr.split('-')[2])
              return (
                <div key={dateStr}
                  className="rounded-lg flex flex-col items-center justify-center"
                  style={{
                    aspectRatio: '1',
                    background:  cellBg(dateStr, val),
                    border:      isToday ? '1px solid rgba(201,168,76,0.5)' : '1px solid transparent',
                    opacity:     isFuture ? 0.25 : 1,
                    gap: '1px',
                  }}>
                  <span style={{
                    fontSize: '9px', fontWeight: 700, lineHeight: 1,
                    color: isToday ? '#C9A84C' : '#404040',
                  }}>
                    {dayNum}
                  </span>
                  {val > 0 && (
                    <span style={{
                      fontSize: '11px', fontWeight: 800, lineHeight: 1,
                      color: accentHex,
                      fontVariantNumeric: 'tabular-nums',
                    }}>
                      {val}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          /* Semana — células maiores, mostra as duas métricas */
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px' }}>
            {calDays.map(dateStr => {
              const log    = logsByDate[dateStr]
              const calls  = log?.calls        || 0
              const answ   = log?.answered     || 0
              const appts  = log?.appointments || 0
              const val    = metricVal(log, calMetric)
              const isToday  = dateStr === today
              const isFuture = dateStr > today
              const d = new Date(dateStr + 'T12:00:00')
              return (
                <div key={dateStr}
                  className="rounded-xl flex flex-col items-center"
                  style={{
                    padding: '10px 4px 12px',
                    background: cellBg(dateStr, val),
                    border: isToday ? '1px solid rgba(201,168,76,0.5)' : '1px solid #1A1A1A',
                    opacity: isFuture ? 0.25 : 1,
                    gap: '6px',
                  }}>
                  {/* Dia número */}
                  <span style={{ fontSize: '11px', fontWeight: 700, color: isToday ? '#C9A84C' : '#404040', lineHeight: 1 }}>
                    {d.getDate()}
                  </span>
                  {/* Ligações */}
                  <div className="flex flex-col items-center" style={{ gap: '2px' }}>
                    <Phone size={8} style={{ color: calls > 0 ? '#60A5FA' : '#222' }} />
                    <span style={{
                      fontSize: '13px', fontWeight: 800, lineHeight: 1,
                      color: calls > 0 ? '#60A5FA' : '#222',
                      fontVariantNumeric: 'tabular-nums',
                    }}>
                      {calls || '—'}
                    </span>
                  </div>
                  {/* Atendidas */}
                  <div className="flex flex-col items-center" style={{ gap: '2px' }}>
                    <PhoneIncoming size={8} style={{ color: answ > 0 ? '#4ADE80' : '#222' }} />
                    <span style={{
                      fontSize: '13px', fontWeight: 800, lineHeight: 1,
                      color: answ > 0 ? '#4ADE80' : '#222',
                      fontVariantNumeric: 'tabular-nums',
                    }}>
                      {answ || '—'}
                    </span>
                  </div>
                  {/* Marcações */}
                  <div className="flex flex-col items-center" style={{ gap: '2px' }}>
                    <MapPin size={8} style={{ color: appts > 0 ? '#A78BFA' : '#222' }} />
                    <span style={{
                      fontSize: '13px', fontWeight: 800, lineHeight: 1,
                      color: appts > 0 ? '#A78BFA' : '#222',
                      fontVariantNumeric: 'tabular-nums',
                    }}>
                      {appts || '—'}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Stats — ontem + recorde */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>

        {/* Ontem */}
        <div className="rounded-2xl" style={{ background: '#161616', border: '1px solid #252525', padding: '18px 16px' }}>
          <p className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: '#333030', marginBottom: '14px' }}>
            Ontem
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Phone size={10} style={{ color: '#60A5FA' }} />
                <span style={{ fontSize: '11px', color: '#6B6560' }}>Lig.</span>
              </div>
              <span className="font-bold tabular-nums" style={{ fontSize: '20px', color: '#60A5FA', letterSpacing: '-0.5px' }}>
                {yesterdayLog?.calls ?? '—'}
              </span>
            </div>
            <div style={{ height: '1px', background: '#1C1C1C' }} />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <PhoneIncoming size={10} style={{ color: '#4ADE80' }} />
                <span style={{ fontSize: '11px', color: '#6B6560' }}>Atend.</span>
              </div>
              <span className="font-bold tabular-nums" style={{ fontSize: '20px', color: '#4ADE80', letterSpacing: '-0.5px' }}>
                {yesterdayLog ? (yesterdayLog.answered || 0) : '—'}
              </span>
            </div>
            <div style={{ height: '1px', background: '#1C1C1C' }} />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <MapPin size={10} style={{ color: '#A78BFA' }} />
                <span style={{ fontSize: '11px', color: '#6B6560' }}>Marc.</span>
              </div>
              <span className="font-bold tabular-nums" style={{ fontSize: '20px', color: '#A78BFA', letterSpacing: '-0.5px' }}>
                {yesterdayLog?.appointments ?? '—'}
              </span>
            </div>
          </div>
        </div>

        {/* Recorde */}
        <div className="rounded-2xl" style={{ background: '#161616', border: '1px solid #252525', padding: '18px 16px' }}>
          <p className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: '#333030', marginBottom: '14px' }}>
            🏆 Recorde
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Phone size={10} style={{ color: '#60A5FA' }} />
                <span style={{ fontSize: '11px', color: '#6B6560' }}>Lig.</span>
              </div>
              <span className="font-bold tabular-nums" style={{ fontSize: '20px', color: '#60A5FA', letterSpacing: '-0.5px' }}>
                {allLogs.length ? recordCalls : '—'}
              </span>
            </div>
            <div style={{ height: '1px', background: '#1C1C1C' }} />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <PhoneIncoming size={10} style={{ color: '#4ADE80' }} />
                <span style={{ fontSize: '11px', color: '#6B6560' }}>Atend.</span>
              </div>
              <span className="font-bold tabular-nums" style={{ fontSize: '20px', color: '#4ADE80', letterSpacing: '-0.5px' }}>
                {allLogs.length ? recordAnswered : '—'}
              </span>
            </div>
            <div style={{ height: '1px', background: '#1C1C1C' }} />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <MapPin size={10} style={{ color: '#A78BFA' }} />
                <span style={{ fontSize: '11px', color: '#6B6560' }}>Marc.</span>
              </div>
              <span className="font-bold tabular-nums" style={{ fontSize: '20px', color: '#A78BFA', letterSpacing: '-0.5px' }}>
                {allLogs.length ? recordAppts : '—'}
              </span>
            </div>
          </div>
        </div>
      </div>

    </div>
  )
}

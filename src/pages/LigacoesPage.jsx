import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Phone, MapPin, Plus, Minus } from 'lucide-react'

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })
}

export default function LigacoesPage() {
  const { user } = useAuth()
  const [logCalls, setLogCalls]               = useState(0)
  const [logAppointments, setLogAppointments] = useState(0)
  const [saving, setSaving]                   = useState(false)
  const [saved, setSaved]                     = useState(false)
  const [history, setHistory]                 = useState([])

  const today = new Date().toISOString().split('T')[0]

  useEffect(() => {
    if (user) {
      fetchTodayLog()
      fetchHistory()
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
      setLogAppointments(data.appointments)
    }
  }

  async function fetchHistory() {
    const { data } = await supabase
      .from('daily_logs')
      .select('*')
      .eq('user_id', user.id)
      .neq('log_date', today)
      .order('log_date', { ascending: false })
      .limit(14)
    setHistory(data || [])
  }

  async function saveLog() {
    setSaving(true)
    await supabase.from('daily_logs').upsert({
      user_id:      user.id,
      log_date:     today,
      calls:        logCalls,
      appointments: logAppointments,
    }, { onConflict: 'user_id,log_date' })
    setSaving(false)
    setSaved(true)
    fetchHistory()
    setTimeout(() => setSaved(false), 2500)
  }

  const todayLabel = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  return (
    <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>

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

      {/* Histórico */}
      {history.length > 0 && (
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.15em] mb-3" style={{ color: '#333030' }}>
            Histórico recente
          </p>
          <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #1C1C1C' }}>
            {history.map((entry, i) => (
              <div key={entry.id}
                className="flex items-center justify-between"
                style={{
                  padding: '14px 20px',
                  background: '#161616',
                  borderBottom: i < history.length - 1 ? '1px solid #1C1C1C' : 'none',
                }}>
                <p className="text-sm font-medium capitalize" style={{ color: '#6B6560' }}>
                  {formatDate(entry.log_date)}
                </p>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <Phone size={11} style={{ color: '#60A5FA' }} />
                    <span className="text-sm font-bold tabular-nums" style={{ color: '#60A5FA' }}>{entry.calls}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <MapPin size={11} style={{ color: '#A78BFA' }} />
                    <span className="text-sm font-bold tabular-nums" style={{ color: '#A78BFA' }}>{entry.appointments}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}

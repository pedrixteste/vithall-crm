import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const TRAININGS = ['Impacto', 'Perfil', 'Vendas', 'LORAPE', 'Academia Vithall']
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

function StatCard({ label, value, color = '#C9A84C', sub }) {
  return (
    <div className="rounded-2xl flex flex-col" style={{ background: '#161616', border: '1px solid #252525', padding: '16px' }}>
      <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: '#444040' }}>{label}</p>
      <p className="text-4xl font-bold tabular-nums" style={{ color, letterSpacing: '-1.5px' }}>{value}</p>
      {sub && <p className="text-xs mt-1" style={{ color: '#444040' }}>{sub}</p>}
    </div>
  )
}

function ProportionalBar({ count, max, color }) {
  const pct = max > 0 ? Math.max((count / max) * 100, count > 0 ? 4 : 0) : 0
  return (
    <div style={{ height: '6px', borderRadius: '99px', background: '#1A1A1A', overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: '99px', transition: 'width 0.5s ease' }} />
    </div>
  )
}

export default function RelatoriosPage() {
  const { profile, user } = useAuth()
  const [clients, setClients] = useState([])
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState(30)

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
    setLoading(false)
  }

  // --- Calculos por periodo ---
  const periodStart = new Date()
  periodStart.setDate(periodStart.getDate() - period)
  periodStart.setHours(0, 0, 0, 0)

  const clientsInPeriod = clients.filter(c => new Date(c.created_at) >= periodStart)
  const visitsInPeriod  = clients.flatMap(c =>
    (c.visits || []).filter(v => new Date(v.visit_date + 'T12:00:00') >= periodStart)
  )
  const noShows  = clientsInPeriod.filter(c => c.matricula_stage === 'nao_apareceu')
  const enrolled = clientsInPeriod.filter(c => c.matricula_stage === 'matriculado')

  // Taxa de conversao
  const convRate = visitsInPeriod.length > 0
    ? Math.round((enrolled.length / visitsInPeriod.length) * 100)
    : null

  // --- All-time para treinamentos e origens ---
  const allEnrolled = clients.filter(c => c.matricula_stage === 'matriculado')

  const trainingCounts = TRAININGS.map(t => ({
    label: t,
    count: allEnrolled.filter(c => (c.matriculas || []).includes(t)).length,
  }))
  const maxTraining = Math.max(...trainingCounts.map(t => t.count), 1)

  const originCounts = ORIGINS.map(o => ({
    label: o.label,
    key: o.key,
    count: allEnrolled.filter(c => c.origin === o.key).length,
  }))
  const maxOrigin = Math.max(...originCounts.map(o => o.count), 1)

  // --- Por vendedor (gerente only) ---
  const teamStats = profiles
    .filter(p => p.role !== 'gerente')
    .map(p => {
      const memberClients = clients.filter(c => c.created_by === p.id)
      const memberInPeriod = memberClients.filter(c => new Date(c.created_at) >= periodStart)
      return {
        ...p,
        marcacoes: memberInPeriod.length,
        matriculas: memberClients.filter(c => c.matricula_stage === 'matriculado').length,
        visitas: memberClients.flatMap(c =>
          (c.visits || []).filter(v => new Date(v.visit_date + 'T12:00:00') >= periodStart)
        ).length,
      }
    })

  if (loading) return (
    <div className="flex justify-center" style={{ padding: '64px 0' }}>
      <div className="w-7 h-7 rounded-full border-2 animate-spin"
        style={{ borderColor: '#C9A84C', borderTopColor: 'transparent' }} />
    </div>
  )

  return (
    <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* Header */}
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.15em] mb-1" style={{ color: '#C9A84C' }}>Analise</p>
        <h1 style={{ color: '#EFEFEF' }}>Relatorios</h1>
      </div>

      {/* Filtro de periodo */}
      <div className="flex p-1 rounded-xl gap-1" style={{ background: '#161616', border: '1px solid #252525' }}>
        {PERIODS.map(p => (
          <button key={p.key} onClick={() => setPeriod(p.key)}
            className="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all"
            style={{
              background: period === p.key ? 'rgba(201,168,76,0.12)' : 'transparent',
              color: period === p.key ? '#C9A84C' : '#6B6560',
              border: period === p.key ? '1px solid rgba(201,168,76,0.2)' : '1px solid transparent',
            }}>
            {p.label}
          </button>
        ))}
      </div>

      {/* Secao 1: Visao geral */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: '#333030' }}>Visao geral</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <StatCard label="Marcacoes" value={clientsInPeriod.length} color="#60A5FA" />
          <StatCard label="Visitas" value={visitsInPeriod.length} color="#A78BFA" />
          <StatCard label="Nao apareceu" value={noShows.length} color="#E8834A" />
          <StatCard
            label="Matriculas"
            value={enrolled.length}
            color="#4ADE80"
            sub={convRate !== null ? `${convRate}% das visitas` : null}
          />
        </div>
      </div>

      {/* Secao 2: Por treinamento */}
      <div className="rounded-2xl" style={{ background: '#161616', border: '1px solid #252525', padding: '18px' }}>
        <p className="text-[10px] font-bold uppercase tracking-widest mb-4" style={{ color: '#333030' }}>
          Matriculas por treinamento
        </p>
        {allEnrolled.length === 0 ? (
          <p className="text-xs text-center" style={{ color: '#2A2A2A', padding: '16px 0' }}>Nenhuma matricula registrada ainda</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {trainingCounts.sort((a, b) => b.count - a.count).map(t => (
              <div key={t.label}>
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-sm font-medium" style={{ color: t.count > 0 ? '#EFEFEF' : '#3A3530' }}>{t.label}</span>
                  <span className="text-sm font-bold tabular-nums" style={{ color: t.count > 0 ? '#4ADE80' : '#2A2A2A' }}>{t.count}</span>
                </div>
                <ProportionalBar count={t.count} max={maxTraining} color="#4ADE80" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Secao 3: Por origem */}
      <div className="rounded-2xl" style={{ background: '#161616', border: '1px solid #252525', padding: '18px' }}>
        <p className="text-[10px] font-bold uppercase tracking-widest mb-4" style={{ color: '#333030' }}>
          Matriculas por origem
        </p>
        {allEnrolled.length === 0 ? (
          <p className="text-xs text-center" style={{ color: '#2A2A2A', padding: '16px 0' }}>Nenhuma matricula registrada ainda</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {originCounts.sort((a, b) => b.count - a.count).map(o => (
              <div key={o.key}>
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-sm font-medium" style={{ color: o.count > 0 ? '#EFEFEF' : '#3A3530' }}>{o.label}</span>
                  <span className="text-sm font-bold tabular-nums" style={{ color: o.count > 0 ? '#C9A84C' : '#2A2A2A' }}>{o.count}</span>
                </div>
                <ProportionalBar count={o.count} max={maxOrigin} color="#C9A84C" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Secao 4: Por vendedor (gerente only) */}
      {profile?.role === 'gerente' && teamStats.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: '#333030' }}>Por membro da equipe</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {teamStats.map(m => (
              <div key={m.id} className="rounded-2xl" style={{ background: '#161616', border: '1px solid #252525', padding: '16px 18px' }}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center font-bold flex-shrink-0"
                    style={{ background: 'rgba(201,168,76,0.08)', color: '#C9A84C', border: '1px solid rgba(201,168,76,0.15)' }}>
                    {m.name?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: '#EFEFEF' }}>{m.name || 'Sem nome'}</p>
                    <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#444040' }}>
                      {ROLE_LABELS[m.role] || m.role}
                    </p>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                  {[
                    { label: 'Marcacoes', value: m.marcacoes, color: '#60A5FA' },
                    { label: 'Visitas',   value: m.visitas,   color: '#A78BFA' },
                    { label: 'Matriculas',value: m.matriculas,color: '#4ADE80' },
                  ].map(s => (
                    <div key={s.label} className="rounded-xl text-center" style={{ background: '#111', padding: '10px 6px' }}>
                      <p className="text-xl font-bold tabular-nums" style={{ color: s.color }}>{s.value}</p>
                      <p className="text-[9px] font-bold uppercase tracking-wider mt-0.5" style={{ color: '#333030' }}>{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}

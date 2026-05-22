import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Badge } from '../components/ui/Badge'
import { Card } from '../components/ui/Card'

const STAGES = [
  { key: 'nao_marcou',     label: 'Nao marcou ainda',   badge: 'muted',  dot: '#6B6560' },
  { key: 'nao_visitado',   label: 'Nao foi visitado',   badge: 'blue',   dot: '#60A5FA' },
  { key: 'nao_apareceu',   label: 'Nao apareceu',       badge: 'orange', dot: '#E8834A' },
  { key: 'recebeu_visita', label: 'Recebeu visita',     badge: 'purple', dot: '#A78BFA' },
  { key: 'matriculado',    label: 'Matriculado!!',      badge: 'green',  dot: '#4ADE80' },
]

export default function PipelinePage() {
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchClients() }, [])

  async function fetchClients() {
    const { data } = await supabase.from('clients').select('*').order('company_name')
    setClients(data || [])
    setLoading(false)
  }

  async function moveStage(clientId, newStage) {
    await supabase.from('clients').update({ matricula_stage: newStage }).eq('id', clientId)
    fetchClients()
  }

  const byStage = (key) => clients.filter(c => c.matricula_stage === key)

  if (loading) return (
    <div className="flex justify-center py-16">
      <div className="w-7 h-7 rounded-full border-2 animate-spin"
        style={{ borderColor: '#C9A84C', borderTopColor: 'transparent' }} />
    </div>
  )

  return (
    <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.15em] mb-1" style={{ color: '#C9A84C' }}>Visao geral</p>
        <h1 style={{ color: '#EFEFEF' }}>Funil de Matricula</h1>
      </div>

      {/* Barra de progresso visual */}
      <div className="flex rounded-xl overflow-hidden h-2 gap-px" style={{ background: '#111' }}>
        {STAGES.map(s => {
          const count = byStage(s.key).length
          const pct = clients.length ? (count / clients.length) * 100 : 0
          return (
            <div key={s.key} className="transition-all" style={{ width: `${pct}%`, background: s.dot, minWidth: pct > 0 ? '4px' : 0 }} />
          )
        })}
      </div>

      {/* Colunas */}
      <div className="space-y-4">
        {STAGES.map(stage => (
          <div key={stage.key} className="rounded-2xl overflow-hidden" style={{ border: '1px solid #303030', background: '#161616' }}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: '#222' }}>
              <div className="flex items-center gap-2.5">
                <div className="w-2 h-2 rounded-full" style={{ background: stage.dot }} />
                <Badge variant={stage.badge}>{stage.label}</Badge>
              </div>
              <span className="text-xs font-bold tabular-nums" style={{ color: stage.dot }}>
                {byStage(stage.key).length}
              </span>
            </div>

            {byStage(stage.key).length === 0 ? (
              <p className="text-xs text-center py-5" style={{ color: '#252525' }}>Sem clientes</p>
            ) : (
              <div className="p-3 space-y-2.5">
                {byStage(stage.key).map(client => (
                  <div key={client.id} className="rounded-xl p-5"
                    style={{ background: '#1A1A1A', border: '1px solid #2A2A2A' }}>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                        style={{ background: `${stage.dot}12`, color: stage.dot }}>
                        {client.company_name?.[0]?.toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: '#EFEFEF' }}>{client.company_name}</p>
                        {client.contact_name && (
                          <p className="text-xs truncate mt-0.5" style={{ color: '#6B6560' }}>{client.contact_name}</p>
                        )}
                      </div>
                    </div>

                    {/* Mover para */}
                    <div className="flex gap-1.5 flex-wrap">
                      {STAGES.filter(s => s.key !== stage.key).map(s => (
                        <button key={s.key} onClick={() => moveStage(client.id, s.key)}
                          className="text-[11px] px-2.5 py-1.5 rounded-lg font-medium transition-all"
                          style={{ background: `${s.dot}10`, color: s.dot, border: `1px solid ${s.dot}20` }}>
                          → {s.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

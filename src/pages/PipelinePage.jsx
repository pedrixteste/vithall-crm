import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Badge } from '../components/ui/Badge'
import { Card } from '../components/ui/Card'

const STAGES = [
  { key: 'lead', label: 'Lead', badge: 'muted', dot: '#6B6560' },
  { key: 'negociacao', label: 'Em negociação', badge: 'gold', dot: '#C9A84C' },
  { key: 'proposta', label: 'Proposta enviada', badge: 'purple', dot: '#A78BFA' },
  { key: 'fechado', label: 'Fechado', badge: 'green', dot: '#4ADE80' },
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
    await supabase.from('clients').update({ pipeline_stage: newStage }).eq('id', clientId)
    fetchClients()
  }

  const byStage = (key) => clients.filter(c => c.pipeline_stage === key)

  if (loading) return (
    <div className="flex justify-center py-16">
      <div className="w-7 h-7 rounded-full border-2 animate-spin"
        style={{ borderColor: '#C9A84C', borderTopColor: 'transparent' }} />
    </div>
  )

  return (
    <div className="animate-in space-y-4">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.15em] mb-1" style={{ color: '#C9A84C' }}>Funil de Vendas</p>
        <h1 style={{ color: '#EFEFEF' }}>Pipeline</h1>
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
      <div className="space-y-3">
        {STAGES.map(stage => (
          <div key={stage.key} className="rounded-2xl overflow-hidden" style={{ border: '1px solid #1C1C1C', background: '#111111' }}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: '#1C1C1C' }}>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ background: stage.dot }} />
                <Badge variant={stage.badge}>{stage.label}</Badge>
              </div>
              <span className="text-xs font-bold tabular-nums" style={{ color: stage.dot }}>
                {byStage(stage.key).length}
              </span>
            </div>

            {byStage(stage.key).length === 0 ? (
              <p className="text-xs text-center py-4" style={{ color: '#252525' }}>Sem clientes</p>
            ) : (
              <div className="p-2.5 space-y-2">
                {byStage(stage.key).map(client => (
                  <div key={client.id} className="rounded-xl p-3.5"
                    style={{ background: '#1A1A1A', border: '1px solid #252525' }}>
                    <div className="flex items-center gap-2.5 mb-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                        style={{ background: `${stage.dot}12`, color: stage.dot }}>
                        {client.company_name?.[0]?.toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: '#EFEFEF' }}>{client.company_name}</p>
                        {client.contact_name && (
                          <p className="text-xs truncate" style={{ color: '#6B6560' }}>{client.contact_name}</p>
                        )}
                      </div>
                    </div>

                    {/* Mover para */}
                    <div className="flex gap-1.5 flex-wrap">
                      {STAGES.filter(s => s.key !== stage.key).map(s => (
                        <button key={s.key} onClick={() => moveStage(client.id, s.key)}
                          className="text-[11px] px-2 py-1 rounded-lg font-medium transition-all"
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

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const STAGES = [
  { key: 'lead', label: 'Lead', color: '#7A7570', bg: 'rgba(122,117,112,0.08)', border: 'rgba(122,117,112,0.2)' },
  { key: 'negociacao', label: 'Em negociação', color: '#C9A84C', bg: 'rgba(201,168,76,0.08)', border: 'rgba(201,168,76,0.2)' },
  { key: 'proposta', label: 'Proposta enviada', color: '#9B5DE5', bg: 'rgba(155,93,229,0.08)', border: 'rgba(155,93,229,0.2)' },
  { key: 'fechado', label: 'Fechado ✓', color: '#4ADE80', bg: 'rgba(74,222,128,0.08)', border: 'rgba(74,222,128,0.2)' },
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

  const byStage = (stage) => clients.filter(c => c.pipeline_stage === stage)

  if (loading) return (
    <div className="flex justify-center py-16">
      <div className="w-8 h-8 rounded-full border-2 animate-spin"
        style={{ borderColor: '#C9A84C', borderTopColor: 'transparent' }} />
    </div>
  )

  return (
    <div>
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: '#C9A84C' }}>Funil</p>
        <h1 className="text-2xl font-bold" style={{ color: '#F0EAD6' }}>Pipeline</h1>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-4 gap-2 mb-6">
        {STAGES.map(s => (
          <div key={s.key} className="rounded-xl p-3 text-center"
            style={{ background: s.bg, border: `1px solid ${s.border}` }}>
            <p className="text-xl font-bold" style={{ color: s.color }}>{byStage(s.key).length}</p>
            <p className="text-xs mt-0.5" style={{ color: s.color, opacity: 0.7 }}>
              {s.label.split(' ')[0]}
            </p>
          </div>
        ))}
      </div>

      <div className="space-y-4">
        {STAGES.map(stage => (
          <div key={stage.key} className="rounded-2xl overflow-hidden"
            style={{ border: `1px solid ${stage.border}`, background: '#161616' }}>

            {/* Header da coluna */}
            <div className="flex items-center justify-between px-4 py-3 border-b"
              style={{ borderColor: stage.border, background: stage.bg }}>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ background: stage.color }} />
                <span className="text-sm font-bold" style={{ color: stage.color }}>{stage.label}</span>
              </div>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ background: `${stage.color}20`, color: stage.color }}>
                {byStage(stage.key).length}
              </span>
            </div>

            {byStage(stage.key).length === 0 ? (
              <p className="text-xs text-center py-5" style={{ color: '#3A3530' }}>Nenhum cliente</p>
            ) : (
              <div className="p-3 space-y-2">
                {byStage(stage.key).map(client => (
                  <div key={client.id} className="rounded-xl p-3.5"
                    style={{ background: '#1E1E1E', border: '1px solid #2A2A2A' }}>
                    <div className="flex items-center gap-2.5 mb-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: `${stage.color}15` }}>
                        <span className="text-xs font-bold" style={{ color: stage.color }}>
                          {client.company_name?.[0]?.toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold" style={{ color: '#F0EAD6' }}>{client.company_name}</p>
                        {client.contact_name && (
                          <p className="text-xs" style={{ color: '#7A7570' }}>{client.contact_name}</p>
                        )}
                      </div>
                    </div>

                    {/* Botões para mover */}
                    <div className="flex gap-1.5 flex-wrap">
                      {STAGES.filter(s => s.key !== stage.key).map(s => (
                        <button key={s.key} onClick={() => moveStage(client.id, s.key)}
                          className="text-xs px-2.5 py-1 rounded-lg transition-all"
                          style={{
                            background: `${s.color}10`,
                            color: s.color,
                            border: `1px solid ${s.color}25`,
                          }}>
                          → {s.label.replace(' ✓', '')}
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

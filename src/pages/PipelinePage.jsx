import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { ChevronRight } from 'lucide-react'

const STAGES = [
  { key: 'lead', label: 'Lead', color: 'border-gray-300 bg-gray-50', badge: 'bg-gray-100 text-gray-600' },
  { key: 'negociacao', label: 'Em negociação', color: 'border-blue-300 bg-blue-50', badge: 'bg-blue-100 text-blue-700' },
  { key: 'proposta', label: 'Proposta enviada', color: 'border-yellow-300 bg-yellow-50', badge: 'bg-yellow-100 text-yellow-700' },
  { key: 'fechado', label: 'Fechado', color: 'border-green-300 bg-green-50', badge: 'bg-green-100 text-green-700' },
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
    <div className="flex justify-center py-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  )

  return (
    <div className="pb-20 sm:pb-4">
      <h1 className="text-xl font-bold text-gray-800 mb-4">Pipeline de vendas</h1>

      <div className="space-y-4">
        {STAGES.map((stage, idx) => (
          <div key={stage.key} className={`rounded-xl border-2 ${stage.color} p-3`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold px-2 py-1 rounded-full ${stage.badge}`}>
                  {stage.label}
                </span>
                <span className="text-xs text-gray-400">{byStage(stage.key).length} cliente(s)</span>
              </div>
            </div>

            {byStage(stage.key).length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-3">Nenhum cliente</p>
            ) : (
              <div className="space-y-2">
                {byStage(stage.key).map(client => (
                  <div key={client.id} className="bg-white rounded-lg p-3 shadow-sm border border-white">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{client.company_name}</p>
                        <p className="text-xs text-gray-400">{client.contact_name}</p>
                      </div>
                    </div>
                    {/* Botões para mover */}
                    <div className="flex gap-1 mt-2 flex-wrap">
                      {STAGES.filter(s => s.key !== stage.key).map(s => (
                        <button
                          key={s.key}
                          onClick={() => moveStage(client.id, s.key)}
                          className={`text-xs px-2 py-1 rounded-full border transition hover:opacity-80 ${s.badge} border-current`}
                        >
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

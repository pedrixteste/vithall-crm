import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Badge } from '../components/ui/Badge'
import ClienteDetalhe from '../components/ClienteDetalhe'
import { ChevronRight } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

const STAGES = [
  { key: 'nao_marcou',     label: 'Nao marcou ainda',   badge: 'muted',  dot: '#6B6560' },
  { key: 'nao_visitado',   label: 'Nao foi visitado',   badge: 'blue',   dot: '#60A5FA' },
  { key: 'nao_apareceu',   label: 'Nao apareceu',       badge: 'orange', dot: '#E8834A' },
  { key: 'recebeu_visita', label: 'Recebeu visita',     badge: 'purple', dot: '#A78BFA' },
  { key: 'matriculado',    label: 'Matriculado!!',      badge: 'green',  dot: '#4ADE80' },
]

export default function PipelinePage() {
  const { profile, user } = useAuth()
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)

  useEffect(() => { fetchClients() }, [profile])

  async function fetchClients() {
    let query = supabase.from('clients').select('*').order('company_name')
    if (profile?.role === 'pre_vendas') {
      query = query.eq('created_by', user.id)
    } else if (profile?.role === 'vendedor') {
      query = query.or(`assigned_to.eq.${user.id},created_by.eq.${user.id}`)
    }
    const { data } = await query
    setClients(data || [])
    setLoading(false)
  }

  const byStage = (key) => clients.filter(c => c.matricula_stage === key)

  if (selected) return (
    <ClienteDetalhe client={selected} onBack={() => { setSelected(null); fetchClients() }} />
  )

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

      {/* Barra de progresso */}
      <div className="flex rounded-xl overflow-hidden h-2 gap-px" style={{ background: '#111' }}>
        {STAGES.map(s => {
          const count = byStage(s.key).length
          const pct = clients.length ? (count / clients.length) * 100 : 0
          return (
            <div key={s.key} className="transition-all"
              style={{ width: `${pct}%`, background: s.dot, minWidth: pct > 0 ? '4px' : 0 }} />
          )
        })}
      </div>

      {/* Etapas */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {STAGES.map(stage => (
          <div key={stage.key} className="rounded-2xl overflow-hidden"
            style={{ border: '1px solid #303030', background: '#161616' }}>

            {/* Header da etapa */}
            <div className="flex items-center justify-between border-b"
              style={{ padding: '14px 20px', borderColor: '#222' }}>
              <div className="flex items-center gap-2.5">
                <div className="w-2 h-2 rounded-full" style={{ background: stage.dot }} />
                <Badge variant={stage.badge}>{stage.label}</Badge>
              </div>
              <span className="text-xs font-bold tabular-nums" style={{ color: stage.dot }}>
                {byStage(stage.key).length}
              </span>
            </div>

            {byStage(stage.key).length === 0 ? (
              <p className="text-xs text-center" style={{ padding: '20px 0', color: '#252525' }}>
                Sem clientes
              </p>
            ) : (
              <div style={{ padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {byStage(stage.key).map(client => (
                  <button
                    key={client.id}
                    onClick={() => setSelected(client)}
                    className="w-full text-left rounded-xl flex items-center gap-3 transition-all active:scale-[0.98]"
                    style={{ padding: '14px 16px', background: '#1A1A1A', border: '1px solid #2A2A2A', cursor: 'pointer' }}>
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                      style={{ background: `${stage.dot}15`, color: stage.dot }}>
                      {(client.contact_name || client.company_name)?.[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: '#EFEFEF' }}>
                        {client.contact_name || client.company_name}
                      </p>
                      {client.contact_name && client.company_name && (
                        <p className="text-xs truncate mt-0.5" style={{ color: '#6B6560' }}>
                          {client.company_name}
                        </p>
                      )}
                    </div>
                    <ChevronRight size={14} style={{ color: '#333030', flexShrink: 0 }} />
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Phone, Calendar, Star, X, ChevronRight } from 'lucide-react'

// Histórico de um contato (telefone) que foi registrado mais de uma vez.
// Junta todos os registros de clients com o mesmo telefone e mostra a linha
// do tempo: cada registro = uma marcação, com as visitas que vieram dela.
//   - clicar na marcação → abre aquele registro (info do pré-vendas)
//   - clicar na visita   → abre o registro com a estrela aberta naquela visita

const OUTCOMES = {
  matriculada: 'Matriculada', grandes_chances: 'Grandes chances', chance_futura: 'Chance futura',
  sem_chance: 'Sem chance', retorno_pessoalmente: 'Retorno pessoal', retorno_ligacao: 'Retorno ligação', remarcar: 'Remarcar',
}
const MARCA_COLOR = '#60A5FA'
const VISITA_COLOR = '#A78BFA'

function fmt(x) {
  if (!x) return '—'
  const d = new Date(x)
  return isNaN(d) ? '—' : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function ContatoHistorico({ phone, currentClientId, onOpenClient, onClose }) {
  const [groups, setGroups] = useState(null) // null = carregando

  useEffect(() => {
    let active = true
    ;(async () => {
      const { data } = await supabase.from('clients').select('*, visits(*)').eq('phone', phone)
      if (!active) return
      const g = (data || []).map(c => ({
        record: c,
        marcacaoDate: c.visit_scheduled_at || c.created_at,
        visits: [...(c.visits || [])].sort((a, b) => (a.visit_date || '').localeCompare(b.visit_date || '')),
      })).sort((a, b) => new Date(b.marcacaoDate) - new Date(a.marcacaoDate))
      setGroups(g)
    })()
    return () => { active = false }
  }, [phone])

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.8)' }} onClick={onClose}>
      <div className="w-full max-w-lg flex flex-col slide-up sm:animate-in"
        style={{ background: '#1A1A1A', border: '1px solid #252525', borderRadius: '20px 20px 0 0', maxHeight: '88vh' }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex-shrink-0 px-5 pt-5 pb-4 border-b" style={{ borderColor: '#1C1C1C' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Phone size={16} style={{ color: MARCA_COLOR }} />
              <h2 className="text-base font-bold" style={{ color: '#EFEFEF' }}>Histórico do contato</h2>
            </div>
            <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: '#252525', color: '#6B6560' }}><X size={14} /></button>
          </div>
          <p className="text-xs mt-1" style={{ color: '#6B6560' }}>
            {phone}{groups ? ` · ${groups.length} ${groups.length === 1 ? 'registro' : 'registros'}` : ''}
          </p>
          <div className="flex items-center gap-4 mt-2.5">
            <span className="flex items-center gap-1.5 text-[11px]" style={{ color: MARCA_COLOR }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: MARCA_COLOR }} /> Marcação
            </span>
            <span className="flex items-center gap-1.5 text-[11px]" style={{ color: VISITA_COLOR }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: VISITA_COLOR }} /> Visita
            </span>
          </div>
        </div>

        {/* Timeline */}
        <div className="overflow-y-auto flex-1 px-4 py-4" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {groups === null ? (
            <div className="flex justify-center py-10">
              <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: '#C9A84C', borderTopColor: 'transparent' }} />
            </div>
          ) : groups.length === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: '#6B6560' }}>Nenhum registro encontrado.</p>
          ) : groups.map(({ record, marcacaoDate, visits }) => {
            const isCurrent = record.id === currentClientId
            return (
              <div key={record.id} style={{ borderLeft: `2px solid ${MARCA_COLOR}40`, paddingLeft: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {/* Marcação */}
                <button onClick={() => onOpenClient(record, { openStar: false })}
                  className="w-full text-left rounded-xl transition-all active:scale-[0.98]"
                  style={{ background: `${MARCA_COLOR}12`, border: `1px solid ${MARCA_COLOR}40`, padding: '12px 14px' }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <Calendar size={13} style={{ color: MARCA_COLOR, flexShrink: 0 }} />
                      <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: MARCA_COLOR }}>Marcação</span>
                      <span className="text-xs font-semibold tabular-nums" style={{ color: '#EFEFEF' }}>{fmt(marcacaoDate)}</span>
                      {isCurrent && <span className="text-[10px]" style={{ color: '#6B6560' }}>· atual</span>}
                    </div>
                    <ChevronRight size={14} style={{ color: '#444040', flexShrink: 0 }} />
                  </div>
                  {visits.length === 0 && <p className="text-[11px] mt-1" style={{ color: '#E8834A' }}>Sem visita registrada</p>}
                </button>

                {/* Visitas dessa marcação */}
                {visits.map(v => (
                  <button key={v.id} onClick={() => onOpenClient(record, { openStar: true, visitId: v.id })}
                    className="w-full text-left rounded-xl transition-all active:scale-[0.98]"
                    style={{ marginLeft: '16px', background: `${VISITA_COLOR}12`, border: `1px solid ${VISITA_COLOR}40`, padding: '10px 14px' }}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Star size={12} style={{ color: VISITA_COLOR, flexShrink: 0 }} />
                        <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: VISITA_COLOR }}>Visita</span>
                        <span className="text-xs font-semibold tabular-nums" style={{ color: '#EFEFEF' }}>{fmt(v.visit_date)}</span>
                        {v.visit_outcome && <span className="text-[10px] truncate" style={{ color: '#6B6560' }}>· {OUTCOMES[v.visit_outcome] || v.visit_outcome}</span>}
                      </div>
                      <ChevronRight size={14} style={{ color: '#444040', flexShrink: 0 }} />
                    </div>
                  </button>
                ))}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

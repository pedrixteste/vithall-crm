import { useState } from 'react'
import { Calendar, Clock, MapPin, ArrowRight } from 'lucide-react'
import VisitConfirmationList from './VisitConfirmationList'
import { STAGE_BADGES } from './ui/Badge'

// Pop-up ao abrir o app — espelha o conteúdo da aba "Hoje" da pessoa:
//  - confirmações de visitas que ela marcou (hoje + amanhã), com botões
//  - agenda de visitas de hoje (só vendedor/gerente; pré-vendas não tem)
export default function VisitConfirmationModal({ visits, todayVisits = [], onClose, onConfirmed, onOpenAgenda }) {
  const [confirmDone, setConfirmDone] = useState(false)

  const showConfirm = visits.length > 0 && !confirmDone
  const hasToday    = todayVisits.length > 0

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.8)' }}>
      <div className="w-full max-w-lg flex flex-col slide-up sm:animate-in"
        style={{ background: '#1A1A1A', border: '1px solid #252525', borderRadius: '20px 20px 0 0', maxHeight: '92vh' }}>

        {/* Header */}
        <div className="flex-shrink-0 px-5 pt-5 pb-4 border-b" style={{ borderColor: '#1C1C1C' }}>
          <div className="flex items-center gap-2.5 mb-1.5">
            <Calendar size={16} style={{ color: '#C9A84C' }} />
            <h2 className="text-base font-bold" style={{ color: '#EFEFEF' }}>Resumo de hoje</h2>
          </div>
          <p className="text-xs" style={{ color: '#6B6560' }}>
            {showConfirm
              ? `Você tem ${visits.length} ${visits.length === 1 ? 'visita marcada' : 'visitas marcadas'} (hoje e amanhã) para confirmar.`
              : hasToday ? 'Suas visitas agendadas para hoje.' : 'Tudo certo por aqui.'}
          </p>
        </div>

        {/* Conteúdo */}
        <div className="overflow-y-auto flex-1 px-4 py-4" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Confirmar visitas */}
          {showConfirm && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.15em] mb-3 px-1" style={{ color: '#C9A84C' }}>
                Confirmar visitas
              </p>
              <VisitConfirmationList
                visits={visits}
                onConfirmed={onConfirmed}
                onEmpty={() => { setConfirmDone(true); if (!hasToday) onClose() }}
              />
            </div>
          )}

          {/* Visitas de hoje (vendedor/gerente) */}
          {hasToday && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.15em] mb-3 px-1" style={{ color: '#6B6560' }}>
                Visitas de hoje
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {todayVisits.map(v => {
                  const dt = new Date(v.visit_scheduled_at)
                  const timeLabel = dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                  const isPast = dt < new Date()
                  return (
                    <button
                      key={v.id}
                      onClick={onOpenAgenda}
                      className="w-full text-left rounded-2xl transition-all active:scale-[0.98]"
                      style={{ background: '#161616', border: '1px solid #252525', padding: '14px 16px', opacity: isPast ? 0.65 : 1 }}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <Clock size={12} style={{ color: isPast ? '#E8834A' : '#4ADE80' }} />
                        <span className="text-xs font-bold tabular-nums" style={{ color: isPast ? '#E8834A' : '#4ADE80' }}>{timeLabel}</span>
                        {isPast && <span className="text-[9px] font-semibold rounded-full" style={{ padding: '1px 7px', background: 'rgba(232,131,74,0.1)', color: '#E8834A' }}>já passou</span>}
                        <div className="ml-auto">{STAGE_BADGES[v.matricula_stage] || null}</div>
                      </div>
                      <p className="text-sm font-semibold truncate" style={{ color: '#EFEFEF' }}>{v.contact_name}</p>
                      {v.company_name && <p className="text-xs truncate" style={{ color: '#6B6560' }}>{v.company_name}</p>}
                      {(v.city || v.address_street) && (
                        <p className="text-[11px] mt-1.5 flex items-center gap-1 truncate" style={{ color: '#444040' }}>
                          <MapPin size={10} style={{ flexShrink: 0 }} />
                          {[v.address_street, v.address_neighborhood, v.city].filter(Boolean).join(', ')}
                        </p>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-5 py-3 border-t flex flex-col gap-1" style={{ borderColor: '#1C1C1C' }}>
          {hasToday && (
            <button onClick={onOpenAgenda}
              className="w-full flex items-center justify-center gap-1.5 text-xs font-bold py-2.5 rounded-xl transition-all active:scale-95"
              style={{ background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.25)', color: '#C9A84C' }}>
              Ver agenda completa <ArrowRight size={13} />
            </button>
          )}
          <button onClick={onClose}
            className="w-full text-xs font-medium py-2.5 rounded-xl transition-all"
            style={{ color: '#6B6560' }}>
            {showConfirm ? 'Responder depois' : 'Fechar'}
          </button>
        </div>
      </div>
    </div>
  )
}

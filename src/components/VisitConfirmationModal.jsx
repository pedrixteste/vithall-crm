import { Calendar } from 'lucide-react'
import VisitConfirmationList from './VisitConfirmationList'

// Modal que aparece ao abrir o app para quem MARCOU a visita (created_by),
// pedindo para confirmar as visitas agendadas para amanhã.
// O conteúdo da lista vive em VisitConfirmationList (reutilizado na aba "Hoje").
export default function VisitConfirmationModal({ visits, onClose, onConfirmed }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.8)' }}>
      <div className="w-full max-w-lg flex flex-col slide-up sm:animate-in"
        style={{ background: '#1A1A1A', border: '1px solid #252525', borderRadius: '20px 20px 0 0', maxHeight: '92vh' }}>

        {/* Header */}
        <div className="flex-shrink-0 px-5 pt-5 pb-4 border-b" style={{ borderColor: '#1C1C1C' }}>
          <div className="flex items-center gap-2.5 mb-1.5">
            <Calendar size={16} style={{ color: '#C9A84C' }} />
            <h2 className="text-base font-bold" style={{ color: '#EFEFEF' }}>Confirmar visitas de amanhã</h2>
          </div>
          <p className="text-xs" style={{ color: '#6B6560' }}>
            Você tem {visits.length} {visits.length === 1 ? 'visita marcada' : 'visitas marcadas'} para amanhã. Confirme cada uma.
          </p>
        </div>

        {/* Lista */}
        <div className="overflow-y-auto flex-1 px-4 py-4">
          <VisitConfirmationList visits={visits} onConfirmed={onConfirmed} onEmpty={onClose} />
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-5 py-3 border-t" style={{ borderColor: '#1C1C1C' }}>
          <button onClick={onClose}
            className="w-full text-xs font-medium py-2.5 rounded-xl transition-all"
            style={{ color: '#6B6560' }}>
            Responder depois
          </button>
        </div>
      </div>
    </div>
  )
}

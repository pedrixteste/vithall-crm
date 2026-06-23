import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { CheckCircle2, XCircle, PhoneCall, MapPin } from 'lucide-react'

// Lista reutilizável de visitas de amanhã para confirmar, com o fluxo de 3 botões:
//   ✓ Confirmado      → visit_confirmation = 'confirmada'  (verde)
//   ✕ Não confirmada  → 'nao_confirmada' + motivo          (vermelho)
//   ☎ Tentei confirmar→ 'tentativa' + descrição            (roxo)
// Usada tanto no modal do Dashboard quanto inline na aba "Hoje".
const NOTE_CONFIG = {
  nao_confirmada: { label: 'Por que não foi confirmada?', placeholder: 'Ex: cliente desmarcou, pediu para remarcar...', color: '#E85555' },
  tentativa:      { label: 'Descreva as tentativas de confirmação', placeholder: 'Ex: liguei 2x e mandei WhatsApp, não respondeu...', color: '#A78BFA' },
}

export default function VisitConfirmationList({ visits, onConfirmed, onEmpty }) {
  const [pending, setPending]   = useState(visits)
  const [activeId, setActiveId] = useState(null)     // visita aberta para digitar nota
  const [activeKind, setActiveKind] = useState(null) // 'nao_confirmada' | 'tentativa'
  const [note, setNote]         = useState('')
  const [saving, setSaving]     = useState(false)

  async function save(clientId, status, confirmationNote) {
    setSaving(true)
    await supabase
      .from('clients')
      .update({ visit_confirmation: status, visit_confirmation_note: confirmationNote || null })
      .eq('id', clientId)
    setSaving(false)

    const rest = pending.filter(v => v.id !== clientId)
    setPending(rest)
    setActiveId(null)
    setActiveKind(null)
    setNote('')
    onConfirmed?.()
    if (rest.length === 0) onEmpty?.()
  }

  function openNote(clientId, kind) {
    setActiveId(clientId)
    setActiveKind(kind)
    setNote('')
  }

  if (pending.length === 0) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {pending.map(v => {
        const dt = new Date(v.visit_scheduled_at)
        const timeLabel = dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        const isActive = activeId === v.id
        const cfg = activeKind ? NOTE_CONFIG[activeKind] : null

        return (
          <div key={v.id} className="rounded-2xl"
            style={{ background: '#161616', border: '1px solid #252525', padding: '16px' }}>
            {/* Cliente */}
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: '#EFEFEF' }}>{v.contact_name}</p>
                {v.company_name && <p className="text-xs truncate" style={{ color: '#6B6560' }}>{v.company_name}</p>}
                <p className="text-xs font-medium mt-1 flex items-center gap-1.5" style={{ color: '#C9A84C' }}>
                  <span>🕐 {timeLabel}</span>
                  {v.city && <span style={{ color: '#6B6560' }} className="flex items-center gap-1"><MapPin size={10} /> {v.city}</span>}
                </p>
              </div>
            </div>

            {!isActive ? (
              /* 3 botões */
              <div className="grid grid-cols-3 gap-2 mt-2">
                <button
                  disabled={saving}
                  onClick={() => save(v.id, 'confirmada', null)}
                  className="flex flex-col items-center justify-center gap-1.5 rounded-xl px-1.5 py-3.5 transition-all active:scale-95"
                  style={{ minHeight: '68px', background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.3)', color: '#4ADE80' }}>
                  <CheckCircle2 size={17} />
                  <span className="text-[11px] font-bold leading-snug text-center">Confirmado</span>
                </button>
                <button
                  disabled={saving}
                  onClick={() => openNote(v.id, 'nao_confirmada')}
                  className="flex flex-col items-center justify-center gap-1.5 rounded-xl px-1.5 py-3.5 transition-all active:scale-95"
                  style={{ minHeight: '68px', background: 'rgba(232,85,85,0.1)', border: '1px solid rgba(232,85,85,0.3)', color: '#E85555' }}>
                  <XCircle size={17} />
                  <span className="text-[11px] font-bold leading-snug text-center">Não<br/>confirmada</span>
                </button>
                <button
                  disabled={saving}
                  onClick={() => openNote(v.id, 'tentativa')}
                  className="flex flex-col items-center justify-center gap-1.5 rounded-xl px-1.5 py-3.5 transition-all active:scale-95"
                  style={{ minHeight: '68px', background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.3)', color: '#A78BFA' }}>
                  <PhoneCall size={17} />
                  <span className="text-[11px] font-bold leading-snug text-center">Tentei<br/>confirmar</span>
                </button>
              </div>
            ) : (
              /* Campo de nota */
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-widest block mb-2" style={{ color: cfg.color }}>
                  {cfg.label}
                </label>
                <textarea
                  autoFocus
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder={cfg.placeholder}
                  rows={3}
                  className="w-full text-sm outline-none resize-none rounded-xl transition-all"
                  style={{ padding: '12px 14px', background: '#111111', border: `1px solid ${cfg.color}`, color: '#EFEFEF', lineHeight: '1.5' }}
                />
                <div className="flex gap-2 mt-3">
                  <button
                    disabled={saving}
                    onClick={() => { setActiveId(null); setActiveKind(null); setNote('') }}
                    className="flex-1 text-xs font-semibold rounded-xl py-2.5 transition-all active:scale-95"
                    style={{ background: '#1A1A1A', border: '1px solid #252525', color: '#6B6560' }}>
                    Voltar
                  </button>
                  <button
                    disabled={saving || !note.trim()}
                    onClick={() => save(v.id, activeKind, note.trim())}
                    className="flex-1 text-xs font-bold rounded-xl py-2.5 transition-all active:scale-95 disabled:opacity-40"
                    style={{ background: `${cfg.color}1f`, border: `1px solid ${cfg.color}`, color: cfg.color }}>
                    {saving ? 'Salvando...' : 'Salvar'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

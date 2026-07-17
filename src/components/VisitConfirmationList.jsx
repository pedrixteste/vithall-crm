import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { getValidToken, deleteCalendarEvent, createCalendarEvent } from '../lib/googleCalendar'
import { CheckCircle2, XCircle, PhoneCall, MapPin, Calendar, CalendarClock } from 'lucide-react'

// Converte timestamp UTC p/ o formato do input datetime-local (hora local)
function toLocalInputValue(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d)) return ''
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

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
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [pending, setPending]   = useState(visits)
  const [activeId, setActiveId] = useState(null)     // visita aberta para digitar nota/data
  const [activeKind, setActiveKind] = useState(null) // 'nao_confirmada' | 'tentativa' | 'remarcou'
  const [note, setNote]         = useState('')
  const [remarcDate, setRemarcDate] = useState('')   // datetime-local da remarcação
  const [saving, setSaving]     = useState(false)
  const [saveError, setSaveError] = useState(null) // id da visita que falhou ao salvar
  // Pop-up "remover do Google Agenda?" após marcar "não confirmada"
  const [removePrompt, setRemovePrompt] = useState(null) // { clientId, eventId, name }
  const [removeSaving, setRemoveSaving] = useState(false)
  const [removeDone, setRemoveDone]     = useState(false)
  // Cadeia da remarcação: pop-up do Google Agenda → pop-up da agenda de horários
  const [remarcPrompt, setRemarcPrompt] = useState(null) // { clientId, name, oldEventId, newIso, oldDeleted, newAdded }
  const [remarcBusy, setRemarcBusy]     = useState(null) // 'del' | 'add' | null
  const [agendaPrompt, setAgendaPrompt] = useState(null) // { name }
  const pendingEmptyRef = useRef(false) // segura o onEmpty até os pop-ups fecharem

  async function save(clientId, status, confirmationNote) {
    setSaving(true)
    setSaveError(null)
    const { error } = await supabase
      .from('clients')
      .update({ visit_confirmation: status, visit_confirmation_note: confirmationNote || null })
      .eq('id', clientId)
    setSaving(false)

    if (error) {
      // Não remove o card — a resposta NÃO foi salva (provável falta de internet)
      setSaveError(clientId)
      return
    }

    const v = pending.find(x => x.id === clientId)
    const rest = pending.filter(x => x.id !== clientId)
    setPending(rest)
    setActiveId(null)
    setActiveKind(null)
    setNote('')

    // Não confirmada + visita no Google Agenda → oferece remover de lá
    const needPrompt = status === 'nao_confirmada' && v?.google_calendar_event_id && profile?.google_connected
    if (needPrompt) {
      setRemovePrompt({ clientId, eventId: v.google_calendar_event_id, name: v.contact_name || v.company_name || 'Cliente' })
    }

    onConfirmed?.()
    if (rest.length === 0) {
      if (needPrompt) pendingEmptyRef.current = true // fecha só depois do pop-up
      else onEmpty?.()
    }
  }

  function closeRemovePrompt() {
    setRemovePrompt(null)
    setRemoveDone(false)
    if (pendingEmptyRef.current) { pendingEmptyRef.current = false; onEmpty?.() }
  }

  // Mesma engrenagem do botão "Remover da agenda" da ficha do cliente
  async function removeFromCalendar() {
    setRemoveSaving(true)
    try {
      const token = await getValidToken(user.id)
      if (!token) { alert('Conecte o Google Agenda no seu Perfil primeiro.'); return }
      await deleteCalendarEvent(token, removePrompt.eventId)
      await supabase.from('clients').update({ google_calendar_event_id: null }).eq('id', removePrompt.clientId)
      setRemoveDone(true)
      setTimeout(closeRemovePrompt, 1000)
    } catch (e) {
      alert(`Erro ao remover: ${e.message}`)
    } finally {
      setRemoveSaving(false)
    }
  }

  function openNote(clientId, kind) {
    setActiveId(clientId)
    setActiveKind(kind)
    setNote('')
  }

  function openRemarc(v) {
    setActiveId(v.id)
    setActiveKind('remarcou')
    setRemarcDate(toLocalInputValue(v.visit_scheduled_at))
  }

  // ── Remarcou: nova data substitui a antiga e dispara a cadeia de pop-ups ──
  async function saveRemarcou(clientId) {
    if (!remarcDate) return
    const v = pending.find(x => x.id === clientId)
    const newIso = new Date(remarcDate).toISOString()
    setSaving(true)
    setSaveError(null)
    // A data antiga some (é substituída); confirmação zera e quem remarcou
    // passa a ser o responsável pelo novo ciclo de confirmação
    const { error } = await supabase.from('clients').update({
      visit_scheduled_at:      newIso,
      visit_confirmation:      null,
      visit_confirmation_note: null,
      visit_scheduled_by:      user.id,
    }).eq('id', clientId)
    setSaving(false)
    if (error) { setSaveError(clientId); return }

    const rest = pending.filter(x => x.id !== clientId)
    setPending(rest)
    setActiveId(null)
    setActiveKind(null)
    setRemarcDate('')
    onConfirmed?.()
    if (rest.length === 0) pendingEmptyRef.current = true // fecha só no fim da cadeia

    const name = v?.contact_name || v?.company_name || 'Cliente'
    if (profile?.google_connected) {
      setRemarcPrompt({ clientId, name, oldEventId: v?.google_calendar_event_id || null, newIso, oldDeleted: false, newAdded: false })
    } else {
      setAgendaPrompt({ name })
    }
  }

  async function remarcDeleteOld() {
    setRemarcBusy('del')
    try {
      const token = await getValidToken(user.id)
      if (!token) { alert('Conecte o Google Agenda no seu Perfil primeiro.'); return }
      await deleteCalendarEvent(token, remarcPrompt.oldEventId)
      if (!remarcPrompt.newAdded) {
        await supabase.from('clients').update({ google_calendar_event_id: null }).eq('id', remarcPrompt.clientId)
      }
      setRemarcPrompt(p => ({ ...p, oldDeleted: true }))
    } catch (e) {
      alert(`Erro ao apagar: ${e.message}`)
    } finally {
      setRemarcBusy(null)
    }
  }

  async function remarcAddNew() {
    setRemarcBusy('add')
    try {
      const token = await getValidToken(user.id)
      if (!token) { alert('Conecte o Google Agenda no seu Perfil primeiro.'); return }
      const eventId = await createCalendarEvent(token, { clientName: remarcPrompt.name, visitDateTime: remarcPrompt.newIso })
      await supabase.from('clients').update({ google_calendar_event_id: eventId }).eq('id', remarcPrompt.clientId)
      setRemarcPrompt(p => ({ ...p, newAdded: true }))
    } catch (e) {
      alert(`Erro ao adicionar: ${e.message}`)
    } finally {
      setRemarcBusy(null)
    }
  }

  function closeRemarcPrompt() {
    const name = remarcPrompt?.name
    setRemarcPrompt(null)
    setAgendaPrompt({ name }) // próximo passo da cadeia: agenda de horários
  }

  function closeAgendaPrompt(goToAgenda = false) {
    setAgendaPrompt(null)
    if (pendingEmptyRef.current) { pendingEmptyRef.current = false; onEmpty?.() }
    if (goToAgenda) navigate('/agendas')
  }

  // segue montado enquanto algum pop-up da cadeia estiver aberto
  if (pending.length === 0 && !removePrompt && !remarcPrompt && !agendaPrompt) return null

  return (
    <>
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {pending.map(v => {
        const dt = new Date(v.visit_scheduled_at)
        const timeLabel = dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        const dateLabel = dt.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }).replace('.', '')
        const isActive = activeId === v.id
        const cfg = activeKind ? NOTE_CONFIG[activeKind] : null

        return (
          <div key={v.id} className="rounded-2xl"
            style={{ background: '#161616', border: '1px solid #252525', padding: '16px' }}>
            {saveError === v.id && (
              <p className="text-[11px] font-semibold rounded-xl mb-3"
                style={{ padding: '8px 10px', color: '#E85555', background: 'rgba(232,85,85,0.08)', border: '1px solid rgba(232,85,85,0.25)' }}>
                Não foi possível salvar — verifique sua internet e tente de novo.
              </p>
            )}
            {/* Cliente */}
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: '#EFEFEF' }}>{v.contact_name}</p>
                {v.company_name && <p className="text-xs truncate" style={{ color: '#6B6560' }}>{v.company_name}</p>}
                <p className="text-xs font-medium mt-1 flex items-center gap-1.5" style={{ color: '#C9A84C' }}>
                  <span>🕐 {dateLabel} · {timeLabel}</span>
                  {v.city && <span style={{ color: '#6B6560' }} className="flex items-center gap-1"><MapPin size={10} /> {v.city}</span>}
                </p>
              </div>
            </div>

            {!isActive ? (
              /* 4 botões (2×2) */
              <div className="grid grid-cols-2 gap-2 mt-2">
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
                  <span className="text-[11px] font-bold leading-snug text-center">Não confirmada</span>
                </button>
                <button
                  disabled={saving}
                  onClick={() => openNote(v.id, 'tentativa')}
                  className="flex flex-col items-center justify-center gap-1.5 rounded-xl px-1.5 py-3.5 transition-all active:scale-95"
                  style={{ minHeight: '68px', background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.3)', color: '#A78BFA' }}>
                  <PhoneCall size={17} />
                  <span className="text-[11px] font-bold leading-snug text-center">Tentei confirmar</span>
                </button>
                <button
                  disabled={saving}
                  onClick={() => openRemarc(v)}
                  className="flex flex-col items-center justify-center gap-1.5 rounded-xl px-1.5 py-3.5 transition-all active:scale-95"
                  style={{ minHeight: '68px', background: 'rgba(34,211,238,0.1)', border: '1px solid rgba(34,211,238,0.3)', color: '#22D3EE' }}>
                  <CalendarClock size={17} />
                  <span className="text-[11px] font-bold leading-snug text-center">Remarcou</span>
                </button>
              </div>
            ) : activeKind === 'remarcou' ? (
              /* Nova data da visita remarcada */
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-widest block mb-2" style={{ color: '#22D3EE' }}>
                  Nova data e hora da visita
                </label>
                <input
                  type="datetime-local"
                  autoFocus
                  value={remarcDate}
                  onChange={e => setRemarcDate(e.target.value)}
                  className="w-full text-sm outline-none rounded-xl transition-all"
                  style={{ padding: '12px 14px', background: '#111111', border: '1px solid #22D3EE', color: '#EFEFEF' }}
                />
                <p className="text-[11px] mt-1.5" style={{ color: '#555050' }}>
                  A data antiga é substituída — a visita some do dia anterior e vai para o novo.
                </p>
                <div className="flex gap-2 mt-3">
                  <button
                    disabled={saving}
                    onClick={() => { setActiveId(null); setActiveKind(null); setRemarcDate('') }}
                    className="flex-1 text-xs font-semibold rounded-xl py-2.5 transition-all active:scale-95"
                    style={{ background: '#1A1A1A', border: '1px solid #252525', color: '#6B6560' }}>
                    Voltar
                  </button>
                  <button
                    disabled={saving || !remarcDate}
                    onClick={() => saveRemarcou(v.id)}
                    className="flex-1 text-xs font-bold rounded-xl py-2.5 transition-all active:scale-95 disabled:opacity-40"
                    style={{ background: 'rgba(34,211,238,0.12)', border: '1px solid #22D3EE', color: '#22D3EE' }}>
                    {saving ? 'Salvando...' : 'Salvar nova data'}
                  </button>
                </div>
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

    {/* Pop-up: visita não confirmada → remover do Google Agenda? */}
    {removePrompt && createPortal(
      <div className="fixed inset-0 z-[90] flex items-center justify-center px-6"
        style={{ background: 'rgba(0,0,0,0.85)' }}>
        <div className="w-full max-w-sm rounded-2xl animate-in"
          style={{ background: '#1A1A1A', border: '1px solid #303030', padding: '24px', textAlign: 'center' }}>
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: 'rgba(232,85,85,0.1)', border: '1px solid rgba(232,85,85,0.25)' }}>
            <Calendar size={20} style={{ color: '#E85555' }} />
          </div>
          {removeDone ? (
            <p className="text-sm font-semibold" style={{ color: '#4ADE80' }}>✓ Removida do Google Agenda!</p>
          ) : (
            <>
              <h2 className="text-base font-bold mb-2" style={{ color: '#EFEFEF' }}>Remover esta visita do Google Agenda?</h2>
              <p className="text-sm mb-5" style={{ color: '#B0A99F', lineHeight: 1.5 }}>
                A visita de <b style={{ color: '#EFEFEF' }}>"{removePrompt.name}"</b> não foi confirmada
                e ainda está no seu Google Agenda.
              </p>
              <button type="button" onClick={removeFromCalendar} disabled={removeSaving}
                className="w-full py-3 rounded-xl text-sm font-bold transition-all active:scale-[0.98] mb-2"
                style={{ background: 'rgba(232,85,85,0.12)', border: '1px solid rgba(232,85,85,0.4)', color: '#E85555' }}>
                <span className="inline-flex items-center gap-2"><Calendar size={14} /> {removeSaving ? 'Removendo...' : 'Remover do Google Agenda'}</span>
              </button>
              <button type="button" onClick={closeRemovePrompt} disabled={removeSaving}
                className="w-full py-2.5 rounded-xl text-xs font-medium transition-all"
                style={{ background: 'transparent', color: '#6B6560' }}>
                Manter na agenda
              </button>
            </>
          )}
        </div>
      </div>,
      document.body
    )}

    {/* Pop-up 1 da remarcação: atualizar o Google Agenda */}
    {remarcPrompt && createPortal(
      <div className="fixed inset-0 z-[90] flex items-center justify-center px-6"
        style={{ background: 'rgba(0,0,0,0.85)' }}>
        <div className="w-full max-w-sm rounded-2xl animate-in"
          style={{ background: '#1A1A1A', border: '1px solid #303030', padding: '24px', textAlign: 'center' }}>
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: 'rgba(34,211,238,0.1)', border: '1px solid rgba(34,211,238,0.25)' }}>
            <Calendar size={20} style={{ color: '#22D3EE' }} />
          </div>
          <h2 className="text-base font-bold mb-2" style={{ color: '#EFEFEF' }}>Atualizar o Google Agenda?</h2>
          <p className="text-sm mb-5" style={{ color: '#B0A99F', lineHeight: 1.5 }}>
            Visita de <b style={{ color: '#EFEFEF' }}>"{remarcPrompt.name}"</b> remarcada para{' '}
            <b style={{ color: '#22D3EE' }}>
              {new Date(remarcPrompt.newIso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
              {' às '}
              {new Date(remarcPrompt.newIso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </b>. Deseja apagar o agendamento antigo e adicionar o novo?
          </p>
          {remarcPrompt.oldEventId && (
            <button type="button" onClick={remarcDeleteOld} disabled={remarcBusy !== null || remarcPrompt.oldDeleted}
              className="w-full py-3 rounded-xl text-sm font-bold transition-all active:scale-[0.98] mb-2"
              style={remarcPrompt.oldDeleted
                ? { background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.3)', color: '#4ADE80' }
                : { background: 'rgba(232,85,85,0.12)', border: '1px solid rgba(232,85,85,0.4)', color: '#E85555' }}>
              {remarcPrompt.oldDeleted ? '✓ Evento antigo apagado' : remarcBusy === 'del' ? 'Apagando...' : '🗑 Apagar evento antigo'}
            </button>
          )}
          <button type="button" onClick={remarcAddNew} disabled={remarcBusy !== null || remarcPrompt.newAdded}
            className="w-full py-3 rounded-xl text-sm font-bold transition-all active:scale-[0.98] mb-2"
            style={remarcPrompt.newAdded
              ? { background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.3)', color: '#4ADE80' }
              : { background: 'linear-gradient(135deg, #7B1C3A, #C9A84C)', border: 'none', color: '#F0EAD6' }}>
            {remarcPrompt.newAdded ? '✓ Novo evento adicionado' : remarcBusy === 'add' ? 'Adicionando...' : '📅 Adicionar novo evento'}
          </button>
          <button type="button" onClick={closeRemarcPrompt} disabled={remarcBusy !== null}
            className="w-full py-2.5 rounded-xl text-xs font-medium transition-all"
            style={{ background: 'transparent', color: '#6B6560' }}>
            Continuar
          </button>
        </div>
      </div>,
      document.body
    )}

    {/* Pop-up 2 da remarcação: lembrar de ajustar a agenda de horários */}
    {agendaPrompt && createPortal(
      <div className="fixed inset-0 z-[90] flex items-center justify-center px-6"
        style={{ background: 'rgba(0,0,0,0.85)' }}>
        <div className="w-full max-w-sm rounded-2xl animate-in"
          style={{ background: '#1A1A1A', border: '1px solid #303030', padding: '24px', textAlign: 'center' }}>
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.25)' }}>
            <CalendarClock size={20} style={{ color: '#C9A84C' }} />
          </div>
          <h2 className="text-base font-bold mb-2" style={{ color: '#EFEFEF' }}>Ajustar a agenda de horários</h2>
          <p className="text-sm mb-5" style={{ color: '#B0A99F', lineHeight: 1.5 }}>
            A visita de <b style={{ color: '#EFEFEF' }}>"{agendaPrompt.name}"</b> mudou de horário.
            Na aba <b style={{ color: '#C9A84C' }}>Agenda</b>, ocupe o horário novo do vendedor
            e libere o antigo, que não será mais usado.
          </p>
          <button type="button" onClick={() => closeAgendaPrompt(true)}
            className="w-full py-3 rounded-xl text-sm font-bold transition-all active:scale-[0.98] mb-2"
            style={{ background: 'linear-gradient(135deg, #7B1C3A, #C9A84C)', border: 'none', color: '#F0EAD6' }}>
            <span className="inline-flex items-center gap-2"><CalendarClock size={14} /> Ir para a agenda</span>
          </button>
          <button type="button" onClick={() => closeAgendaPrompt(false)}
            className="w-full py-2.5 rounded-xl text-xs font-medium transition-all"
            style={{ background: 'transparent', color: '#6B6560' }}>
            Agora não
          </button>
        </div>
      </div>,
      document.body
    )}
    </>
  )
}

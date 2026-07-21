import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { CalendarClock, ChevronLeft, ChevronRight, Plus, Trash2, Lock, LockOpen } from 'lucide-react'

// Agenda de disponibilidade: cada vendedor/gerente abre horários de visita;
// qualquer um consulta e ocupa (com anotação de cliente/cidade). Ferramenta de
// organização entre pré-vendas e vendedores — SEM vínculo com o cadastro de cliente.

// Date local → 'YYYY-MM-DD'
function dayKey(d) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}
// Limites (ISO/UTC) do dia local
function dayBounds(dateStr) {
  return {
    start: new Date(dateStr + 'T00:00:00').toISOString(),
    end:   new Date(dateStr + 'T23:59:59.999').toISOString(),
  }
}
const timeOf = ts => new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

const ROLE_COLORS = { gerente: '#C9A84C', vendedor: '#A78BFA' }

export default function AgendaPage() {
  const { user, profile } = useAuth()
  const [profilesMap, setProfilesMap] = useState({})   // todos os perfis (p/ nome de quem ocupou)
  const [sellers, setSellers]         = useState([])   // vendedores + gerente (donos de agenda)
  const [sellerId, setSellerId]       = useState(null)
  const [dateStr, setDateStr]         = useState(dayKey(new Date()))
  const [slots, setSlots]             = useState([])
  const [loading, setLoading]         = useState(true)
  const [newTime, setNewTime]         = useState('')
  const [occupyingId, setOccupyingId] = useState(null) // slot com o form de ocupação aberto
  const [note, setNote]               = useState('')
  const [saving, setSaving]           = useState(false)
  const [errorMsg, setErrorMsg]       = useState('')
  // Pop-up "reservar no Google Agenda do vendedor?" após ocupar
  const [calPrompt, setCalPrompt]     = useState(null) // { slot, busy, done, error }

  const isOwner = sellerId === user?.id

  // Perfis: donos de agenda (vendedor/gerente) + mapa de nomes de todo mundo
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('profiles').select('id, name, role')
      const all = data || []
      setProfilesMap(Object.fromEntries(all.map(p => [p.id, p])))
      const owners = all.filter(p => p.role === 'vendedor' || p.role === 'gerente')
        .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR'))
      setSellers(owners)
      // padrão: a própria agenda (se for vendedor/gerente), senão a primeira
      const mine = owners.find(p => p.id === user?.id)
      setSellerId(mine?.id || owners[0]?.id || null)
    })()
  }, [user?.id])

  useEffect(() => { if (sellerId) fetchSlots() }, [sellerId, dateStr])

  async function fetchSlots() {
    setLoading(true)
    const { start, end } = dayBounds(dateStr)
    const { data } = await supabase
      .from('agenda_slots')
      .select('*')
      .eq('seller_id', sellerId)
      .gte('slot_at', start)
      .lte('slot_at', end)
      .order('slot_at', { ascending: true })
    setSlots(data || [])
    setLoading(false)
  }

  function shiftDay(days) {
    const d = new Date(dateStr + 'T12:00:00')
    d.setDate(d.getDate() + days)
    setDateStr(dayKey(d))
    setOccupyingId(null)
  }

  // ── Ações ───────────────────────────────────────────────────────

  async function addSlot() {
    if (!newTime) return
    setSaving(true); setErrorMsg('')
    const slotAt = new Date(`${dateStr}T${newTime}:00`).toISOString()
    const { error } = await supabase.from('agenda_slots').insert({ seller_id: user.id, slot_at: slotAt })
    setSaving(false)
    if (error) {
      setErrorMsg(error.code === '23505'
        ? 'Esse horário já existe na sua agenda deste dia.'
        : 'Não foi possível salvar — verifique sua internet.')
      return
    }
    setNewTime('')
    fetchSlots()
  }

  async function removeSlot(slot) {
    if (!confirm(`Remover o horário ${timeOf(slot.slot_at)} da sua agenda?`)) return
    setErrorMsg('')
    const { error } = await supabase.from('agenda_slots').delete().eq('id', slot.id)
    if (error) { setErrorMsg('Não foi possível remover — verifique sua internet.'); return }
    fetchSlots()
  }

  async function occupySlot(slot) {
    const trimmed = note.trim()
    if (!trimmed) return
    setSaving(true); setErrorMsg('')
    // só ocupa se ainda estiver livre (evita duas pessoas no mesmo horário)
    const { data, error } = await supabase
      .from('agenda_slots')
      .update({ status: 'ocupado', booked_by: user.id, booked_note: trimmed })
      .eq('id', slot.id)
      .eq('status', 'livre')
      .select()
    setSaving(false)
    if (error) { setErrorMsg('Não foi possível salvar — verifique sua internet.'); return }
    if (!data || data.length === 0) {
      setErrorMsg('Esse horário acabou de ser ocupado por outra pessoa.')
      fetchSlots()
      return
    }
    setOccupyingId(null)
    setNote('')
    fetchSlots()
    // O horário já está reservado no CRM; o Google Agenda é o passo seguinte
    setCalPrompt({ slot: data[0], busy: false, done: false, error: '' })
  }

  // Cria/remove o evento na agenda do VENDEDOR. Vai pelo servidor porque o
  // token do Google dele não é legível daqui (RLS own-row, de propósito).
  async function syncSlotCalendar(slot, action) {
    const { data, error } = await supabase.functions.invoke('agenda-calendar', {
      body: { slotId: slot.id, action },
    })
    if (error) return { ok: false, reason: 'Falha de conexão com o servidor.' }
    return data || { ok: false, reason: 'Resposta vazia do servidor.' }
  }

  async function confirmCalendar() {
    setCalPrompt(p => ({ ...p, busy: true, error: '' }))
    const r = await syncSlotCalendar(calPrompt.slot, 'create')
    if (!r.ok) { setCalPrompt(p => ({ ...p, busy: false, error: r.reason || 'Não foi possível reservar.' })); return }
    setCalPrompt(p => ({ ...p, busy: false, done: true }))
    fetchSlots()
    setTimeout(() => setCalPrompt(null), 1200)
  }

  async function freeSlot(slot) {
    if (!confirm(`Liberar o horário ${timeOf(slot.slot_at)}?`)) return
    setErrorMsg('')
    // Tira da agenda do vendedor ANTES de liberar, senão perco o id do evento
    if (slot.google_calendar_event_id) {
      const r = await syncSlotCalendar(slot, 'delete')
      if (!r.ok) setErrorMsg(`Horário liberado, mas o evento seguiu no Google Agenda (${r.reason}). Remova manualmente.`)
    }
    const { error } = await supabase
      .from('agenda_slots')
      .update({ status: 'livre', booked_by: null, booked_note: null, google_calendar_event_id: null })
      .eq('id', slot.id)
    if (error) { setErrorMsg('Não foi possível salvar — verifique sua internet.'); return }
    fetchSlots()
  }

  // ── Render ──────────────────────────────────────────────────────

  const dateLabel = new Date(dateStr + 'T12:00:00')
    .toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })
  const isToday = dateStr === dayKey(new Date())
  const livres = slots.filter(s => s.status === 'livre').length

  return (
    <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.15em] mb-1" style={{ color: '#C9A84C' }}>Disponibilidade</p>
        <h1 style={{ color: '#EFEFEF' }}>Agenda</h1>
        <p className="text-xs mt-1" style={{ color: '#6B6560' }}>
          Horários que cada vendedor abriu para visitas. Ocupe um horário ao combinar uma visita.
        </p>
      </div>

      {/* Seleção de vendedor */}
      <div className="flex flex-wrap" style={{ gap: '6px' }}>
        {sellers.map(s => {
          const active = s.id === sellerId
          const color = ROLE_COLORS[s.role] || '#A78BFA'
          return (
            <button key={s.id} type="button"
              onClick={() => { setSellerId(s.id); setOccupyingId(null) }}
              className="text-xs font-semibold rounded-full transition-all"
              style={{
                padding: '7px 14px',
                background: active ? `${color}18` : '#161616',
                border: `1px solid ${active ? color + '60' : '#2A2A2A'}`,
                color: active ? color : '#6B6560',
              }}>
              {active ? '✓ ' : ''}{s.name?.split(' ')[0] || '—'}{s.id === user?.id ? ' (você)' : ''}
            </button>
          )
        })}
      </div>

      {/* Navegação de dia */}
      <div className="flex items-center gap-2">
        <button onClick={() => shiftDay(-1)} className="flex items-center justify-center rounded-xl flex-shrink-0 transition-all active:scale-95"
          style={{ width: '38px', height: '38px', background: '#161616', border: '1px solid #252525', color: '#6B6560' }}>
          <ChevronLeft size={16} />
        </button>
        <div className="flex-1 relative">
          <input type="date" value={dateStr}
            onChange={e => { if (e.target.value) { setDateStr(e.target.value); setOccupyingId(null) } }}
            className="w-full text-center text-sm font-semibold outline-none rounded-xl"
            style={{ padding: '9px 12px', background: '#161616', border: `1px solid ${isToday ? 'rgba(201,168,76,0.35)' : '#252525'}`, color: isToday ? '#C9A84C' : '#EFEFEF' }}
          />
        </div>
        <button onClick={() => shiftDay(1)} className="flex items-center justify-center rounded-xl flex-shrink-0 transition-all active:scale-95"
          style={{ width: '38px', height: '38px', background: '#161616', border: '1px solid #252525', color: '#6B6560' }}>
          <ChevronRight size={16} />
        </button>
      </div>
      <p className="text-xs capitalize -mt-2" style={{ color: '#6B6560' }}>
        {dateLabel}{isToday ? ' · hoje' : ''}
        {!loading && slots.length > 0 && (
          <span style={{ color: '#444040' }}> — {livres} livre{livres !== 1 ? 's' : ''} de {slots.length}</span>
        )}
      </p>

      {errorMsg && (
        <p className="text-xs rounded-xl" style={{ padding: '10px 12px', color: '#E85555', background: 'rgba(232,85,85,0.08)', border: '1px solid rgba(232,85,85,0.2)' }}>
          {errorMsg}
        </p>
      )}

      {/* Dono da agenda: adicionar horário no dia selecionado */}
      {isOwner && (
        <div className="rounded-2xl" style={{ background: '#15140F', border: '1px solid rgba(201,168,76,0.22)', padding: '14px 16px' }}>
          <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: '#C9A84C' }}>
            Abrir horário neste dia
          </p>
          <div className="flex gap-2">
            <input type="time" value={newTime} onChange={e => setNewTime(e.target.value)}
              className="flex-1 text-sm outline-none rounded-xl"
              style={{ padding: '10px 14px', background: '#111', border: '1px solid #252525', color: '#EFEFEF' }} />
            <button onClick={addSlot} disabled={saving || !newTime}
              className="flex items-center gap-1.5 text-xs font-bold rounded-xl transition-all active:scale-95 disabled:opacity-40"
              style={{ padding: '10px 16px', background: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.35)', color: '#C9A84C' }}>
              <Plus size={14} /> Adicionar
            </button>
          </div>
        </div>
      )}

      {/* Horários */}
      {loading ? (
        <div className="flex justify-center" style={{ padding: '48px 0' }}>
          <div className="w-7 h-7 rounded-full border-2 animate-spin" style={{ borderColor: '#C9A84C', borderTopColor: 'transparent' }} />
        </div>
      ) : slots.length === 0 ? (
        <div className="text-center" style={{ padding: '48px 0' }}>
          <CalendarClock size={28} style={{ color: '#333030', margin: '0 auto 12px' }} />
          <p className="text-sm font-medium mb-1" style={{ color: '#6B6560' }}>Nenhum horário aberto neste dia</p>
          <p className="text-xs" style={{ color: '#333030' }}>
            {isOwner ? 'Use "Abrir horário" acima para disponibilizar.' : `${profilesMap[sellerId]?.name?.split(' ')[0] || 'O vendedor'} ainda não abriu horários para este dia.`}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {slots.map(slot => {
            const free = slot.status === 'livre'
            const color = free ? '#4ADE80' : '#E8834A'
            const canFree = !free && (slot.booked_by === user?.id || isOwner)
            const bookedByName = profilesMap[slot.booked_by]?.name?.split(' ')[0]
            const isOccupying = occupyingId === slot.id

            return (
              <div key={slot.id} className="rounded-2xl"
                style={{ background: '#161616', border: `1px solid ${free ? '#252525' : 'rgba(232,131,74,0.25)'}`, borderLeft: `3px solid ${color}`, padding: '14px 16px' }}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-base font-bold tabular-nums" style={{ color }}>{timeOf(slot.slot_at)}</span>
                    <span className="text-[10px] font-bold uppercase tracking-wide rounded-full flex items-center gap-1"
                      style={{ padding: '3px 9px', background: `${color}14`, border: `1px solid ${color}40`, color }}>
                      {free ? <LockOpen size={9} /> : <Lock size={9} />} {free ? 'Livre' : 'Ocupado'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {free && !isOccupying && (
                      <button onClick={() => { setOccupyingId(slot.id); setNote(''); setErrorMsg('') }}
                        className="text-[11px] font-bold rounded-xl transition-all active:scale-95"
                        style={{ padding: '7px 14px', background: 'rgba(232,131,74,0.1)', border: '1px solid rgba(232,131,74,0.3)', color: '#E8834A' }}>
                        Ocupar
                      </button>
                    )}
                    {free && isOwner && (
                      <button onClick={() => removeSlot(slot)} title="Remover horário"
                        className="flex items-center justify-center rounded-xl transition-all active:scale-95"
                        style={{ width: '30px', height: '30px', background: '#1A1A1A', border: '1px solid #252525', color: '#6B6560' }}>
                        <Trash2 size={13} />
                      </button>
                    )}
                    {canFree && (
                      <button onClick={() => freeSlot(slot)}
                        className="text-[11px] font-bold rounded-xl transition-all active:scale-95"
                        style={{ padding: '7px 14px', background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.3)', color: '#4ADE80' }}>
                        Liberar
                      </button>
                    )}
                  </div>
                </div>

                {/* Ocupado: anotação + quem ocupou */}
                {!free && (
                  <div className="mt-2" style={{ paddingLeft: '2px' }}>
                    {slot.booked_note && (
                      <p className="text-xs" style={{ color: '#B0A99F', lineHeight: 1.5 }}>{slot.booked_note}</p>
                    )}
                    {bookedByName && (
                      <p className="text-[10px] mt-0.5" style={{ color: '#444040' }}>ocupado por {bookedByName}</p>
                    )}
                  </div>
                )}

                {/* Form de ocupação */}
                {free && isOccupying && (
                  <div className="mt-3 pt-3" style={{ borderTop: '1px solid #1F1F1F' }}>
                    <label className="text-[10px] font-bold uppercase tracking-widest block mb-2" style={{ color: '#E8834A' }}>
                      Cliente e cidade *
                    </label>
                    <input autoFocus value={note} onChange={e => setNote(e.target.value)}
                      placeholder="Ex: Fulano · Lajeado"
                      className="w-full text-sm outline-none rounded-xl"
                      style={{ padding: '10px 14px', background: '#111', border: '1px solid rgba(232,131,74,0.4)', color: '#EFEFEF' }} />
                    <p className="text-[10px] mt-1.5" style={{ color: '#555050' }}>
                      Anote a cidade — ajuda o vendedor a agrupar visitas próximas no mesmo dia.
                    </p>
                    <div className="flex gap-2 mt-2.5">
                      <button onClick={() => { setOccupyingId(null); setNote('') }} disabled={saving}
                        className="flex-1 text-xs font-semibold rounded-xl py-2.5 transition-all active:scale-95"
                        style={{ background: '#1A1A1A', border: '1px solid #252525', color: '#6B6560' }}>
                        Cancelar
                      </button>
                      <button onClick={() => occupySlot(slot)} disabled={saving || !note.trim()}
                        className="flex-1 text-xs font-bold rounded-xl py-2.5 transition-all active:scale-95 disabled:opacity-40"
                        style={{ background: 'rgba(232,131,74,0.12)', border: '1px solid #E8834A', color: '#E8834A' }}>
                        {saving ? 'Salvando...' : 'Confirmar ocupação'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Dica de visita longa */}
      {!loading && slots.length > 0 && (
        <p className="text-[11px]" style={{ color: '#333030', lineHeight: 1.5 }}>
          💡 Visita longa? Ocupe todos os horários que ela vai tomar (ex: das 13:00 às 15:30 → ocupe 13:00 e 14:30).
        </p>
      )}

      {/* Pop-up: reservar o horário no Google Agenda do vendedor */}
      {calPrompt && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div className="rounded-2xl" style={{ background: '#161616', border: '1px solid #303030', padding: '22px', maxWidth: '340px', width: '100%' }}>
            {calPrompt.done ? (
              <p className="text-sm font-semibold text-center" style={{ color: '#4ADE80' }}>
                ✓ Reservado no Google Agenda!
              </p>
            ) : (
              <>
                <p className="text-sm font-semibold mb-1.5" style={{ color: '#EFEFEF' }}>
                  Reservar no Google Agenda?
                </p>
                <p className="text-xs mb-3" style={{ color: '#6B6560', lineHeight: 1.5 }}>
                  Cria <b style={{ color: '#B0A99F' }}>"Reservado - {calPrompt.slot?.booked_note}"</b> às{' '}
                  {timeOf(calPrompt.slot?.slot_at)} na agenda de {profilesMap[sellerId]?.name?.split(' ')[0] || 'quem atende'}.
                </p>
                {calPrompt.error && (
                  <p className="text-[11px] font-semibold rounded-xl mb-3"
                    style={{ padding: '8px 10px', color: '#E85555', background: 'rgba(232,85,85,0.08)', border: '1px solid rgba(232,85,85,0.25)' }}>
                    {calPrompt.error}
                  </p>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setCalPrompt(null)} disabled={calPrompt.busy}
                    className="text-xs font-bold rounded-xl py-3 transition-all active:scale-95"
                    style={{ background: '#111', border: '1px solid #252525', color: '#6B6560' }}>
                    Agora não
                  </button>
                  <button onClick={confirmCalendar} disabled={calPrompt.busy}
                    className="text-xs font-bold rounded-xl py-3 transition-all active:scale-95"
                    style={{ background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.4)', color: '#4ADE80' }}>
                    {calPrompt.busy ? 'Reservando...' : 'Reservar'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

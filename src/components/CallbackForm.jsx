import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Sheet } from './ui/Sheet'
import { Input } from './ui/Input'
import { Button } from './ui/Button'
import { PhoneCall } from 'lucide-react'
import SpecificDates from './SpecificDates'
import { reminderDates } from '../lib/utils'

// "Cliente pediu para ligar depois" — lembrete leve de ligação, fora da lista
// de clientes. Só nome + telefone obrigatórios; empresa/cargo opcionais.
// "Quando foi marcada a ligação?" = daily | weekly | specific_date.

const REMINDER_TYPES = [
  { key: 'daily',         label: 'Todo dia' },
  { key: 'weekly',        label: 'Dias da semana' },
  { key: 'specific_date', label: 'Data específica' },
]
const WEEK_DAYS = [
  { key: 'seg', label: 'Seg' }, { key: 'ter', label: 'Ter' }, { key: 'qua', label: 'Qua' },
  { key: 'qui', label: 'Qui' }, { key: 'sex', label: 'Sex' }, { key: 'sab', label: 'Sáb' }, { key: 'dom', label: 'Dom' },
]

export default function CallbackForm({ onClose, onSaved, initialData }) {
  const { user } = useAuth()
  const rc = initialData?.reminder_config
  const [contactName, setContactName] = useState(initialData?.contact_name || '')
  const [phone, setPhone]             = useState(initialData?.phone || '')
  const [companyName, setCompanyName] = useState(initialData?.company_name || '')
  const [contactRole, setContactRole] = useState(initialData?.contact_role || '')
  const [reminderType, setReminderType] = useState(rc?.type || '')
  const [reminderDays, setReminderDays] = useState(rc?.days || [])
  const [reminderDatesList, setReminderDatesList] = useState(rc?.type === 'specific_date' ? reminderDates(rc) : [])
  const [reminderTime, setReminderTime] = useState(rc?.time || '')
  const [notes, setNotes]   = useState(initialData?.notes || '')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError]   = useState('')

  const titleCase = str => str.replace(/(^|\s)\S/g, l => l.toUpperCase())
  const toggleDay = d => setReminderDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])

  async function handleDelete() {
    if (!initialData?.id) return
    if (!confirm('Excluir este "ligar depois"?')) return
    setDeleting(true)
    await supabase.from('callbacks').delete().eq('id', initialData.id)
    setDeleting(false)
    onSaved()
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!contactName.trim()) { setError('Nome e obrigatorio.'); return }
    if (!phone.trim())       { setError('Telefone e obrigatorio.'); return }
    if (!reminderType)       { setError('Escolha quando lembrar de ligar.'); return }
    if (reminderType === 'weekly' && reminderDays.length === 0) { setError('Escolha ao menos um dia da semana.'); return }
    if (reminderType === 'specific_date' && reminderDatesList.length === 0) { setError('Adicione ao menos uma data.'); return }

    let reminder_config = null
    if (reminderType === 'daily')              reminder_config = { type: 'daily' }
    else if (reminderType === 'weekly')        reminder_config = { type: 'weekly', days: reminderDays }
    else if (reminderType === 'specific_date') reminder_config = { type: 'specific_date', dates: reminderDatesList }
    if (reminder_config && reminderTime) reminder_config.time = reminderTime // hora de ligar (o lembrete fica o dia todo)

    setSaving(true); setError('')
    const payload = {
      contact_name:    contactName.trim(),
      phone:           phone.trim(),
      company_name:    companyName.trim() || null,
      contact_role:    contactRole.trim() || null,
      notes:           notes.trim() || null,
      reminder_config,
    }
    const { error: err } = initialData?.id
      ? await supabase.from('callbacks').update(payload).eq('id', initialData.id)
      : await supabase.from('callbacks').insert({ ...payload, created_by: user.id })
    setSaving(false)
    if (err) { setError('Erro ao salvar. Tente novamente.'); return }
    onSaved()
  }

  return (
    <Sheet open onClose={onClose} title={initialData ? 'Editar "ligar depois"' : 'Cliente pediu p/ ligar depois'}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingTop: '4px' }}>

        <p className="text-xs" style={{ color: '#6B6560', lineHeight: 1.5 }}>
          Lembrete de ligação — <b style={{ color: '#B0A99F' }}>não entra na lista de clientes</b>.
          Serve só para você lembrar de ligar nos dias marcados.
        </p>

        <Input label="Nome *" value={contactName}
          onChange={e => setContactName(titleCase(e.target.value))} placeholder="Nome do contato" required />

        <Input label="Telefone *" value={phone}
          onChange={e => setPhone(e.target.value)} placeholder="(00) 00000-0000" />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <Input label="Empresa" value={companyName}
            onChange={e => setCompanyName(titleCase(e.target.value))} placeholder="Opcional" />
          <Input label="Cargo" value={contactRole}
            onChange={e => setContactRole(titleCase(e.target.value))} placeholder="Opcional" />
        </div>

        {/* Quando foi marcada a ligação? */}
        <div style={{ borderTop: '1px solid #1C1C1C', paddingTop: '18px' }}>
          <div className="flex items-center gap-2" style={{ marginBottom: '10px' }}>
            <PhoneCall size={14} style={{ color: '#E8834A' }} />
            <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: '#6B6560' }}>
              Quando foi marcada a ligacao? *
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '14px' }}>
            {REMINDER_TYPES.map(rt => (
              <button key={rt.key} type="button"
                onClick={() => setReminderType(prev => prev === rt.key ? '' : rt.key)}
                className="text-xs font-semibold rounded-xl transition-all"
                style={{
                  padding: '10px 6px',
                  background: reminderType === rt.key ? 'rgba(232,131,74,0.12)' : '#111',
                  border: `1px solid ${reminderType === rt.key ? 'rgba(232,131,74,0.4)' : '#252525'}`,
                  color: reminderType === rt.key ? '#E8834A' : '#6B6560',
                }}>
                {rt.label}
              </button>
            ))}
          </div>

          {reminderType === 'weekly' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
              {WEEK_DAYS.map(d => (
                <button key={d.key} type="button" onClick={() => toggleDay(d.key)}
                  className="text-xs font-semibold rounded-xl transition-all"
                  style={{
                    padding: '9px 4px',
                    background: reminderDays.includes(d.key) ? 'rgba(232,131,74,0.12)' : '#111',
                    border: `1px solid ${reminderDays.includes(d.key) ? 'rgba(232,131,74,0.4)' : '#252525'}`,
                    color: reminderDays.includes(d.key) ? '#E8834A' : '#6B6560',
                  }}>
                  {d.label}
                </button>
              ))}
            </div>
          )}

          {reminderType === 'specific_date' && (
            <div>
              <SpecificDates dates={reminderDatesList} setDates={setReminderDatesList} color="#E8834A" />
              <p className="text-[11px] mt-1.5" style={{ color: '#555050' }}>
                Aparece no "Hoje" em cada data escolhida. Pode adicionar mais de uma.
              </p>
            </div>
          )}

          {/* Hora de ligar (opcional) — seletor próprio (Hora + Minuto) p/ não
              depender do relógio nativo, que corta o botão em alguns celulares */}
          {reminderType && (() => {
            const [h = '', m = ''] = reminderTime ? reminderTime.split(':') : []
            const setPart = (hh, mm) => setReminderTime((hh !== '' && mm !== '') ? `${hh}:${mm}` : '')
            const selStyle = { padding: '12px 10px', background: '#111', border: '1px solid #252525', color: '#EFEFEF', borderRadius: '12px', fontSize: '14px', outline: 'none', width: '100%' }
            return (
              <div style={{ marginTop: '14px' }}>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: '#444040' }}>
                  Hora de ligar (opcional)
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '8px', alignItems: 'center' }}>
                  <select value={h} onChange={e => setPart(e.target.value, e.target.value ? (m || '00') : '')} style={selStyle}>
                    <option value="">Hora</option>
                    {Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')).map(hh => (
                      <option key={hh} value={hh} style={{ background: '#1A1A1A' }}>{hh}h</option>
                    ))}
                  </select>
                  <span style={{ color: '#6B6560', fontWeight: 700 }}>:</span>
                  <select value={m} onChange={e => setPart(e.target.value ? (h || '00') : '', e.target.value)} style={selStyle}>
                    <option value="">Min</option>
                    {Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0')).map(mm => (
                      <option key={mm} value={mm} style={{ background: '#1A1A1A' }}>{mm}</option>
                    ))}
                  </select>
                </div>
                <p className="text-[11px] mt-1.5" style={{ color: '#555050' }}>
                  Só p/ lembrar o melhor horário — o card fica o dia todo até você concluir.
                </p>
              </div>
            )
          })()}
        </div>

        {/* Descrição (opcional) */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-widest block mb-2" style={{ color: '#6B6560' }}>
            Descricao (opcional)
          </label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
            placeholder="Anote o contexto para lembrar quando for ligar (ex: o que ficou combinado, interesse, melhor abordagem...)"
            className="w-full text-sm outline-none resize-none rounded-xl"
            style={{ padding: '12px 14px', background: '#111', border: '1px solid #252525', color: '#EFEFEF', lineHeight: '1.5' }} />
        </div>

        {error && (
          <p className="text-xs px-3 py-2 rounded-xl"
            style={{ color: '#E85555', background: 'rgba(232,85,85,0.08)', border: '1px solid rgba(232,85,85,0.15)' }}>
            {error}
          </p>
        )}

        <div className="flex gap-3 pt-1">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button type="submit" className="flex-1" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
        </div>

        {initialData?.id && (
          <button type="button" onClick={handleDelete} disabled={deleting}
            className="w-full text-xs font-semibold rounded-xl py-3 transition-all"
            style={{ background: 'rgba(232,85,85,0.08)', border: '1px solid rgba(232,85,85,0.2)', color: '#E85555' }}>
            {deleting ? 'Excluindo...' : 'Excluir este "ligar depois"'}
          </button>
        )}
      </form>
    </Sheet>
  )
}

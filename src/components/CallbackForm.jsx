import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Sheet } from './ui/Sheet'
import { Input } from './ui/Input'
import { Button } from './ui/Button'
import { PhoneCall } from 'lucide-react'

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

export default function CallbackForm({ onClose, onSaved }) {
  const { user } = useAuth()
  const [contactName, setContactName] = useState('')
  const [phone, setPhone]             = useState('')
  const [companyName, setCompanyName] = useState('')
  const [contactRole, setContactRole] = useState('')
  const [reminderType, setReminderType] = useState('')
  const [reminderDays, setReminderDays] = useState([])
  const [reminderDate, setReminderDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const titleCase = str => str.replace(/(^|\s)\S/g, l => l.toUpperCase())
  const toggleDay = d => setReminderDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!contactName.trim()) { setError('Nome e obrigatorio.'); return }
    if (!phone.trim())       { setError('Telefone e obrigatorio.'); return }
    if (!reminderType)       { setError('Escolha quando lembrar de ligar.'); return }
    if (reminderType === 'weekly' && reminderDays.length === 0) { setError('Escolha ao menos um dia da semana.'); return }
    if (reminderType === 'specific_date' && !reminderDate)      { setError('Escolha a data.'); return }

    let reminder_config = null
    if (reminderType === 'daily')              reminder_config = { type: 'daily' }
    else if (reminderType === 'weekly')        reminder_config = { type: 'weekly', days: reminderDays }
    else if (reminderType === 'specific_date') reminder_config = { type: 'specific_date', date: reminderDate }

    setSaving(true); setError('')
    const { error: err } = await supabase.from('callbacks').insert({
      created_by:      user.id,
      contact_name:    contactName.trim(),
      phone:           phone.trim(),
      company_name:    companyName.trim() || null,
      contact_role:    contactRole.trim() || null,
      reminder_config,
    })
    setSaving(false)
    if (err) { setError('Erro ao salvar. Tente novamente.'); return }
    onSaved()
  }

  return (
    <Sheet open onClose={onClose} title="Cliente pediu p/ ligar depois">
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
              <input type="date" value={reminderDate} onChange={e => setReminderDate(e.target.value)}
                className="w-full text-sm outline-none rounded-xl"
                style={{ padding: '12px 14px', background: '#111', border: '1px solid #252525', color: '#EFEFEF' }} />
              <p className="text-[11px] mt-1.5" style={{ color: '#555050' }}>
                Vai aparecer no "Hoje" a partir desse dia, até você marcar como concluído.
              </p>
            </div>
          )}
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
      </form>
    </Sheet>
  )
}

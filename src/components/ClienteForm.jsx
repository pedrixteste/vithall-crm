import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Sheet } from './ui/Sheet'
import { Input, Select } from './ui/Input'
import { Button } from './ui/Button'
import { Clock, Plus, X } from 'lucide-react'

const ORIGINS = ['ligacao fria', 'lead', 'feiras', 'indicacao']
const ORIGIN_LABELS = {
  'ligacao fria': 'Ligacao fria',
  'lead': 'Lead',
  'feiras': 'Feiras',
  'indicacao': 'Indicacao',
}

const MATRICULA_STAGES = [
  { key: 'nao_marcou',     label: 'Nao marcou ainda' },
  { key: 'nao_visitado',   label: 'Nao foi visitado' },
  { key: 'nao_apareceu',   label: 'Nao apareceu na visita' },
  { key: 'recebeu_visita', label: 'Recebeu visita' },
  { key: 'matriculado',    label: 'Matriculado!!' },
]

const REMINDER_TYPES = [
  { key: 'daily',   label: 'Todo dia' },
  { key: 'weekly',  label: 'Dias da semana' },
  { key: 'in_days', label: 'Daqui X dias' },
]

const WEEK_DAYS = [
  { key: 'dom', label: 'D' },
  { key: 'seg', label: 'S' },
  { key: 'ter', label: 'T' },
  { key: 'qua', label: 'Q' },
  { key: 'qui', label: 'Q' },
  { key: 'sex', label: 'S' },
  { key: 'sab', label: 'S' },
]

const PRESET_TIMES = ['07:00', '08:00', '09:00', '12:00', '14:00', '17:00', '18:00', '19:00']

export default function ClienteForm({ onClose, onSaved, initialData }) {
  const { user } = useAuth()
  const [form, setForm] = useState({
    contact_name:    initialData?.contact_name    || '',
    company_name:    initialData?.company_name    || '',
    contact_role:    initialData?.contact_role    || '',
    city:            initialData?.city            || '',
    instagram:       initialData?.instagram       || '',
    phone:           initialData?.phone           || '',
    origin:          initialData?.origin          || '',
    matricula_stage: initialData?.matricula_stage || 'nao_marcou',
    notes:           initialData?.notes           || '',
  })

  const rc = initialData?.reminder_config
  const [reminderType, setReminderType]     = useState(rc?.type    || '')
  const [reminderDays, setReminderDays]     = useState(rc?.days    || [])
  const [reminderInDays, setReminderInDays] = useState(rc?.in_days?.toString() || '')
  const [reminderTimes, setReminderTimes]   = useState(rc?.times   || [])
  const [customTime, setCustomTime]         = useState('')

  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const set = (field, value) => setForm(f => ({ ...f, [field]: value }))

  const toggleDay = (day) =>
    setReminderDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day])

  const toggleTime = (t) =>
    setReminderTimes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t].sort())

  function addCustomTime() {
    const t = customTime.trim()
    if (t && !reminderTimes.includes(t)) {
      setReminderTimes(prev => [...prev, t].sort())
      setCustomTime('')
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.contact_name.trim()) { setError('Nome e obrigatorio.'); return }
    setSaving(true)
    setError('')

    const reminder_config = (reminderType && reminderTimes.length > 0) ? {
      type: reminderType,
      ...(reminderType === 'weekly'  && { days: reminderDays }),
      ...(reminderType === 'in_days' && { in_days: parseInt(reminderInDays) || 7 }),
      times: reminderTimes,
    } : null

    const payload = { ...form, created_by: user.id, reminder_config }
    const res = initialData?.id
      ? await supabase.from('clients').update(payload).eq('id', initialData.id)
      : await supabase.from('clients').insert(payload)

    if (res.error) setError('Erro ao salvar. Tente novamente.')
    else onSaved()
    setSaving(false)
  }

  return (
    <Sheet open onClose={onClose} title={initialData ? 'Editar cliente' : 'Novo cliente'}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingTop: '4px' }}>

        <Input
          label="Nome *"
          value={form.contact_name}
          onChange={e => set('contact_name', e.target.value)}
          placeholder="Nome do cliente"
          required
        />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <Input
            label="Empresa"
            value={form.company_name}
            onChange={e => set('company_name', e.target.value)}
            placeholder="Nome da empresa"
          />
          <Input
            label="Cargo"
            value={form.contact_role}
            onChange={e => set('contact_role', e.target.value)}
            placeholder="Ex: Dono, Gerente"
          />
        </div>

        <Input
          label="Cidade"
          value={form.city}
          onChange={e => set('city', e.target.value)}
          placeholder="Ex: Sao Paulo, SP"
        />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <Input
            label="Instagram"
            value={form.instagram}
            onChange={e => set('instagram', e.target.value)}
            placeholder="@usuario"
          />
          <Input
            label="Celular"
            value={form.phone}
            onChange={e => set('phone', e.target.value)}
            placeholder="(00) 00000-0000"
          />
        </div>

        <Select
          label="Como surgiu?"
          value={form.origin}
          onChange={e => set('origin', e.target.value)}
        >
          <option value="" style={{ background: '#1A1A1A' }}>Selecionar...</option>
          {ORIGINS.map(o => (
            <option key={o} value={o} style={{ background: '#1A1A1A' }}>{ORIGIN_LABELS[o]}</option>
          ))}
        </Select>

        <Select
          label="Estagio da matricula"
          value={form.matricula_stage}
          onChange={e => set('matricula_stage', e.target.value)}
        >
          {MATRICULA_STAGES.map(s => (
            <option key={s.key} value={s.key} style={{ background: '#1A1A1A' }}>{s.label}</option>
          ))}
        </Select>

        {/* ---- LEMBRETES ---- */}
        <div style={{ borderTop: '1px solid #1C1C1C', paddingTop: '20px' }}>

          {/* Header */}
          <div className="flex items-center gap-2" style={{ marginBottom: '6px' }}>
            <Clock size={14} style={{ color: '#C9A84C' }} />
            <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: '#6B6560' }}>
              Quando quer ser lembrado desse cliente?
            </p>
          </div>
          <p className="text-xs" style={{ color: '#383030', marginBottom: '14px' }}>
            Opcional - escolha para receber notificacoes
          </p>

          {/* Tipo de lembrete */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '14px' }}>
            {REMINDER_TYPES.map(rt => (
              <button key={rt.key} type="button"
                onClick={() => setReminderType(prev => prev === rt.key ? '' : rt.key)}
                className="text-xs font-semibold rounded-xl transition-all"
                style={{
                  padding: '10px 6px',
                  background: reminderType === rt.key ? 'rgba(201,168,76,0.12)' : '#111',
                  border: `1px solid ${reminderType === rt.key ? 'rgba(201,168,76,0.35)' : '#252525'}`,
                  color: reminderType === rt.key ? '#C9A84C' : '#6B6560',
                }}>
                {rt.label}
              </button>
            ))}
          </div>

          {/* Dias da semana */}
          {reminderType === 'weekly' && (
            <div style={{ marginBottom: '14px' }}>
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#444040', marginBottom: '8px' }}>Dias</p>
              <div style={{ display: 'flex', gap: '5px' }}>
                {WEEK_DAYS.map((d, i) => (
                  <button key={d.key} type="button"
                    onClick={() => toggleDay(d.key)}
                    style={{
                      flex: 1,
                      aspectRatio: '1',
                      borderRadius: '50%',
                      fontSize: '11px',
                      fontWeight: 700,
                      background: reminderDays.includes(d.key) ? 'rgba(201,168,76,0.15)' : '#111',
                      border: `1px solid ${reminderDays.includes(d.key) ? 'rgba(201,168,76,0.4)' : '#252525'}`,
                      color: reminderDays.includes(d.key) ? '#C9A84C' : '#555050',
                      cursor: 'pointer',
                    }}>
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Daqui X dias */}
          {reminderType === 'in_days' && (
            <div className="flex items-center gap-3" style={{ marginBottom: '14px' }}>
              <input
                type="number"
                min="1" max="365"
                value={reminderInDays}
                onChange={e => setReminderInDays(e.target.value)}
                placeholder="7"
                className="text-sm outline-none text-center"
                style={{ width: '72px', padding: '10px', borderRadius: '12px', background: '#111111', border: '1px solid #252525', color: '#EFEFEF' }}
                onFocus={e => e.target.style.borderColor = '#C9A84C'}
                onBlur={e => e.target.style.borderColor = '#252525'}
              />
              <span className="text-sm" style={{ color: '#6B6560' }}>dias a partir de hoje</span>
            </div>
          )}

          {/* Horarios (aparece quando qualquer tipo for selecionado) */}
          {reminderType && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#444040', marginBottom: '8px' }}>
                Horarios (pode escolher mais de um)
              </p>

              {/* Horarios predefinidos */}
              <div className="flex flex-wrap" style={{ gap: '6px', marginBottom: '10px' }}>
                {PRESET_TIMES.map(t => (
                  <button key={t} type="button" onClick={() => toggleTime(t)}
                    className="text-xs font-medium rounded-full border transition-all"
                    style={{
                      padding: '6px 12px',
                      background: reminderTimes.includes(t) ? 'rgba(201,168,76,0.12)' : 'transparent',
                      borderColor: reminderTimes.includes(t) ? 'rgba(201,168,76,0.4)' : '#252525',
                      color: reminderTimes.includes(t) ? '#C9A84C' : '#6B6560',
                    }}>
                    {t}
                  </button>
                ))}
              </div>

              {/* Input de horario personalizado */}
              <div className="flex gap-2" style={{ marginBottom: '10px' }}>
                <input
                  type="time"
                  value={customTime}
                  onChange={e => setCustomTime(e.target.value)}
                  className="flex-1 text-sm outline-none"
                  style={{ padding: '10px 14px', borderRadius: '12px', background: '#111111', border: '1px solid #252525', color: '#EFEFEF' }}
                  onFocus={e => e.target.style.borderColor = '#C9A84C'}
                  onBlur={e => e.target.style.borderColor = '#252525'}
                />
                <button type="button" onClick={addCustomTime}
                  className="flex items-center justify-center flex-shrink-0"
                  style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#1A1A1A', border: '1px solid #252525', color: '#C9A84C', cursor: 'pointer' }}>
                  <Plus size={16} />
                </button>
              </div>

              {/* Horarios selecionados */}
              {reminderTimes.length > 0 && (
                <div className="flex flex-wrap" style={{ gap: '6px', padding: '10px', borderRadius: '12px', background: '#111', border: '1px solid #1C1C1C' }}>
                  {reminderTimes.map(t => (
                    <button key={t} type="button" onClick={() => toggleTime(t)}
                      className="flex items-center gap-1 text-xs font-semibold rounded-full"
                      style={{ padding: '5px 10px', background: 'rgba(201,168,76,0.12)', color: '#C9A84C', border: '1px solid rgba(201,168,76,0.25)', cursor: 'pointer' }}>
                      {t} <X size={10} />
                    </button>
                  ))}
                </div>
              )}
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

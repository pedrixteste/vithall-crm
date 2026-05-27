import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Sheet } from './ui/Sheet'
import { Input } from './ui/Input'
import { Button } from './ui/Button'
import { Bell, Plus, X } from 'lucide-react'
import { scheduleClientReminder } from '../lib/onesignal'

const PRIORITIES = [
  { key: 'alta',  label: 'Alta',  color: '#E85555', bg: 'rgba(232,85,85,0.1)',   border: 'rgba(232,85,85,0.3)'   },
  { key: 'media', label: 'Média', color: '#E8834A', bg: 'rgba(232,131,74,0.1)',  border: 'rgba(232,131,74,0.3)'  },
  { key: 'baixa', label: 'Baixa', color: '#4ADE80', bg: 'rgba(74,222,128,0.1)',  border: 'rgba(74,222,128,0.3)'  },
]

const REMINDER_TYPES = [
  { key: 'daily',   label: 'Todo dia' },
  { key: 'weekly',  label: 'Dias da semana' },
  { key: 'in_days', label: 'Daqui X dias' },
]

const WEEK_DAYS = [
  { key: 'dom', label: 'D' }, { key: 'seg', label: 'S' }, { key: 'ter', label: 'T' },
  { key: 'qua', label: 'Q' }, { key: 'qui', label: 'Q' }, { key: 'sex', label: 'S' },
  { key: 'sab', label: 'S' },
]

const PRESET_TIMES = ['07:00', '08:00', '09:00', '12:00', '14:00', '17:00', '18:00', '19:00']

export default function TarefaForm({ clientId = null, onClose, onSaved }) {
  const { user } = useAuth()
  const [form, setForm] = useState({ title: '', due_date: '', notes: '' })
  const [priority, setPriority]           = useState('media')
  const [reminderType, setReminderType]   = useState('')
  const [reminderDays, setReminderDays]   = useState([])
  const [reminderInDays, setReminderInDays] = useState('')
  const [reminderTimes, setReminderTimes] = useState([])
  const [customTime, setCustomTime]       = useState('')
  const [saving, setSaving]               = useState(false)
  const [error, setError]                 = useState('')

  const toggleDay  = d => setReminderDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])
  const toggleTime = t => setReminderTimes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t].sort())

  function addCustomTime() {
    const t = customTime.trim()
    if (t && !reminderTimes.includes(t)) { setReminderTimes(prev => [...prev, t].sort()); setCustomTime('') }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.title.trim()) { setError('Título é obrigatório.'); return }
    setSaving(true)
    setError('')

    const reminder_config = (reminderType && reminderTimes.length > 0) ? {
      type: reminderType,
      ...(reminderType === 'weekly'  && { days: reminderDays }),
      ...(reminderType === 'in_days' && { in_days: parseInt(reminderInDays) || 7 }),
      times: reminderTimes,
    } : null

    const { error: err } = await supabase.from('tasks').insert({
      title:           form.title,
      due_date:        form.due_date || null,
      notes:           form.notes,
      client_id:       clientId,
      seller_id:       user.id,
      completed:       false,
      priority,
      reminder_config,
    })

    if (err) {
      setError('Erro ao salvar. Tente novamente.')
    } else {
      if (reminder_config) {
        scheduleClientReminder({
          clientName: form.title,
          clientId: null,
          reminderConfig: reminder_config,
        })
      }
      onSaved()
    }
    setSaving(false)
  }

  return (
    <Sheet open onClose={onClose} title="Nova tarefa">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingTop: '4px' }}>

        <Input
          label="Tarefa *"
          value={form.title}
          onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          placeholder="Ex: Enviar proposta, ligar para confirmar..."
          required
        />

        {/* Prioridade */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-widest block mb-2" style={{ color: '#6B6560' }}>
            Prioridade
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
            {PRIORITIES.map(p => (
              <button key={p.key} type="button" onClick={() => setPriority(p.key)}
                className="text-xs font-bold rounded-xl transition-all"
                style={{
                  padding: '10px 6px',
                  background: priority === p.key ? p.bg : '#111',
                  border: `1px solid ${priority === p.key ? p.border : '#252525'}`,
                  color: priority === p.key ? p.color : '#6B6560',
                }}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <Input
          label="Data limite"
          type="date"
          value={form.due_date}
          onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
        />

        <div>
          <label className="text-xs font-semibold uppercase tracking-widest block mb-2" style={{ color: '#6B6560' }}>
            Observações
          </label>
          <textarea
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            placeholder="Detalhes adicionais..."
            rows={2}
            className="w-full text-sm outline-none resize-none rounded-xl"
            style={{ padding: '12px 14px', background: '#111111', border: '1px solid #252525', color: '#EFEFEF', lineHeight: '1.6' }}
            onFocus={e => e.target.style.borderColor = '#C9A84C'}
            onBlur={e => e.target.style.borderColor = '#252525'}
          />
        </div>

        {/* Lembrete */}
        <div style={{ borderTop: '1px solid #1C1C1C', paddingTop: '20px' }}>
          <div className="flex items-center gap-2" style={{ marginBottom: '6px' }}>
            <Bell size={14} style={{ color: '#C9A84C' }} />
            <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: '#6B6560' }}>
              Lembrete por notificação
            </p>
          </div>
          <p className="text-xs" style={{ color: '#383030', marginBottom: '14px' }}>
            Opcional — receba uma notificação sobre esta tarefa
          </p>

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

          {reminderType === 'weekly' && (
            <div style={{ marginBottom: '14px' }}>
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#444040', marginBottom: '8px' }}>Dias</p>
              <div style={{ display: 'flex', gap: '5px' }}>
                {WEEK_DAYS.map(d => (
                  <button key={d.key} type="button" onClick={() => toggleDay(d.key)}
                    style={{
                      flex: 1, aspectRatio: '1', borderRadius: '50%', fontSize: '11px', fontWeight: 700,
                      background: reminderDays.includes(d.key) ? 'rgba(201,168,76,0.15)' : '#111',
                      border: `1px solid ${reminderDays.includes(d.key) ? 'rgba(201,168,76,0.4)' : '#252525'}`,
                      color: reminderDays.includes(d.key) ? '#C9A84C' : '#555050', cursor: 'pointer',
                    }}>
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {reminderType === 'in_days' && (
            <div className="flex items-center gap-3" style={{ marginBottom: '14px' }}>
              <input type="number" min="1" max="365" value={reminderInDays}
                onChange={e => setReminderInDays(e.target.value)} placeholder="7"
                className="text-sm outline-none text-center"
                style={{ width: '72px', padding: '10px', borderRadius: '12px', background: '#111111', border: '1px solid #252525', color: '#EFEFEF' }}
                onFocus={e => e.target.style.borderColor = '#C9A84C'}
                onBlur={e => e.target.style.borderColor = '#252525'}
              />
              <span className="text-sm" style={{ color: '#6B6560' }}>dias a partir de hoje</span>
            </div>
          )}

          {reminderType && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#444040', marginBottom: '8px' }}>
                Horários
              </p>
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
              <div className="flex gap-2" style={{ marginBottom: '10px' }}>
                <input type="time" value={customTime} onChange={e => setCustomTime(e.target.value)}
                  className="flex-1 text-sm outline-none"
                  style={{ padding: '10px 14px', borderRadius: '12px', background: '#111111', border: '1px solid #252525', color: '#EFEFEF' }}
                  onFocus={e => e.target.style.borderColor = '#C9A84C'}
                  onBlur={e => e.target.style.borderColor = '#252525'}
                />
                <button type="button" onClick={addCustomTime}
                  style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#1A1A1A', border: '1px solid #252525', color: '#C9A84C', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Plus size={16} />
                </button>
              </div>
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

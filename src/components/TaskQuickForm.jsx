import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Sheet } from './ui/Sheet'
import { Input } from './ui/Input'
import { Button } from './ui/Button'
import { urgencyColor, localDateStr } from '../lib/utils'

// Como a tarefa se repete. "once" não gera reminder_config (fica só o
// due_date); os outros dois gravam o padrão que a aba Hoje e o
// reminder-sweep leem para saber se ela cai no dia.
const REPEATS = [
  { key: 'once',   label: 'Uma vez' },
  { key: 'daily',  label: 'Todo dia' },
  { key: 'weekly', label: 'Dias da semana' },
]

const WEEK_DAYS = [
  { key: 'dom', label: 'D' }, { key: 'seg', label: 'S' }, { key: 'ter', label: 'T' },
  { key: 'qua', label: 'Q' }, { key: 'qui', label: 'Q' }, { key: 'sex', label: 'S' },
  { key: 'sab', label: 'S' },
]
const UTEIS = ['seg', 'ter', 'qua', 'qui', 'sex']

export default function TaskQuickForm({ onClose, onSaved }) {
  const { user } = useAuth()
  const [title, setTitle]     = useState('')
  const [repeat, setRepeat]   = useState('once')
  const [days, setDays]       = useState([])
  const [dueDate, setDueDate] = useState('')
  const [dueTime, setDueTime] = useState('')
  const [urgency, setUrgency] = useState(5)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')

  const toggleDay = d => setDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!title.trim()) { setError('Descreva a tarefa.'); return }
    if (repeat === 'weekly' && days.length === 0) { setError('Escolha pelo menos um dia da semana.'); return }
    setSaving(true)
    setError('')

    const priority = urgency >= 7 ? 'alta' : urgency >= 4 ? 'media' : 'baixa'
    const reminder_config = repeat === 'daily'  ? { type: 'daily' }
                          : repeat === 'weekly' ? { type: 'weekly', days }
                          : null

    const { error: err } = await supabase.from('tasks').insert({
      title:     title.trim(),
      // Data única só faz sentido em "uma vez"; repetida é o padrão que manda
      due_date:  repeat === 'once' ? (dueDate || null) : null,
      due_time:  dueTime || null,
      reminder_config,
      urgency,
      priority,
      client_id: null,
      seller_id: user.id,
      completed: false,
    })

    if (err) setError('Erro ao salvar. Tente novamente.')
    else onSaved()
    setSaving(false)
  }

  const color = urgencyColor(urgency)

  return (
    <Sheet open onClose={onClose} title="Nova tarefa">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingTop: '4px' }}>

        <div>
          <label className="text-xs font-semibold uppercase tracking-widest block mb-2" style={{ color: '#6B6560' }}>
            Tarefa *
          </label>
          <textarea
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Ex: Fulano cancelou por causa da enchente, tentar ligar de novo"
            rows={3}
            className="w-full text-sm outline-none resize-none rounded-xl"
            style={{ padding: '12px 14px', background: '#111111', border: '1px solid #252525', color: '#EFEFEF', lineHeight: '1.6' }}
            onFocus={e => e.target.style.borderColor = '#C9A84C'}
            onBlur={e => e.target.style.borderColor = '#252525'}
          />
        </div>

        {/* Repetição */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-widest block mb-2" style={{ color: '#6B6560' }}>
            Quando lembrar
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
            {REPEATS.map(r => (
              <button key={r.key} type="button" onClick={() => setRepeat(r.key)}
                className="text-xs font-bold rounded-xl transition-all"
                style={{
                  padding: '10px 6px',
                  background: repeat === r.key ? 'rgba(34,211,238,0.12)' : '#111',
                  border: `1px solid ${repeat === r.key ? 'rgba(34,211,238,0.4)' : '#252525'}`,
                  color: repeat === r.key ? '#22D3EE' : '#6B6560',
                }}>
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {repeat === 'weekly' && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#444040' }}>Dias</p>
              <button type="button" onClick={() => setDays(UTEIS)}
                className="text-[11px] font-semibold" style={{ color: '#22D3EE' }}>
                Dias úteis
              </button>
            </div>
            <div style={{ display: 'flex', gap: '5px' }}>
              {WEEK_DAYS.map(d => (
                <button key={d.key} type="button" onClick={() => toggleDay(d.key)}
                  style={{
                    flex: 1, aspectRatio: '1', borderRadius: '50%', fontSize: '11px', fontWeight: 700,
                    background: days.includes(d.key) ? 'rgba(34,211,238,0.15)' : '#111',
                    border: `1px solid ${days.includes(d.key) ? 'rgba(34,211,238,0.45)' : '#252525'}`,
                    color: days.includes(d.key) ? '#22D3EE' : '#555050', cursor: 'pointer',
                  }}>
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-3">
          {repeat === 'once' && (
            <div className="flex-1">
              <Input
                label="Dia do lembrete"
                type="date"
                value={dueDate}
                min={localDateStr()}
                onChange={e => setDueDate(e.target.value)}
              />
            </div>
          )}
          <div className="flex-1">
            <Input
              label="Hora"
              type="time"
              value={dueTime}
              onChange={e => setDueTime(e.target.value)}
            />
          </div>
        </div>

        <p className="text-[11px] -mt-2" style={{ color: '#444040', lineHeight: 1.5 }}>
          Com hora marcada, você recebe uma notificação 5 minutos antes.
        </p>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#6B6560' }}>
              Urgência
            </label>
            <span className="text-sm font-bold tabular-nums" style={{ color }}>{urgency}/10</span>
          </div>
          <input
            type="range" min="0" max="10" step="1" value={urgency}
            onChange={e => setUrgency(Number(e.target.value))}
            style={{ width: '100%', accentColor: color }}
          />
          <div className="flex justify-between text-[10px]" style={{ color: '#444040' }}>
            <span>Sem pressa</span>
            <span>Urgente</span>
          </div>
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

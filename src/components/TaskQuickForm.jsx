import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Sheet } from './ui/Sheet'
import { Input } from './ui/Input'
import { Button } from './ui/Button'
import { urgencyColor } from '../lib/utils'

// Tarefa solta (sem cliente vinculado): título livre + dia/hora do lembrete
// + urgência 0-10. Aparece na aba Hoje ("A fazer") a partir do dia marcado.
export default function TaskQuickForm({ onClose, onSaved }) {
  const { user } = useAuth()
  const [title, setTitle]     = useState('')
  const [dueDate, setDueDate] = useState('')
  const [dueTime, setDueTime] = useState('')
  const [urgency, setUrgency] = useState(5)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!title.trim()) { setError('Descreva a tarefa.'); return }
    setSaving(true)
    setError('')

    const priority = urgency >= 7 ? 'alta' : urgency >= 4 ? 'media' : 'baixa'

    const { error: err } = await supabase.from('tasks').insert({
      title:      title.trim(),
      due_date:   dueDate || null,
      due_time:   dueTime || null,
      urgency,
      priority,
      client_id:  null,
      seller_id:  user.id,
      completed:  false,
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

        <div className="flex gap-3">
          <div className="flex-1">
            <Input
              label="Dia do lembrete"
              type="date"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
            />
          </div>
          <div className="flex-1">
            <Input
              label="Hora"
              type="time"
              value={dueTime}
              onChange={e => setDueTime(e.target.value)}
            />
          </div>
        </div>

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

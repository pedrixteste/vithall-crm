import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Sheet } from './ui/Sheet'
import { Input, Textarea } from './ui/Input'
import { Button } from './ui/Button'

export default function TarefaForm({ clientId, onClose, onSaved }) {
  const { user } = useAuth()
  const [form, setForm] = useState({ title: '', due_date: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase.from('tasks').insert({
      ...form, client_id: clientId, seller_id: user.id,
      completed: false, due_date: form.due_date || null,
    })
    if (error) setError('Erro ao salvar.')
    else onSaved()
    setSaving(false)
  }

  return (
    <Sheet open onClose={onClose} title="Nova tarefa">
      <form onSubmit={handleSubmit} className="space-y-4 pt-1">
        <Input label="Tarefa *" value={form.title}
          onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          placeholder="Ex: Enviar proposta, ligar para confirmar..." required />

        <Input label="Data limite" type="date" value={form.due_date}
          onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />

        <Textarea label="Observações" value={form.notes}
          onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          rows={2} placeholder="Detalhes adicionais..." />

        {error && <p className="text-xs" style={{ color: '#E85555' }}>{error}</p>}

        <div className="flex gap-3 pt-1">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button type="submit" className="flex-1" disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </form>
    </Sheet>
  )
}

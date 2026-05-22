import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { X } from 'lucide-react'

const inputStyle = {
  background: '#161616',
  border: '1px solid #2A2A2A',
  color: '#F0EAD6',
  width: '100%',
  padding: '10px 14px',
  borderRadius: '10px',
  fontSize: '14px',
  outline: 'none',
  marginTop: '4px',
}

const labelStyle = {
  fontSize: '11px',
  fontWeight: '600',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: '#7A7570',
}

export default function TarefaForm({ clientId, onClose, onSaved }) {
  const { user } = useAuth()
  const [form, setForm] = useState({ title: '', due_date: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase.from('tasks').insert({
      ...form, client_id: clientId, seller_id: user.id, completed: false, due_date: form.due_date || null,
    })
    if (error) setError('Erro ao salvar.')
    else onSaved()
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.8)' }}>
      <div className="w-full max-w-lg" style={{
        background: '#1E1E1E',
        border: '1px solid #2A2A2A',
        borderRadius: '20px 20px 0 0',
      }}>
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full" style={{ background: '#2A2A2A' }} />
        </div>

        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: '#2A2A2A' }}>
          <h2 className="font-bold text-base" style={{ color: '#F0EAD6' }}>Nova tarefa</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color: '#7A7570', background: '#2A2A2A' }}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label style={labelStyle}>Tarefa *</label>
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              style={inputStyle} placeholder="Ex: Enviar proposta, ligar para confirmar..." required
              onFocus={e => e.target.style.borderColor = '#C9A84C'}
              onBlur={e => e.target.style.borderColor = '#2A2A2A'} />
          </div>
          <div>
            <label style={labelStyle}>Data limite</label>
            <input type="date" value={form.due_date}
              onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
              style={inputStyle}
              onFocus={e => e.target.style.borderColor = '#C9A84C'}
              onBlur={e => e.target.style.borderColor = '#2A2A2A'} />
          </div>
          <div>
            <label style={labelStyle}>Observações</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2}
              style={{ ...inputStyle, resize: 'none' }} placeholder="Detalhes adicionais..."
              onFocus={e => e.target.style.borderColor = '#C9A84C'}
              onBlur={e => e.target.style.borderColor = '#2A2A2A'} />
          </div>

          {error && <p className="text-xs" style={{ color: '#E88080' }}>{error}</p>}

          <div className="flex gap-3 pb-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-3 rounded-xl text-sm font-medium"
              style={{ background: '#2A2A2A', color: '#7A7570' }}>
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-3 rounded-xl text-sm font-semibold"
              style={{
                background: saving ? '#2A2A2A' : 'linear-gradient(135deg, #7B1C3A, #C9A84C)',
                color: saving ? '#7A7570' : '#F0EAD6',
              }}>
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

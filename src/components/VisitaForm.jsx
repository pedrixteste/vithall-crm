import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { X, Plus } from 'lucide-react'

const EXEMPLOS_SUGERIDOS = [
  'Case de sucesso', 'ROI demonstrado', 'Produto ao vivo', 'Depoimento de cliente',
  'Comparativo concorrentes', 'Planilha de resultados', 'Vídeo institucional', 'Proposta personalizada'
]

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

export default function VisitaForm({ clientId, onClose, onSaved }) {
  const { user } = useAuth()
  const [form, setForm] = useState({
    visit_date: new Date().toISOString().split('T')[0],
    outcome: '',
    next_step: '',
    notes: '',
  })
  const [exemplos, setExemplos] = useState([])
  const [customExemplo, setCustomExemplo] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function toggleExemplo(ex) {
    setExemplos(prev => prev.includes(ex) ? prev.filter(e => e !== ex) : [...prev, ex])
  }

  function addCustomExemplo() {
    if (customExemplo.trim() && !exemplos.includes(customExemplo.trim())) {
      setExemplos(prev => [...prev, customExemplo.trim()])
      setCustomExemplo('')
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase.from('visits').insert({
      ...form, client_id: clientId, seller_id: user.id, examples_shown: exemplos,
    })
    if (error) setError('Erro ao salvar.')
    else onSaved()
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.8)' }}>
      <div className="w-full max-w-lg flex flex-col" style={{
        background: '#1E1E1E',
        border: '1px solid #2A2A2A',
        borderRadius: '20px 20px 0 0',
        maxHeight: '92vh',
      }}>
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full" style={{ background: '#2A2A2A' }} />
        </div>

        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: '#2A2A2A' }}>
          <h2 className="font-bold text-base" style={{ color: '#F0EAD6' }}>Registrar visita</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color: '#7A7570', background: '#2A2A2A' }}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto p-5 space-y-5 flex-1">
          <div>
            <label style={labelStyle}>Data da visita *</label>
            <input type="date" value={form.visit_date}
              onChange={e => setForm(f => ({ ...f, visit_date: e.target.value }))}
              style={inputStyle} required
              onFocus={e => e.target.style.borderColor = '#C9A84C'}
              onBlur={e => e.target.style.borderColor = '#2A2A2A'} />
          </div>

          <div>
            <label style={{ ...labelStyle, display: 'block', marginBottom: '10px' }}>
              Exemplos apresentados
            </label>
            <div className="flex flex-wrap gap-2 mb-3">
              {EXEMPLOS_SUGERIDOS.map(ex => (
                <button key={ex} type="button" onClick={() => toggleExemplo(ex)}
                  className="text-xs px-3 py-1.5 rounded-full transition-all"
                  style={{
                    background: exemplos.includes(ex) ? 'rgba(201,168,76,0.2)' : '#161616',
                    border: exemplos.includes(ex) ? '1px solid rgba(201,168,76,0.5)' : '1px solid #2A2A2A',
                    color: exemplos.includes(ex) ? '#C9A84C' : '#7A7570',
                  }}>
                  {ex}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input value={customExemplo}
                onChange={e => setCustomExemplo(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCustomExemplo())}
                placeholder="Exemplo personalizado..."
                style={{ ...inputStyle, marginTop: 0, flex: 1 }}
                onFocus={e => e.target.style.borderColor = '#C9A84C'}
                onBlur={e => e.target.style.borderColor = '#2A2A2A'} />
              <button type="button" onClick={addCustomExemplo}
                className="px-3 rounded-xl flex items-center justify-center"
                style={{ background: '#2A2A2A', color: '#C9A84C', border: '1px solid #2A2A2A' }}>
                <Plus size={16} />
              </button>
            </div>
            {exemplos.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {exemplos.map(ex => (
                  <span key={ex} onClick={() => toggleExemplo(ex)}
                    className="text-xs px-2.5 py-1 rounded-full cursor-pointer transition-all"
                    style={{ background: 'rgba(201,168,76,0.15)', color: '#C9A84C', border: '1px solid rgba(201,168,76,0.3)' }}>
                    {ex} ×
                  </span>
                ))}
              </div>
            )}
          </div>

          <div>
            <label style={labelStyle}>Resultado da visita</label>
            <input value={form.outcome} onChange={e => setForm(f => ({ ...f, outcome: e.target.value }))}
              style={inputStyle} placeholder="Ex: Interesse confirmado, pediu proposta..."
              onFocus={e => e.target.style.borderColor = '#C9A84C'}
              onBlur={e => e.target.style.borderColor = '#2A2A2A'} />
          </div>

          <div>
            <label style={labelStyle}>Próximo passo</label>
            <input value={form.next_step} onChange={e => setForm(f => ({ ...f, next_step: e.target.value }))}
              style={inputStyle} placeholder="Ex: Retornar em 1 semana com proposta"
              onFocus={e => e.target.style.borderColor = '#C9A84C'}
              onBlur={e => e.target.style.borderColor = '#2A2A2A'} />
          </div>

          <div>
            <label style={labelStyle}>Observações</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3}
              style={{ ...inputStyle, resize: 'none' }} placeholder="Anotações adicionais..."
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
              {saving ? 'Salvando...' : 'Salvar visita'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

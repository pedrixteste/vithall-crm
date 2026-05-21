import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { X, Plus } from 'lucide-react'

const EXEMPLOS_SUGERIDOS = [
  'Case de sucesso', 'ROI demonstrado', 'Produto ao vivo', 'Depoimento de cliente',
  'Comparativo concorrentes', 'Planilha de resultados', 'Vídeo institucional', 'Proposta personalizada'
]

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
    setError('')

    const { error } = await supabase.from('visits').insert({
      ...form,
      client_id: clientId,
      seller_id: user.id,
      examples_shown: exemplos,
    })

    if (error) setError('Erro ao salvar. Tente novamente.')
    else onSaved()
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center">
      <div className="bg-white w-full max-w-lg rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-800">Registrar visita</h2>
          <button onClick={onClose}><X size={20} className="text-gray-400" /></button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto p-4 space-y-4 flex-1">
          <div>
            <label className="text-xs font-medium text-gray-600">Data da visita *</label>
            <input type="date" value={form.visit_date}
              onChange={e => setForm(f => ({ ...f, visit_date: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 block mb-2">Exemplos apresentados</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {EXEMPLOS_SUGERIDOS.map(ex => (
                <button key={ex} type="button" onClick={() => toggleExemplo(ex)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition
                    ${exemplos.includes(ex)
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'}`}>
                  {ex}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={customExemplo}
                onChange={e => setCustomExemplo(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCustomExemplo())}
                placeholder="Adicionar exemplo personalizado..."
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button type="button" onClick={addCustomExemplo}
                className="bg-gray-100 text-gray-600 px-3 rounded-lg hover:bg-gray-200 transition">
                <Plus size={16} />
              </button>
            </div>
            {exemplos.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {exemplos.map(ex => (
                  <span key={ex} onClick={() => toggleExemplo(ex)}
                    className="bg-blue-50 text-blue-600 text-xs px-2 py-1 rounded-full cursor-pointer hover:bg-red-50 hover:text-red-400 transition">
                    {ex} ×
                  </span>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600">Resultado da visita</label>
            <input value={form.outcome} onChange={e => setForm(f => ({ ...f, outcome: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Ex: Interesse confirmado, pediu proposta..." />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600">Próximo passo</label>
            <input value={form.next_step} onChange={e => setForm(f => ({ ...f, next_step: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Ex: Retornar em 1 semana com proposta" />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600">Observações</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Anotações adicionais..." />
          </div>

          {error && <p className="text-red-500 text-xs">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-lg text-sm hover:bg-gray-50 transition">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg text-sm hover:bg-blue-700 transition disabled:opacity-50">
              {saving ? 'Salvando...' : 'Salvar visita'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

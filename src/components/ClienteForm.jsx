import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { X } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

const STAGES = ['lead', 'negociacao', 'proposta', 'fechado']
const STAGE_LABELS = { lead: 'Lead', negociacao: 'Em negociação', proposta: 'Proposta enviada', fechado: 'Fechado' }
const CONTACT_ROLES = ['Dono', 'Líder', 'Gerente', 'Outro']

export default function ClienteForm({ onClose, onSaved, initialData }) {
  const { user } = useAuth()
  const [form, setForm] = useState({
    company_name: initialData?.company_name || '',
    contact_name: initialData?.contact_name || '',
    contact_role: initialData?.contact_role || 'Dono',
    phone: initialData?.phone || '',
    email: initialData?.email || '',
    address: initialData?.address || '',
    pipeline_stage: initialData?.pipeline_stage || 'lead',
    notes: initialData?.notes || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')

    const payload = { ...form, created_by: user.id }

    let res
    if (initialData?.id) {
      res = await supabase.from('clients').update(payload).eq('id', initialData.id)
    } else {
      res = await supabase.from('clients').insert(payload)
    }

    if (res.error) {
      setError('Erro ao salvar. Tente novamente.')
    } else {
      onSaved()
    }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center">
      <div className="bg-white w-full max-w-lg rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-800">{initialData ? 'Editar cliente' : 'Novo cliente'}</h2>
          <button onClick={onClose}><X size={20} className="text-gray-400" /></button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto p-4 space-y-3 flex-1">
          <div>
            <label className="text-xs font-medium text-gray-600">Empresa *</label>
            <input value={form.company_name} onChange={e => set('company_name', e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required placeholder="Nome da empresa" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Nome do contato</label>
            <input value={form.contact_name} onChange={e => set('contact_name', e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Nome completo" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Cargo do contato</label>
            <select value={form.contact_role} onChange={e => set('contact_role', e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-blue-500">
              {CONTACT_ROLES.map(r => <option key={r}>{r}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600">Telefone</label>
              <input value={form.phone} onChange={e => set('phone', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="(00) 00000-0000" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">E-mail</label>
              <input value={form.email} onChange={e => set('email', e.target.value)} type="email"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="email@empresa.com" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Endereço</label>
            <input value={form.address} onChange={e => set('address', e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Cidade, Estado" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Estágio no pipeline</label>
            <select value={form.pipeline_stage} onChange={e => set('pipeline_stage', e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-blue-500">
              {STAGES.map(s => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Observações</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Anotações gerais sobre o cliente..." />
          </div>

          {error && <p className="text-red-500 text-xs">{error}</p>}

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-lg text-sm hover:bg-gray-50 transition">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg text-sm hover:bg-blue-700 transition disabled:opacity-50">
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

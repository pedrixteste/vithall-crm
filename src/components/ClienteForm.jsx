import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { X } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

const STAGES = ['lead', 'negociacao', 'proposta', 'fechado']
const STAGE_LABELS = { lead: 'Lead', negociacao: 'Em negociação', proposta: 'Proposta enviada', fechado: 'Fechado' }
const CONTACT_ROLES = ['Dono', 'Líder', 'Gerente', 'Outro']

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

  function set(field, value) { setForm(f => ({ ...f, [field]: value })) }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const payload = { ...form, created_by: user.id }
    const res = initialData?.id
      ? await supabase.from('clients').update(payload).eq('id', initialData.id)
      : await supabase.from('clients').insert(payload)
    if (res.error) setError('Erro ao salvar. Tente novamente.')
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
        maxHeight: '90vh',
      }}>
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full" style={{ background: '#2A2A2A' }} />
        </div>

        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: '#2A2A2A' }}>
          <h2 className="font-bold text-base" style={{ color: '#F0EAD6' }}>
            {initialData ? 'Editar cliente' : 'Novo cliente'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color: '#7A7570', background: '#2A2A2A' }}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto p-5 space-y-4 flex-1">
          <div>
            <label style={labelStyle}>Empresa *</label>
            <input value={form.company_name} onChange={e => set('company_name', e.target.value)}
              style={inputStyle} placeholder="Nome da empresa" required
              onFocus={e => e.target.style.borderColor = '#C9A84C'}
              onBlur={e => e.target.style.borderColor = '#2A2A2A'} />
          </div>

          <div>
            <label style={labelStyle}>Nome do contato</label>
            <input value={form.contact_name} onChange={e => set('contact_name', e.target.value)}
              style={inputStyle} placeholder="Nome completo"
              onFocus={e => e.target.style.borderColor = '#C9A84C'}
              onBlur={e => e.target.style.borderColor = '#2A2A2A'} />
          </div>

          <div>
            <label style={labelStyle}>Cargo do contato</label>
            <select value={form.contact_role} onChange={e => set('contact_role', e.target.value)}
              style={{ ...inputStyle, cursor: 'pointer' }}>
              {CONTACT_ROLES.map(r => <option key={r} style={{ background: '#1E1E1E' }}>{r}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={labelStyle}>Telefone</label>
              <input value={form.phone} onChange={e => set('phone', e.target.value)}
                style={inputStyle} placeholder="(00) 00000-0000"
                onFocus={e => e.target.style.borderColor = '#C9A84C'}
                onBlur={e => e.target.style.borderColor = '#2A2A2A'} />
            </div>
            <div>
              <label style={labelStyle}>E-mail</label>
              <input value={form.email} onChange={e => set('email', e.target.value)} type="email"
                style={inputStyle} placeholder="email@empresa.com"
                onFocus={e => e.target.style.borderColor = '#C9A84C'}
                onBlur={e => e.target.style.borderColor = '#2A2A2A'} />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Cidade / Estado</label>
            <input value={form.address} onChange={e => set('address', e.target.value)}
              style={inputStyle} placeholder="Ex: São Paulo, SP"
              onFocus={e => e.target.style.borderColor = '#C9A84C'}
              onBlur={e => e.target.style.borderColor = '#2A2A2A'} />
          </div>

          <div>
            <label style={labelStyle}>Estágio no pipeline</label>
            <select value={form.pipeline_stage} onChange={e => set('pipeline_stage', e.target.value)}
              style={{ ...inputStyle, cursor: 'pointer' }}>
              {STAGES.map(s => <option key={s} value={s} style={{ background: '#1E1E1E' }}>{STAGE_LABELS[s]}</option>)}
            </select>
          </div>

          <div>
            <label style={labelStyle}>Observações</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3}
              style={{ ...inputStyle, resize: 'none' }}
              placeholder="Anotações sobre o cliente..."
              onFocus={e => e.target.style.borderColor = '#C9A84C'}
              onBlur={e => e.target.style.borderColor = '#2A2A2A'} />
          </div>

          {error && (
            <p className="text-xs text-center py-2 px-3 rounded-lg"
              style={{ color: '#E88080', background: 'rgba(232,128,128,0.08)', border: '1px solid rgba(232,128,128,0.15)' }}>
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-1 pb-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-3 rounded-xl text-sm font-medium"
              style={{ background: '#2A2A2A', color: '#7A7570' }}>
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-3 rounded-xl text-sm font-semibold transition-all"
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

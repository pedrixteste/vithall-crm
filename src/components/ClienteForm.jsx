import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Sheet } from './ui/Sheet'
import { Input, Select } from './ui/Input'
import { Button } from './ui/Button'

const ORIGINS = ['ligação fria', 'lead', 'feiras', 'indicação']
const STAGES = ['lead', 'negociacao', 'proposta', 'fechado']
const STAGE_LABELS = { lead: 'Lead', negociacao: 'Em negociação', proposta: 'Proposta enviada', fechado: 'Fechado' }

export default function ClienteForm({ onClose, onSaved, initialData }) {
  const { user } = useAuth()
  const [form, setForm] = useState({
    contact_name: initialData?.contact_name || '',
    company_name: initialData?.company_name || '',
    contact_role: initialData?.contact_role || '',
    city: initialData?.city || '',
    instagram: initialData?.instagram || '',
    phone: initialData?.phone || '',
    origin: initialData?.origin || '',
    pipeline_stage: initialData?.pipeline_stage || 'lead',
    notes: initialData?.notes || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (field, value) => setForm(f => ({ ...f, [field]: value }))

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.contact_name.trim()) { setError('Nome é obrigatório.'); return }
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
          placeholder="Ex: São Paulo, SP"
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
            <option key={o} value={o} style={{ background: '#1A1A1A' }}>
              {o.charAt(0).toUpperCase() + o.slice(1)}
            </option>
          ))}
        </Select>

        <Select
          label="Estagio no pipeline"
          value={form.pipeline_stage}
          onChange={e => set('pipeline_stage', e.target.value)}
        >
          {STAGES.map(s => (
            <option key={s} value={s} style={{ background: '#1A1A1A' }}>{STAGE_LABELS[s]}</option>
          ))}
        </Select>

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

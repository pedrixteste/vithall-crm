import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Sheet } from './ui/Sheet'
import { Input, Textarea, Select } from './ui/Input'
import { Button } from './ui/Button'

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

  const set = (field, value) => setForm(f => ({ ...f, [field]: value }))

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
    <Sheet open onClose={onClose} title={initialData ? 'Editar cliente' : 'Novo cliente'}>
      <form onSubmit={handleSubmit} className="space-y-4 pt-1">
        <Input label="Empresa *" value={form.company_name} onChange={e => set('company_name', e.target.value)}
          placeholder="Nome da empresa" required />

        <Input label="Nome do contato" value={form.contact_name} onChange={e => set('contact_name', e.target.value)}
          placeholder="Nome completo" />

        <Select label="Cargo do contato" value={form.contact_role} onChange={e => set('contact_role', e.target.value)}>
          {CONTACT_ROLES.map(r => <option key={r} style={{ background: '#1A1A1A' }}>{r}</option>)}
        </Select>

        <div className="grid grid-cols-2 gap-3">
          <Input label="Telefone" value={form.phone} onChange={e => set('phone', e.target.value)}
            placeholder="(00) 00000-0000" />
          <Input label="E-mail" type="email" value={form.email} onChange={e => set('email', e.target.value)}
            placeholder="email@empresa.com" />
        </div>

        <Input label="Cidade / Estado" value={form.address} onChange={e => set('address', e.target.value)}
          placeholder="Ex: São Paulo, SP" />

        <Select label="Estágio no pipeline" value={form.pipeline_stage} onChange={e => set('pipeline_stage', e.target.value)}>
          {STAGES.map(s => <option key={s} value={s} style={{ background: '#1A1A1A' }}>{STAGE_LABELS[s]}</option>)}
        </Select>

        <Textarea label="Observações" value={form.notes} onChange={e => set('notes', e.target.value)}
          rows={3} placeholder="Anotações sobre o cliente..." />

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

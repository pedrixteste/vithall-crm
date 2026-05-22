import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Sheet } from './ui/Sheet'
import { Input, Textarea, Select } from './ui/Input'
import { Button } from './ui/Button'
import { Plus } from 'lucide-react'

const EXEMPLOS_SUGERIDOS = [
  'Case de sucesso', 'ROI demonstrado', 'Produto ao vivo', 'Depoimento de cliente',
  'Comparativo concorrentes', 'Planilha de resultados', 'Video institucional', 'Proposta personalizada'
]

const LOCATIONS = [
  { key: 'empresa',    label: 'Recebeu na empresa' },
  { key: 'casa',       label: 'Recebeu em casa' },
  { key: 'cafeteria',  label: 'Cafeteria ou restaurante' },
  { key: 'vithall',    label: 'Na Vithall' },
]

export default function VisitaForm({ clientId, onClose, onSaved }) {
  const { user } = useAuth()
  const [form, setForm] = useState({
    visit_date: new Date().toISOString().split('T')[0],
    visit_location: '',
    outcome: '',
    next_step: '',
    notes: '',
  })
  const [exemplos, setExemplos] = useState([])
  const [customExemplo, setCustomExemplo] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const toggleExemplo = (ex) =>
    setExemplos(prev => prev.includes(ex) ? prev.filter(e => e !== ex) : [...prev, ex])

  function addCustom() {
    const v = customExemplo.trim()
    if (v && !exemplos.includes(v)) { setExemplos(p => [...p, v]); setCustomExemplo('') }
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
    <Sheet open onClose={onClose} title="Registrar visita">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingTop: '4px' }}>

        <Input
          label="Data da visita *"
          type="date"
          value={form.visit_date}
          onChange={e => setForm(f => ({ ...f, visit_date: e.target.value }))}
          required
        />

        {/* Onde foi a visita */}
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest mb-3" style={{ color: '#6B6560' }}>
            Onde foi a visita
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {LOCATIONS.map(loc => (
              <button
                key={loc.key}
                type="button"
                onClick={() => setForm(f => ({ ...f, visit_location: loc.key }))}
                className="text-xs font-semibold rounded-xl py-2.5 px-3 transition-all text-left"
                style={{
                  background: form.visit_location === loc.key ? 'rgba(201,168,76,0.12)' : '#111',
                  border: `1px solid ${form.visit_location === loc.key ? 'rgba(201,168,76,0.35)' : '#252525'}`,
                  color: form.visit_location === loc.key ? '#C9A84C' : '#6B6560',
                }}>
                {form.visit_location === loc.key && '✓ '}{loc.label}
              </button>
            ))}
          </div>
        </div>

        {/* Exemplos apresentados */}
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest mb-3" style={{ color: '#6B6560' }}>
            Exemplos apresentados
          </p>
          <div className="flex flex-wrap gap-2 mb-3">
            {EXEMPLOS_SUGERIDOS.map(ex => (
              <button key={ex} type="button" onClick={() => toggleExemplo(ex)}
                className="text-xs px-3 py-1.5 rounded-full border transition-all"
                style={{
                  background: exemplos.includes(ex) ? 'rgba(201,168,76,0.12)' : 'transparent',
                  borderColor: exemplos.includes(ex) ? 'rgba(201,168,76,0.4)' : '#252525',
                  color: exemplos.includes(ex) ? '#C9A84C' : '#6B6560',
                }}>
                {exemplos.includes(ex) && '✓ '}{ex}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={customExemplo}
              onChange={e => setCustomExemplo(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCustom())}
              placeholder="Adicionar personalizado..."
              className="flex-1 px-3.5 py-2.5 rounded-xl text-sm outline-none"
              style={{ background: '#111111', border: '1px solid #252525', color: '#EFEFEF' }}
              onFocus={e => e.target.style.borderColor = '#C9A84C'}
              onBlur={e => e.target.style.borderColor = '#252525'}
            />
            <button type="button" onClick={addCustom}
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: '#1A1A1A', border: '1px solid #252525', color: '#C9A84C' }}>
              <Plus size={16} />
            </button>
          </div>
          {exemplos.length > 0 && (
            <div className="mt-3 p-3 rounded-xl flex flex-wrap gap-1.5"
              style={{ background: '#111111', border: '1px solid #1C1C1C' }}>
              {exemplos.map(ex => (
                <span key={ex} onClick={() => toggleExemplo(ex)}
                  className="text-xs px-2.5 py-1 rounded-full cursor-pointer"
                  style={{ background: 'rgba(201,168,76,0.12)', color: '#C9A84C', border: '1px solid rgba(201,168,76,0.25)' }}>
                  {ex} x
                </span>
              ))}
            </div>
          )}
        </div>

        <Input
          label="Resultado da visita"
          value={form.outcome}
          onChange={e => setForm(f => ({ ...f, outcome: e.target.value }))}
          placeholder="Ex: Interesse confirmado, pediu proposta..."
        />

        <Input
          label="Proximo passo"
          value={form.next_step}
          onChange={e => setForm(f => ({ ...f, next_step: e.target.value }))}
          placeholder="Ex: Retornar em 1 semana com proposta"
        />

        <Textarea
          label="Observacoes"
          value={form.notes}
          onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          rows={3}
          placeholder="Anotacoes adicionais..."
        />

        {error && <p className="text-xs" style={{ color: '#E85555' }}>{error}</p>}

        <div className="flex gap-3 pt-1">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button type="submit" className="flex-1" disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar visita'}
          </Button>
        </div>
      </form>
    </Sheet>
  )
}

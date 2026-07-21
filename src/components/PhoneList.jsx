import { Input } from './ui/Input'
import { Plus, X } from 'lucide-react'
import { MAX_PHONES } from '../lib/utils'

const TIPOS = [['pessoal', '👤 Pessoal'], ['empresa', '🏢 Empresa']]

/** Botões pessoal/empresa — cada número escolhe o seu, sem herdar do anterior. */
function TipoToggle({ value, onChange }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {TIPOS.map(([k, label]) => (
        <button key={k} type="button" onClick={() => onChange(k)}
          className="text-xs font-bold rounded-xl py-2.5 transition-all active:scale-95"
          style={{
            background: value === k ? 'rgba(201,168,76,0.12)' : '#161616',
            border: `1px solid ${value === k ? 'rgba(201,168,76,0.4)' : '#252525'}`,
            color: value === k ? '#C9A84C' : '#6B6560',
          }}>
          {value === k ? '✓ ' : ''}{label}
        </button>
      ))}
    </div>
  )
}

/**
 * Telefones adicionais de um cadastro. `value` é a lista [{ n, t }] que vai
 * para a coluna `phones`; o número principal fica fora daqui.
 *
 * O botão "+1 número" só aparece com o último preenchido — senão a pessoa
 * empilha campos vazios e o formulário fica cheio de nada.
 */
export default function PhoneList({ value = [], onChange, primaryFilled = true }) {
  const extras = Array.isArray(value) ? value : []
  const maxExtras = MAX_PHONES - 1
  const ultimoPreenchido = extras.length === 0 || !!extras[extras.length - 1]?.n?.trim()
  const podeAdicionar = primaryFilled && ultimoPreenchido && extras.length < maxExtras

  const set = (i, patch) => onChange(extras.map((p, idx) => idx === i ? { ...p, ...patch } : p))
  const remover = (i) => onChange(extras.filter((_, idx) => idx !== i))
  const adicionar = () => onChange([...extras, { n: '', t: 'pessoal' }])

  if (!primaryFilled) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {extras.map((p, i) => (
        <div key={i} className="rounded-2xl"
          style={{ background: '#111', border: '1px solid #1C1C1C', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#444040' }}>
              Telefone adicional {i + 1}
            </p>
            <button type="button" onClick={() => remover(i)} title="Remover"
              className="flex items-center justify-center rounded-lg transition-all active:scale-95"
              style={{ width: '26px', height: '26px', background: 'rgba(232,85,85,0.08)', border: '1px solid rgba(232,85,85,0.25)', color: '#E85555' }}>
              <X size={13} />
            </button>
          </div>
          <Input
            value={p.n || ''}
            onChange={e => set(i, { n: e.target.value })}
            placeholder="(00) 00000-0000"
          />
          <TipoToggle value={p.t || 'pessoal'} onChange={t => set(i, { t })} />
        </div>
      ))}

      {podeAdicionar && (
        <button type="button" onClick={adicionar}
          className="flex items-center justify-center gap-1.5 text-xs font-bold rounded-xl py-3 transition-all active:scale-95"
          style={{ background: '#161616', border: '1px dashed #303030', color: '#6B6560' }}>
          <Plus size={13} /> +1 número
        </button>
      )}
    </div>
  )
}

export { TipoToggle }

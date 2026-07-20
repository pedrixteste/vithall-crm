import { useState } from 'react'
import { Plus, X } from 'lucide-react'

// Seletor de VÁRIAS datas específicas. Recebe/atualiza um array de 'YYYY-MM-DD'.
// Usado no lembrete do cliente e no "cliente pediu p/ ligar depois".
export default function SpecificDates({ dates, setDates, color = '#C9A84C' }) {
  const [pending, setPending] = useState('')

  const add = () => {
    if (pending && !dates.includes(pending)) setDates([...dates, pending].sort())
    setPending('')
  }
  const remove = (d) => setDates(dates.filter(x => x !== d))
  const fmt = (s) => new Date(s + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })

  const rgb = color === '#C9A84C' ? '201,168,76' : '232,131,74'

  return (
    <div>
      <div className="flex gap-2">
        <input type="date" value={pending} onChange={e => setPending(e.target.value)}
          className="flex-1 text-sm outline-none rounded-xl"
          style={{ padding: '12px 14px', background: '#111', border: '1px solid #252525', color: '#EFEFEF' }} />
        <button type="button" onClick={add} disabled={!pending}
          className="flex items-center gap-1 text-xs font-bold rounded-xl px-3 transition-all active:scale-95 disabled:opacity-40 flex-shrink-0"
          style={{ background: `rgba(${rgb},0.12)`, border: `1px solid rgba(${rgb},0.35)`, color }}>
          <Plus size={14} /> Adicionar
        </button>
      </div>

      {dates.length > 0 && (
        <div className="flex flex-wrap mt-2" style={{ gap: '6px' }}>
          {dates.map(d => (
            <button key={d} type="button" onClick={() => remove(d)}
              className="flex items-center gap-1 text-xs font-semibold rounded-full"
              style={{ padding: '5px 10px', background: `rgba(${rgb},0.12)`, color, border: `1px solid rgba(${rgb},0.25)` }}>
              {fmt(d)} <X size={11} />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { localDateStr } from '../lib/utils'
import { parseAniversario, formataAniversario, idadeEm, anosVithallEm, COR_DATA } from '../lib/aniversarios'

// Bloco "Datas" da ficha: aniversário de idade, aniversário Vithall e turma.
// Cada campo salva sozinho ao sair dele (como as observações). Fica acima das
// observações; o usuário sabe que a ficha está cheia e vai reorganizar depois.
//
//   • Aniversário: "dd/mm" ou "dd/mm/aaaa" (ano opcional → idade ao lado).
//   • Aniversário Vithall: data da PRIMEIRA matrícula/treinamento, preenchida
//     à mão por quem vendeu. Todo ano vira "X anos de Vithall".
//   • Turma: texto livre; a busca da aba Clientes acha por ele.
export default function DatasCliente({ client, onSaved }) {
  const [aniv, setAniv]     = useState(formataAniversario(client))
  const [vithall, setVithall] = useState(client.aniversario_vithall || '')
  const [turma, setTurma]   = useState(client.turma || '')
  const [status, setStatus] = useState({}) // campo → 'salvando' | 'ok' | 'erro' | 'invalido'

  const hoje = localDateStr()
  const idade = idadeEm(client, hoje)
  const anos  = anosVithallEm(client, hoje)

  async function salvar(campo, patch) {
    setStatus(s => ({ ...s, [campo]: 'salvando' }))
    const { error } = await supabase.from('clients').update(patch).eq('id', client.id)
    if (error) { setStatus(s => ({ ...s, [campo]: 'erro' })); return }
    onSaved?.(patch)
    setStatus(s => ({ ...s, [campo]: 'ok' }))
    setTimeout(() => setStatus(s => ({ ...s, [campo]: null })), 2000)
  }

  function salvarAniversario() {
    const p = parseAniversario(aniv)
    if (!p.ok) { setStatus(s => ({ ...s, aniv: 'invalido' })); return }
    const patch = { aniversario_dia: p.dia, aniversario_mes: p.mes, nascimento_ano: p.ano }
    if (patch.aniversario_dia === (client.aniversario_dia ?? null) && patch.aniversario_mes === (client.aniversario_mes ?? null)
      && patch.nascimento_ano === (client.nascimento_ano ?? null)) { setStatus(s => ({ ...s, aniv: null })); return }
    salvar('aniv', patch)
  }

  function salvarVithall() {
    const v = vithall || null
    if (v === (client.aniversario_vithall || null)) return
    salvar('vithall', { aniversario_vithall: v })
  }

  function salvarTurma() {
    const v = turma.trim() || null
    if (v === (client.turma || null)) return
    salvar('turma', { turma: v })
  }

  const msg = (k) => {
    const s = status[k]
    if (s === 'salvando') return <span style={{ color: '#958E86' }}>Salvando...</span>
    if (s === 'ok')       return <span style={{ color: '#4ADE80' }}>✓ Salvo</span>
    if (s === 'erro')     return <span style={{ color: '#E85555' }}>Não salvou — tente de novo</span>
    if (s === 'invalido') return <span style={{ color: '#E85555' }}>Use dd/mm ou dd/mm/aaaa</span>
    return null
  }

  const inputStyle = {
    padding: '10px 12px', background: '#111', border: '1px solid #252525', color: '#EFEFEF',
    borderRadius: '12px', fontSize: '14px', width: '100%', outline: 'none', colorScheme: 'dark',
  }
  const foco = (e) => { e.target.style.borderColor = '#C9A84C' }

  return (
    <div style={{ padding: '16px 20px', borderTop: '1px solid #1C1C1C', display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: '#9D968E' }}>Datas</p>

      {/* Aniversário de idade */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: COR_DATA.aniversario }}>
            🎂 Aniversário
            {idade !== null && <span style={{ color: '#EFEFEF', textTransform: 'none', letterSpacing: 0, marginLeft: '8px' }}>{idade} anos</span>}
          </label>
          <span className="text-[11px]">{msg('aniv')}</span>
        </div>
        <input value={aniv} placeholder="dd/mm ou dd/mm/aaaa" inputMode="numeric" style={inputStyle}
          onChange={e => { setAniv(e.target.value); if (status.aniv === 'invalido') setStatus(s => ({ ...s, aniv: null })) }}
          onFocus={foco} onBlur={e => { e.target.style.borderColor = '#252525'; salvarAniversario() }} />
      </div>

      {/* Aniversário Vithall */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: COR_DATA.vithall }}>
            🎓 Aniversário Vithall
            {anos !== null && anos > 0 && <span style={{ color: '#EFEFEF', textTransform: 'none', letterSpacing: 0, marginLeft: '8px' }}>{anos} {anos === 1 ? 'ano' : 'anos'}</span>}
          </label>
          <span className="text-[11px]">{msg('vithall')}</span>
        </div>
        <input type="date" value={vithall} style={inputStyle}
          onChange={e => setVithall(e.target.value)}
          onFocus={foco} onBlur={e => { e.target.style.borderColor = '#252525'; salvarVithall() }} />
        <p className="text-[11px] mt-1" style={{ color: '#6B6560' }}>Data da primeira matrícula. Quem vendeu preenche.</p>
      </div>

      {/* Turma */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: '#9D968E' }}>Turma</label>
          <span className="text-[11px]">{msg('turma')}</span>
        </div>
        <input value={turma} placeholder="Número ou nome da turma" style={inputStyle}
          onChange={e => setTurma(e.target.value)}
          onFocus={foco} onBlur={e => { e.target.style.borderColor = '#252525'; salvarTurma() }} />
      </div>
    </div>
  )
}

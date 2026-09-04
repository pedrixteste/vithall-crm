import { useState } from 'react'
import { CalendarClock } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { Sheet } from './ui/Sheet'
import { Button } from './ui/Button'
import { remarcarVisita, podeRemarcar } from '../lib/visitBooking'
import {
  MAX_ENDERECOS, enderecosAtivos, enderecoAtual, enderecoTexto,
  adicionarEndereco, mesmoEndereco,
} from '../lib/enderecos'

// "Remarcar": a visita caiu (cliente cancelou, não apareceu, ou a data passou
// sem ninguém registrar nada) e vai ser marcada de novo. Pede motivo, quem vai
// visitar, quando — e se o endereço mudou.
//
// O que NÃO muda: "Marcado por" na ficha (é quem cadastrou) e a comissão de
// quem marcou na origem. Quem remarca ENTRA na comissão, não toma o lugar.

export const REMARCAR_COR = '#22D3EE'

// Primeira letra de cada palavra em maiúscula — aplicado só ao SAIR do campo.
// Aplicar a cada tecla quebra o acento morto do teclado (~ ^ ´): o app
// reescrevia o texto no meio da composição e a letra seguinte vinha maiúscula
// ("São" virava "SAo"). No blur o navegador já terminou de compor.
const titleCase = (s) => (s || '').replace(/\b\w/g, c => c.toUpperCase())

// ── Bloco da ficha, logo abaixo do estágio ──────────────────────────
// Menor que o da repescagem: uma linha de botão. Cinza e sem clique enquanto
// a visita está de pé, com o motivo escrito embaixo.
export function RemarcarBlock({ client, nomeRemarcador, onRemarcar }) {
  const { pode, motivo } = podeRemarcar(client)
  const vezes = client.visit_reschedule_count || 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingLeft: '22px' }}>
      <button onClick={pode ? onRemarcar : undefined} disabled={!pode}
        className="flex items-center gap-2 rounded-xl transition-all"
        style={{
          alignSelf: 'flex-start',
          padding: '7px 14px',
          background: pode ? `${REMARCAR_COR}14` : '#141414',
          border: `1px solid ${pode ? `${REMARCAR_COR}4d` : '#242424'}`,
          color: pode ? REMARCAR_COR : '#6B6560',
          cursor: pode ? 'pointer' : 'not-allowed',
          opacity: pode ? 1 : 0.75,
        }}>
        <CalendarClock size={13} />
        <span className="text-[13px] font-bold">Remarcar visita</span>
      </button>

      {!pode && motivo && (
        <p className="text-[12px]" style={{ color: '#7C766F', lineHeight: 1.45 }}>{motivo}</p>
      )}

      {vezes > 0 && (
        <p className="text-[12px]" style={{ color: '#A59F97', lineHeight: 1.45 }}>
          🔁 Remarcada {vezes === 1 ? '1 vez' : `${vezes} vezes`}
          {nomeRemarcador ? ` · última por ${nomeRemarcador}` : ''}
          {client.remarcacao_motivo ? ` — "${client.remarcacao_motivo}"` : ''}
        </p>
      )}
    </div>
  )
}

export default function RemarcarForm({ client, vendedores = [], onClose, onSaved }) {
  const { user, profile } = useAuth()

  const [motivo, setMotivo]     = useState('')
  const [vendedor, setVendedor] = useState(client.assigned_to || '')
  const [data, setData]         = useState('')
  const [mudouEnd, setMudouEnd] = useState(null)   // null | true | false
  const [end, setEnd]           = useState({
    rua: '', numero: '', bairro: '',
    cidade: client.city || '', referencia: '',
  })
  const [substituir, setSubstituir] = useState('') // id do endereço que sai (no limite)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')

  const ativos    = enderecosAtivos(client)
  const atual     = enderecoAtual(client)
  const noLimite  = ativos.length >= MAX_ENDERECOS
  const setE      = (k, v) => setEnd(p => ({ ...p, [k]: v }))

  async function handleSubmit(e) {
    e.preventDefault()
    if (saving) return
    if (!motivo.trim()) { setError('Escreva o motivo da remarcação.'); return }
    if (!vendedor)      { setError('Escolha o vendedor que vai fazer a visita.'); return }
    if (!data)          { setError('Informe a data e a hora da visita.'); return }
    if (mudouEnd === null) { setError('Responda se o endereço mudou.'); return }

    let enderecoPayload = null
    if (mudouEnd === true) {
      if (!end.rua.trim())        { setError('Rua é obrigatória.'); return }
      if (!end.numero.trim())     { setError('Número é obrigatório.'); return }
      if (!end.bairro.trim())     { setError('Bairro é obrigatório.'); return }
      if (!end.cidade.trim())     { setError('Cidade é obrigatória.'); return }
      if (!end.referencia.trim()) { setError('Ponto de referência é obrigatório.'); return }
      // Digitou de novo o endereço que já é o atual — não é mudança nenhuma
      if (mesmoEndereco(atual, end)) {
        setError('Esse é o mesmo endereço que já está na ficha. Responda "Não" se ele não mudou.')
        return
      }
      const repetido = ativos.find(a => mesmoEndereco(a, end))
      if (noLimite && !substituir && !repetido) {
        setError(`Este cliente já tem ${MAX_ENDERECOS} endereços. Escolha abaixo qual sai para entrar o novo.`)
        return
      }
      const res = adicionarEndereco(client, end, user.id, repetido ? null : (substituir || null))
      if (res.erro) { setError(res.erro); return }
      const { repetido: _r, ...payload } = res
      enderecoPayload = payload
    }

    const novaDataIso = new Date(data).toISOString()
    if (isNaN(new Date(novaDataIso))) { setError('Data inválida.'); return }

    setSaving(true); setError('')
    const res = await remarcarVisita({
      client, userId: user.id, userName: profile?.name,
      motivo, vendedorId: vendedor, novaDataIso, enderecoPayload,
    })
    setSaving(false)
    if (res.error) { setError('Não salvou — verifique a internet e tente de novo.'); return }
    onSaved(res)
  }

  const inputStyle = {
    width: '100%', background: '#111', border: '1px solid #252525', borderRadius: '12px',
    padding: '12px 14px', color: '#EFEFEF', fontSize: '14px', outline: 'none', boxSizing: 'border-box',
  }
  const labelStyle = { fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#9D968E', marginBottom: '8px', display: 'block' }

  return (
    <Sheet open onClose={saving ? () => {} : onClose} title="Remarcar visita">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingTop: '4px' }}>

        <div className="rounded-xl" style={{ background: `${REMARCAR_COR}0f`, border: `1px solid ${REMARCAR_COR}33`, padding: '12px 14px' }}>
          <p className="text-sm font-semibold" style={{ color: '#EFEFEF' }}>
            {client.contact_name || client.company_name}
          </p>
          <p className="text-[12px] mt-1" style={{ color: '#A59F97', lineHeight: 1.5 }}>
            A visita vai para a data nova e o estágio vira "Remarcado".
            Quem marcou na origem continua com a comissão — você entra junto.
          </p>
        </div>

        {/* Motivo */}
        <div>
          <label style={labelStyle}>Motivo da remarcação *</label>
          <textarea value={motivo} onChange={e => { setMotivo(e.target.value); if (error) setError('') }}
            rows={3} autoFocus
            placeholder="Ex: cliente teve um imprevisto no dia e pediu para ir na semana que vem"
            className="w-full text-sm outline-none resize-none rounded-xl"
            style={{ ...inputStyle, lineHeight: 1.5 }} />
        </div>

        {/* Vendedor */}
        <div>
          <label style={labelStyle}>Quem vai fazer a visita *</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {vendedores.map(p => {
              const active = vendedor === p.id
              const nome = (p.name || '').split(' ')[0] || p.name || '—'
              return (
                <button key={p.id} type="button" onClick={() => { setVendedor(p.id); setError('') }}
                  style={{
                    padding: '7px 13px', borderRadius: '99px', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                    background: active ? `${REMARCAR_COR}26` : 'transparent',
                    color: active ? REMARCAR_COR : '#958E86',
                    border: `1px solid ${active ? `${REMARCAR_COR}73` : '#2A2A2A'}`,
                  }}>
                  {active ? '✓ ' : ''}{nome}{p.id === user.id ? ' (você)' : ''}
                </button>
              )
            })}
            {vendedores.length === 0 && (
              <p className="text-[12px]" style={{ color: '#E8834A' }}>Nenhum vendedor cadastrado na equipe.</p>
            )}
          </div>
        </div>

        {/* Data */}
        <div>
          <label style={labelStyle}>Quando vai ser a visita *</label>
          <input type="datetime-local" value={data}
            onChange={e => { setData(e.target.value); if (error) setError('') }}
            style={inputStyle} />
        </div>

        {/* Endereço */}
        <div style={{ borderTop: '1px solid #1C1C1C', paddingTop: '16px' }}>
          <label style={labelStyle}>Mudou o endereço? *</label>
          {atual && (
            <p className="text-[12px]" style={{ color: '#8B857D', lineHeight: 1.45, marginBottom: '10px' }}>
              Hoje na ficha: {enderecoTexto(atual)}
            </p>
          )}
          <div style={{ display: 'flex', gap: '8px' }}>
            {[{ v: true, label: 'Sim' }, { v: false, label: 'Não' }].map(o => {
              const active = mudouEnd === o.v
              return (
                <button key={String(o.v)} type="button"
                  onClick={() => { setMudouEnd(o.v); setError('') }}
                  style={{
                    flex: 1, padding: '11px', borderRadius: '12px', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                    background: active ? `${REMARCAR_COR}26` : '#111',
                    color: active ? REMARCAR_COR : '#958E86',
                    border: `1px solid ${active ? `${REMARCAR_COR}73` : '#252525'}`,
                  }}>
                  {o.label}
                </button>
              )
            })}
          </div>

          {mudouEnd === true && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '14px' }}>
              {/* No limite de 3: escolher qual sai antes de entrar o novo */}
              {noLimite && (
                <div className="rounded-xl" style={{ padding: '12px 14px', background: 'rgba(232,131,74,0.08)', border: '1px solid rgba(232,131,74,0.3)' }}>
                  <p className="text-[12px] font-semibold" style={{ color: '#E8834A', lineHeight: 1.5 }}>
                    ⚠️ Este cliente já tem {MAX_ENDERECOS} endereços — o limite.
                  </p>
                  <p className="text-[12px] mt-1" style={{ color: '#B0A99F', lineHeight: 1.5 }}>
                    Escolha qual sai para entrar o novo. Ele some da ficha mas continua
                    guardado no backup, dá para recuperar depois.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '10px' }}>
                    {ativos.map(a => {
                      const sel = substituir === a.id
                      return (
                        <button key={a.id} type="button" onClick={() => { setSubstituir(sel ? '' : a.id); setError('') }}
                          style={{
                            textAlign: 'left', padding: '9px 12px', borderRadius: '10px', fontSize: '12px', cursor: 'pointer',
                            background: sel ? 'rgba(232,85,85,0.12)' : '#111',
                            border: `1px solid ${sel ? 'rgba(232,85,85,0.45)' : '#252525'}`,
                            color: sel ? '#E85555' : '#B0A99F', lineHeight: 1.45,
                          }}>
                          {sel ? '🗑 sai: ' : ''}{enderecoTexto(a)}{a.atual ? ' · atual' : ''}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '3fr 1.2fr', gap: '10px' }}>
                <div>
                  <label style={labelStyle}>Rua *</label>
                  <input value={end.rua} onChange={e => setE('rua', e.target.value)}
                    onBlur={e => setE('rua', titleCase(e.target.value))}
                    placeholder="Ex: Av. Paulista" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Número *</label>
                  <input value={end.numero} onChange={e => setE('numero', e.target.value)}
                    placeholder="123" style={inputStyle} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Bairro *</label>
                <input value={end.bairro} onChange={e => setE('bairro', e.target.value)}
                  onBlur={e => setE('bairro', titleCase(e.target.value))}
                  placeholder="Ex: Centro" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Cidade *</label>
                <input value={end.cidade} onChange={e => setE('cidade', e.target.value)}
                  onBlur={e => setE('cidade', titleCase(e.target.value))}
                  placeholder="Ex: Sao Paulo, SP" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Ponto de referência *</label>
                <input value={end.referencia} onChange={e => setE('referencia', e.target.value)}
                  placeholder="Ex: em frente a praca, ao lado do mercado X" style={inputStyle} />
              </div>
              <p className="text-[12px]" style={{ color: '#8B857D', lineHeight: 1.45 }}>
                O endereço novo passa a ser o do cliente; o anterior fica guardado na ficha.
              </p>
            </div>
          )}
        </div>

        {error && (
          <p className="text-xs px-3 py-2 rounded-xl"
            style={{ color: '#E85555', background: 'rgba(232,85,85,0.08)', border: '1px solid rgba(232,85,85,0.15)' }}>
            {error}
          </p>
        )}

        <div className="flex gap-3 pt-1">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button type="submit" className="flex-1" disabled={saving}>
            {saving ? 'Salvando...' : 'Remarcar visita'}
          </Button>
        </div>
      </form>
    </Sheet>
  )
}

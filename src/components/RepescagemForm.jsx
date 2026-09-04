import { useState } from 'react'
import { Repeat } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Sheet } from './ui/Sheet'
import { Button } from './ui/Button'
import SpecificDates from './SpecificDates'
import { reminderDates, proximaOcorrencia, repescagemResumo, REPESCAGEM_COLOR, REPESCAGEM_TYPES } from '../lib/utils'

// "Repescagem": lembrar de religar para este cliente no futuro. Quem marca
// escreve o motivo e escolhe quando quer ser lembrado — e passa a ser o DONO
// da repescagem: enquanto ela existir, mais ninguém pode marcar repescagem
// neste cliente, e só o dono desmarca.

const WEEK_DAYS = [
  { key: 'seg', label: 'Seg' }, { key: 'ter', label: 'Ter' }, { key: 'qua', label: 'Qua' },
  { key: 'qui', label: 'Qui' }, { key: 'sex', label: 'Sex' }, { key: 'sab', label: 'Sáb' }, { key: 'dom', label: 'Dom' },
]
const COR = REPESCAGEM_COLOR

// ── Bloco da ficha do cliente ───────────────────────────────────────
// Três estados: livre (botão), minha (motivo + lembretes + desmarcar) e de
// outra pessoa (apagado, sem clique). Só apresentação — quem grava é a ficha.
export function RepescagemBlock({ client, meuId, nomeDono, onMarcar, onEditar, onDesmarcar }) {
  const dono     = client.repescagem_by
  const info     = proximaOcorrencia(client.repescagem_config)
  const dataProx = info ? new Date(info.date).toLocaleDateString('pt-BR') : null

  return (
    <div style={{ padding: '16px 20px', borderTop: '1px solid #1C1C1C' }}>
      <p className="text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: '#9D968E' }}>Repescagem</p>

      {/* Ninguém marcou ainda */}
      {!dono && (
        <>
          <button onClick={onMarcar}
            className="w-full flex items-center justify-center gap-2 rounded-xl transition-all active:scale-[0.98]"
            style={{ padding: '12px', background: `${COR}14`, border: `1px solid ${COR}4d`, color: COR, cursor: 'pointer' }}>
            <Repeat size={14} />
            <span className="text-sm font-bold">Repescagem</span>
          </button>
          <p className="text-[12px] mt-2" style={{ color: '#8B857D', lineHeight: 1.5 }}>
            Marque para ser lembrado de ligar de novo para esse cliente mais pra frente.
          </p>
        </>
      )}

      {/* Repescagem de OUTRA pessoa: apagado, sem clique */}
      {dono && dono !== meuId && (
        <div className="rounded-xl" style={{ padding: '12px', background: '#141414', border: '1px dashed #2A2A2A', opacity: 0.7 }}>
          <p className="text-sm font-semibold flex items-start gap-2" style={{ color: '#8B857D', lineHeight: 1.45 }}>
            <Repeat size={14} style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>"{nomeDono || 'Outra pessoa'}" marcou repescagem{dataProx ? ` para o dia ${dataProx}` : ''}</span>
          </p>
          {client.repescagem_reason && (
            <p className="text-[12px] mt-1.5" style={{ color: '#7C766F', lineHeight: 1.5 }}>
              "{client.repescagem_reason}"
            </p>
          )}
          <p className="text-[11px] mt-1.5" style={{ color: '#6B6560', lineHeight: 1.45 }}>
            Indisponível — só uma pessoa por vez pode fazer repescagem deste cliente.
          </p>
        </div>
      )}

      {/* Repescagem minha: mostra, edita e desmarca */}
      {dono && dono === meuId && (
        <div className="rounded-xl" style={{ padding: '13px 14px', background: `${COR}0f`, border: `1px solid ${COR}40` }}>
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-bold flex items-center gap-2" style={{ color: COR }}>
              <Repeat size={14} /> Repescagem sua
            </p>
            <button onClick={onEditar}
              className="text-[12px] font-semibold rounded-lg transition-all active:scale-95 flex-shrink-0"
              style={{ padding: '5px 10px', background: '#1A1A1A', border: '1px solid #2A2A2A', color: '#B0A99F', cursor: 'pointer' }}>
              ✎ editar
            </button>
          </div>
          <p className="text-[13px] mt-2" style={{ color: '#EFEFEF', lineHeight: 1.5 }}>
            "{client.repescagem_reason}"
          </p>
          <p className="text-[12px] mt-1.5" style={{ color: '#A59F97', lineHeight: 1.45 }}>
            🔔 {repescagemResumo(client.repescagem_config)}
            {dataProx ? ` · próxima: ${dataProx}` : ' · todas as datas já passaram'}
          </p>
          <button onClick={onDesmarcar}
            className="w-full text-xs font-semibold rounded-xl transition-all active:scale-95"
            style={{ marginTop: '10px', padding: '10px', background: 'rgba(232,85,85,0.08)', border: '1px solid rgba(232,85,85,0.2)', color: '#E85555', cursor: 'pointer' }}>
            Desmarcar repescagem
          </button>
        </div>
      )}
    </div>
  )
}

export default function RepescagemForm({ client, onClose, onSaved }) {
  const { user, profile } = useAuth()
  const cfg = client.repescagem_config
  const editando = !!user?.id && client.repescagem_by === user.id

  const [motivo, setMotivo]   = useState(client.repescagem_reason || '')
  const [tipo, setTipo]       = useState(cfg?.type || '')
  const [dias, setDias]       = useState(cfg?.days || [])
  const [diaMes, setDiaMes]   = useState(cfg?.day ? String(cfg.day) : '')
  const [datas, setDatas]     = useState(cfg?.type === 'specific_date' ? reminderDates(cfg) : [])
  const [hora, setHora]       = useState(cfg?.time || '09:00')
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')

  const toggleDia = d => setDias(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!motivo.trim())  { setError('Escreva o motivo da repescagem.'); return }
    if (!tipo)           { setError('Escolha quando quer ser lembrado.'); return }
    if (tipo === 'weekly' && dias.length === 0)        { setError('Escolha ao menos um dia da semana.'); return }
    if (tipo === 'monthly' && !diaMes)                 { setError('Escolha o dia do mês.'); return }
    if (tipo === 'specific_date' && datas.length === 0){ setError('Adicione ao menos uma data.'); return }
    if (!hora)           { setError('Escolha a hora da notificação.'); return }

    const config = { type: tipo, time: hora }
    if (tipo === 'weekly')        config.days  = dias
    if (tipo === 'monthly')       config.day   = Number(diaMes)
    if (tipo === 'specific_date') config.dates = [...datas].sort()

    const payload = {
      repescagem_by:     user?.id,
      repescagem_reason: motivo.trim(),
      repescagem_config: config,
      repescagem_at:     client.repescagem_at || new Date().toISOString(),
    }

    setSaving(true); setError('')
    // A trava é do BANCO, não da tela: só grava se a repescagem ainda estiver
    // livre (ou já for minha). Duas pessoas apertando no mesmo instante — a
    // segunda não sobrescreve a primeira, recebe o aviso.
    let q = supabase.from('clients').update(payload).eq('id', client.id)
    q = editando ? q.eq('repescagem_by', user.id) : q.is('repescagem_by', null)
    // (editando só é true quando existe user.id)
    const { data, error: err } = await q.select('id')
    setSaving(false)
    if (err) { setError('Não salvou — verifique a internet e tente de novo.'); return }
    if (!data?.length) {
      setError('Outra pessoa marcou a repescagem deste cliente agora. Feche e abra a ficha para ver.')
      return
    }
    // Rastro no histórico. As colunas do cliente só sabem a repescagem ATUAL:
    // desmarcar apagaria o dado e não daria para medir conversão nenhuma
    // depois. Vale a partir de 04/09/26 — antes disso não existe.
    supabase.from('client_history').insert({
      client_id:  client.id,
      user_id:    user?.id,
      user_name:  profile?.name || null,
      event_type: 'repescagem',
      event_data: { acao: editando ? 'editada' : 'marcada', motivo: payload.repescagem_reason, config },
    })
    onSaved(payload)
  }

  const selStyle = { padding: '12px 10px', background: '#111', border: '1px solid #252525', color: '#EFEFEF', borderRadius: '12px', fontSize: '14px', outline: 'none', width: '100%' }
  const [hh = '', mm = ''] = hora ? hora.split(':') : []
  const setParte = (h, m) => setHora((h !== '' && m !== '') ? `${h}:${m}` : '')

  return (
    <Sheet open onClose={onClose} title={editando ? 'Editar repescagem' : 'Repescagem'}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingTop: '4px' }}>

        <div className="rounded-xl" style={{ background: `${COR}0f`, border: `1px solid ${COR}33`, padding: '12px 14px' }}>
          <p className="text-sm font-semibold" style={{ color: '#EFEFEF' }}>
            {client.contact_name || client.company_name}
          </p>
          <p className="text-[12px] mt-1" style={{ color: '#A59F97', lineHeight: 1.5 }}>
            Você vai ser lembrado de religar para esse contato. Enquanto a repescagem
            for sua, mais ninguém pode marcar repescagem nele.
          </p>
        </div>

        {/* Motivo — obrigatório */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-widest block mb-2" style={{ color: '#958E86' }}>
            Motivo para repescagem *
          </label>
          <textarea value={motivo} onChange={e => { setMotivo(e.target.value); if (error) setError('') }}
            rows={3} autoFocus
            placeholder="Ex: visita foi ótima, ele tem potencial mas o orçamento fecha em janeiro — ligar de novo"
            className="w-full text-sm outline-none resize-none rounded-xl transition-all"
            style={{ padding: '12px 14px', background: '#111', border: '1px solid #252525', color: '#EFEFEF', lineHeight: '1.5' }} />
        </div>

        {/* Quando lembrar */}
        <div style={{ borderTop: '1px solid #1C1C1C', paddingTop: '18px' }}>
          <p className="text-[12px] font-bold uppercase tracking-widest" style={{ color: '#958E86', marginBottom: '10px' }}>
            Quando quer ser lembrado? *
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '14px' }}>
            {REPESCAGEM_TYPES.map(rt => (
              <button key={rt.key} type="button"
                onClick={() => { setTipo(prev => prev === rt.key ? '' : rt.key); setError('') }}
                className="text-xs font-semibold rounded-xl transition-all active:scale-95"
                style={{
                  padding: '11px 6px',
                  background: tipo === rt.key ? `${COR}1f` : '#111',
                  border: `1px solid ${tipo === rt.key ? `${COR}66` : '#252525'}`,
                  color: tipo === rt.key ? COR : '#958E86',
                }}>
                {rt.label}
              </button>
            ))}
          </div>

          {tipo === 'weekly' && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: '#9D968E' }}>Dias da semana</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                {WEEK_DAYS.map(d => (
                  <button key={d.key} type="button" onClick={() => toggleDia(d.key)}
                    className="text-xs font-semibold rounded-xl transition-all active:scale-95"
                    style={{
                      padding: '9px 4px',
                      background: dias.includes(d.key) ? `${COR}1f` : '#111',
                      border: `1px solid ${dias.includes(d.key) ? `${COR}66` : '#252525'}`,
                      color: dias.includes(d.key) ? COR : '#958E86',
                    }}>
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {tipo === 'monthly' && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: '#9D968E' }}>Dia do mês</p>
              <select value={diaMes} onChange={e => setDiaMes(e.target.value)} style={selStyle}>
                <option value="">Escolha o dia</option>
                {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                  <option key={d} value={d} style={{ background: '#1A1A1A' }}>Dia {d}</option>
                ))}
              </select>
              <p className="text-[12px] mt-1.5" style={{ color: '#A59F97' }}>
                Todo mês nesse dia. Em mês mais curto (dia 31 em fevereiro), cai no último dia.
              </p>
            </div>
          )}

          {tipo === 'specific_date' && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: '#9D968E' }}>Datas do lembrete</p>
              <SpecificDates dates={datas} setDates={setDatas} color={COR} />
              <p className="text-[12px] mt-1.5" style={{ color: '#A59F97' }}>
                Pode adicionar quantas datas quiser. Cada uma aparece na aba "Hoje" um dia antes.
              </p>
            </div>
          )}

          {/* Hora da notificação — seletor próprio (Hora + Minuto), como no
              "ligar depois": o relógio nativo corta o botão em alguns celulares */}
          {tipo && (
            <div style={{ marginTop: '14px' }}>
              <p className="text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: '#9D968E' }}>
                Hora da notificação *
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '8px', alignItems: 'center' }}>
                <select value={hh} onChange={e => setParte(e.target.value, e.target.value ? (mm || '00') : '')} style={selStyle}>
                  <option value="">Hora</option>
                  {Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')).map(h => (
                    <option key={h} value={h} style={{ background: '#1A1A1A' }}>{h}h</option>
                  ))}
                </select>
                <span style={{ color: '#958E86', fontWeight: 700 }}>:</span>
                <select value={mm} onChange={e => setParte(e.target.value ? (hh || '00') : '', e.target.value)} style={selStyle}>
                  <option value="">Min</option>
                  {Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0')).map(m => (
                    <option key={m} value={m} style={{ background: '#1A1A1A' }}>{m}</option>
                  ))}
                </select>
              </div>
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
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button type="submit" className="flex-1" disabled={saving}>
            {saving ? 'Salvando...' : editando ? 'Salvar' : 'Marcar repescagem'}
          </Button>
        </div>
      </form>
    </Sheet>
  )
}

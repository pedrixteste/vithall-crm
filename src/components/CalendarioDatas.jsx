import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { localDateStr } from '../lib/utils'
import { eventosDoMes, rotuloEvento, COR_DATA, ICONE_DATA, NOME_MES } from '../lib/aniversarios'

// Pop-up de calendário mensal (botão no canto da aba Hoje).
//
//   • Dia com algo ganha cor e um número (quantas coisas tem nele). Mais de
//     um tipo no mesmo dia → bolinhas de cada cor.
//   • Abaixo, a legenda do mês inteiro em ordem numérica ("dia 2 — …").
//     Tocar num dia deixa só ele na legenda; tocar de novo volta ao mês.
//   • Tocar num nome abre a ficha (feriado não abre nada).
//
// Cores: aniversário rosa, Vithall dourado, feriado/data especial azul.
// A trava por dono (RLS) já limita os clientes que chegam aqui — cada um vê
// os aniversários de quem tem na aba Clientes; gerente vê todos.
const DIAS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

// `filtro` = filtroMeusClientes(papel, id): a regra da aba Clientes (null = gerente, vê tudo).
export default function CalendarioDatas({ onClose, onOpenClient, filtro = null }) {
  const hoje = localDateStr()
  const [ano, setAno]   = useState(Number(hoje.slice(0, 4)))
  const [mes, setMes]   = useState(Number(hoje.slice(5, 7)))
  const [diaSel, setDiaSel] = useState(null)
  const [clientes, setClientes] = useState(null) // null = carregando

  useEffect(() => {
    // Uma leitura só: todo cliente com alguma data. Trocar de mês é local.
    let q = supabase.from('clients').select('*')
      .or('aniversario_mes.not.is.null,aniversario_vithall.not.is.null')
    if (filtro) q = q.or(filtro)
    q.then(({ data }) => setClientes(data || []))
  }, [filtro])

  // Fecha no Esc e trava a rolagem da página atrás
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [onClose])

  const eventos = useMemo(() => eventosDoMes(clientes || [], ano, mes), [clientes, ano, mes])
  const porDia = useMemo(() => {
    const m = {}
    for (const e of eventos) (m[e.dia] ||= []).push(e)
    return m
  }, [eventos])

  const primeiroDow = new Date(ano, mes - 1, 1, 12).getDay()
  const diasNoMes   = new Date(ano, mes, 0, 12).getDate()
  const celulas = [...Array(primeiroDow).fill(null), ...Array.from({ length: diasNoMes }, (_, i) => i + 1)]
  while (celulas.length % 7) celulas.push(null)

  function mudaMes(n) {
    let m = mes + n, a = ano
    if (m < 1) { m = 12; a-- } else if (m > 12) { m = 1; a++ }
    setMes(m); setAno(a); setDiaSel(null)
  }
  const anoAtual = Number(hoje.slice(0, 4))
  const anos = Array.from({ length: 7 }, (_, i) => anoAtual - 3 + i)

  const legenda = diaSel ? eventos.filter(e => e.dia === diaSel) : eventos
  const ehHoje = (d) => localDateStr(new Date(ano, mes - 1, d, 12)) === hoje

  const selStyle = {
    background: '#111', border: '1px solid #252525', color: '#EFEFEF', borderRadius: '10px',
    padding: '6px 8px', fontSize: '13px', fontWeight: 600, outline: 'none', colorScheme: 'dark',
  }

  return createPortal(
    <div onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(0,0,0,0.72)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '24px 12px', overflowY: 'auto' }}>
      <div onClick={e => e.stopPropagation()} className="animate-in"
        style={{ width: '100%', maxWidth: '440px', background: '#161616', border: '1px solid #2A2A2A', borderRadius: '20px', padding: '16px', boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }}>

        {/* Cabeçalho: ‹ mês ano › */}
        <div className="flex items-center gap-2">
          <button onClick={() => mudaMes(-1)} aria-label="Mês anterior"
            className="flex items-center justify-center rounded-xl active:scale-95"
            style={{ width: '36px', height: '36px', background: '#111', border: '1px solid #252525', color: '#958E86' }}>
            <ChevronLeft size={16} />
          </button>
          <select value={mes} onChange={e => { setMes(Number(e.target.value)); setDiaSel(null) }} style={{ ...selStyle, flex: 1, textTransform: 'capitalize' }}>
            {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{NOME_MES(i + 1)}</option>)}
          </select>
          <select value={ano} onChange={e => { setAno(Number(e.target.value)); setDiaSel(null) }} style={selStyle}>
            {anos.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <button onClick={() => mudaMes(1)} aria-label="Próximo mês"
            className="flex items-center justify-center rounded-xl active:scale-95"
            style={{ width: '36px', height: '36px', background: '#111', border: '1px solid #252525', color: '#958E86' }}>
            <ChevronRight size={16} />
          </button>
          <button onClick={onClose} aria-label="Fechar"
            className="flex items-center justify-center rounded-xl active:scale-95"
            style={{ width: '36px', height: '36px', background: 'transparent', color: '#958E86' }}>
            <X size={18} />
          </button>
        </div>

        {/* Grade */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginTop: '14px' }}>
          {DIAS.map((d, i) => (
            <div key={i} className="text-center text-[10px] font-bold uppercase" style={{ color: '#6B6560', padding: '4px 0' }}>{d}</div>
          ))}
          {celulas.map((d, i) => {
            if (!d) return <div key={i} />
            const evs = porDia[d] || []
            const tipos = [...new Set(evs.map(e => e.tipo))]
            const cor = tipos.length ? COR_DATA[tipos.length === 1 ? tipos[0] : 'aniversario'] : null
            const sel = diaSel === d
            return (
              <button key={i} onClick={() => setDiaSel(sel ? null : d)}
                className="relative flex flex-col items-center justify-center rounded-xl transition-all active:scale-95"
                style={{
                  aspectRatio: '1', minHeight: '40px',
                  background: cor ? `${cor}22` : '#111',
                  border: `1px solid ${sel ? '#EFEFEF' : cor ? `${cor}80` : '#1E1E1E'}`,
                  boxShadow: ehHoje(d) ? '0 0 0 2px rgba(201,168,76,0.55)' : 'none',
                  color: cor ? '#EFEFEF' : '#847E77',
                  fontSize: '13px', fontWeight: cor ? 700 : 500,
                }}>
                {d}
                {evs.length > 0 && (
                  <span className="absolute text-[9px] font-bold rounded-full tabular-nums"
                    style={{ top: '2px', right: '3px', minWidth: '14px', padding: '0 3px', background: cor, color: '#111', lineHeight: '14px' }}>
                    {evs.length}
                  </span>
                )}
                {tipos.length > 1 && (
                  <span className="flex gap-0.5" style={{ position: 'absolute', bottom: '3px' }}>
                    {tipos.map(t => <span key={t} style={{ width: '5px', height: '5px', borderRadius: '50%', background: COR_DATA[t] }} />)}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Chave das cores */}
        <div className="flex flex-wrap" style={{ gap: '10px', marginTop: '12px' }}>
          {[['aniversario', 'Aniversário'], ['vithall', 'Aniversário Vithall'], ['especial', 'Feriado / data especial']].map(([t, l]) => (
            <span key={t} className="inline-flex items-center gap-1.5 text-[11px]" style={{ color: '#958E86' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: COR_DATA[t] }} />{l}
            </span>
          ))}
        </div>

        {/* Legenda do mês / do dia */}
        <div style={{ marginTop: '14px', borderTop: '1px solid #222', paddingTop: '12px' }}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: '#9D968E' }}>
              {diaSel ? `Dia ${diaSel}` : <span style={{ textTransform: 'capitalize' }}>{NOME_MES(mes)} {ano}</span>}
            </p>
            {diaSel && (
              <button onClick={() => setDiaSel(null)} className="text-[11px] font-semibold" style={{ color: '#C9A84C' }}>ver o mês</button>
            )}
          </div>
          {clientes === null ? (
            <p className="text-xs" style={{ color: '#958E86' }}>Carregando...</p>
          ) : legenda.length === 0 ? (
            <p className="text-xs" style={{ color: '#958E86' }}>{diaSel ? 'Nada neste dia.' : 'Nada neste mês.'}</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {legenda.map((e, i) => {
                const cor = COR_DATA[e.tipo]
                const abre = e.client && onOpenClient
                return (
                  <button key={i} disabled={!abre}
                    onClick={() => abre && onOpenClient(e.client)}
                    className="w-full text-left flex items-start gap-2 rounded-xl"
                    style={{ padding: '8px 10px', background: '#111', border: `1px solid ${cor}33`, cursor: abre ? 'pointer' : 'default' }}>
                    <span className="text-xs font-bold tabular-nums flex-shrink-0" style={{ color: cor, minWidth: '44px' }}>dia {e.dia}</span>
                    <span className="text-[13px]" style={{ color: '#EFEFEF', lineHeight: 1.35, textDecoration: abre ? 'underline' : 'none', textUnderlineOffset: '3px', textDecorationColor: `${cor}80` }}>
                      {ICONE_DATA[e.tipo]} {rotuloEvento(e)}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

import { useMemo, useState } from 'react'

// ── Opções ─────────────────────────────────────────────────────────
const TREINAMENTOS = ['Impacto', 'Perfil', 'Vendas', 'LORAP', 'Academia Vithall', 'Workshop', 'Palestra', 'Mentoria']
const ORIGENS = [
  { key: 'frias contatinhos', label: 'Frias contatinhos' },
  { key: 'frias listas',      label: 'Frias listas' },
  { key: 'lead campanha',     label: 'Lead campanha' },
  { key: 'lead organico',     label: 'Lead orgânico' },
  { key: 'feiras',            label: 'Feiras' },
  { key: 'indicacao',         label: 'Indicação' },
]
const STAGES = {
  nao_marcou:     'Não marcou ainda',
  pediu_ligar:    'Pediu para ligar',
  marcado:        'Marcado',
  nao_visitado:   'Marcação feita',
  nao_apareceu:   'Não apareceu',
  cancelado:      'Cancelou visita',
  recebeu_visita: 'Recebeu visita',
  matriculado:    'Matriculado',
}
const OUTCOMES = {
  matriculada:          'Matriculada',
  grandes_chances:      'Grandes chances',
  chance_futura:        'Chance futura',
  sem_chance:           'Sem chance',
  retorno_pessoalmente: 'Retorno pessoalmente',
  retorno_ligacao:      'Retorno por ligação',
  remarcar:             'Remarcar',
}

// ── Helpers ────────────────────────────────────────────────────────
function latestVisit(c) {
  const vs = c.visits || []
  if (!vs.length) return null
  return [...vs].sort((a, b) => (b.visit_date || '').localeCompare(a.visit_date || ''))[0]
}
function fmtDate(x) {
  if (!x) return ''
  const d = new Date(x)
  return isNaN(d) ? '' : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
function fmtDateTime(x) {
  if (!x) return ''
  const d = new Date(x)
  if (isNaN(d)) return ''
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}
function csvEscape(v) {
  const s = v == null ? '' : String(v)
  return /[",;\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
}
function downloadCSV(text, filename) {
  const blob = new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

// ── UI atoms ───────────────────────────────────────────────────────
function Section({ title, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#6B6560' }}>{title}</p>
      {children}
    </div>
  )
}
function Chips({ options, selected, onToggle }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
      {options.map(({ key, label }) => {
        const on = selected.includes(key)
        return (
          <button key={key} type="button" onClick={() => onToggle(key)}
            style={{
              padding: '6px 11px', borderRadius: '99px', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
              background: on ? 'rgba(201,168,76,0.14)' : '#111',
              border: `1px solid ${on ? 'rgba(201,168,76,0.4)' : '#252525'}`,
              color: on ? '#C9A84C' : '#6B6560',
            }}>
            {label}
          </button>
        )
      })}
    </div>
  )
}
function Toggle3({ value, onChange, labels = ['Todos', 'Sim', 'Não'] }) {
  const opts = [['all', labels[0]], ['sim', labels[1]], ['nao', labels[2]]]
  return (
    <div style={{ display: 'flex', gap: '4px', padding: '4px', borderRadius: '12px', background: '#161616', border: '1px solid #252525' }}>
      {opts.map(([k, l]) => (
        <button key={k} type="button" onClick={() => onChange(k)}
          style={{
            flex: 1, padding: '8px', borderRadius: '9px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
            background: value === k ? 'rgba(201,168,76,0.12)' : 'transparent',
            color: value === k ? '#C9A84C' : '#6B6560',
            border: value === k ? '1px solid rgba(201,168,76,0.2)' : '1px solid transparent',
          }}>
          {l}
        </button>
      ))}
    </div>
  )
}
const inputStyle = { padding: '9px 12px', borderRadius: '10px', background: '#111', border: '1px solid #252525', color: '#EFEFEF', fontSize: '13px', outline: 'none', width: '100%' }

// ── Componente ─────────────────────────────────────────────────────
export default function RelatoriosListas({ clients = [], profiles = [], role }) {
  const isGerente = role === 'gerente'
  const nameOf = useMemo(() => {
    const m = Object.fromEntries(profiles.map(p => [p.id, p.name || '—']))
    return id => m[id] || (id ? '—' : '')
  }, [profiles])

  const preVendas = useMemo(() => profiles.filter(p => p.role === 'pre_vendas'), [profiles])
  const vendedores = useMemo(() => profiles.filter(p => p.role === 'vendedor' || p.role === 'gerente'), [profiles])

  // Colunas disponíveis
  const COLUMNS = useMemo(() => [
    { key: 'nome',        label: 'Nome',                 get: c => c.contact_name },
    { key: 'empresa',     label: 'Empresa',              get: c => c.company_name },
    { key: 'cargo',       label: 'Cargo',                get: c => c.contact_role },
    { key: 'telefone',    label: 'Telefone',             get: c => c.phone },
    { key: 'email',       label: 'Email',                get: c => c.email },
    { key: 'endereco',    label: 'Endereço',             get: c => [c.address_street, c.address_number, c.address_neighborhood].filter(Boolean).join(', ') },
    { key: 'cidade',      label: 'Cidade',               get: c => c.city },
    { key: 'instagram',   label: 'Instagram',            get: c => c.instagram },
    { key: 'origem',      label: 'Origem',               get: c => c.origin },
    { key: 'estagio',     label: 'Estágio',              get: c => STAGES[c.matricula_stage] || c.matricula_stage },
    { key: 'treinos',     label: 'Treinos de interesse', get: c => (c.treinamentos_interesse || []).join(', ') },
    { key: 'matriculas',  label: 'Matrículas',           get: c => (c.matriculas || []).join(', ') },
    { key: 'registro',    label: 'Data de registro',     get: c => fmtDate(c.created_at) },
    { key: 'marcacao',    label: 'Data de marcação',     get: c => fmtDateTime(c.visit_scheduled_at) },
    { key: 'data_visita', label: 'Data da visita',       get: c => fmtDate(latestVisit(c)?.visit_date) },
    { key: 'resultado',   label: 'Resultado da visita',  get: c => OUTCOMES[latestVisit(c)?.visit_outcome] || '' },
    { key: 'descricao',   label: 'Descrição da visita',  get: c => latestVisit(c)?.visit_notes || '' },
    { key: 'nota',        label: 'Nota',                 get: c => latestVisit(c)?.rating || '' },
    { key: 'marcou',      label: 'Quem marcou',          get: c => nameOf(c.created_by) },
    { key: 'vendedor',    label: 'Vendedor',             get: c => nameOf(c.assigned_to) },
  ], [nameOf])

  // Filtros
  const [f, setF] = useState({
    treinos: [], estagios: [], origens: [], resultados: [],
    matriculado: 'all', recebeuVisita: 'all',
    marcadoPor: 'all', vendedor: 'all',
    cidade: '', dateField: 'registro', from: '', to: '',
  })
  const set = (k, v) => setF(prev => ({ ...prev, [k]: v }))
  const toggleIn = (k, val) => setF(prev => ({ ...prev, [k]: prev[k].includes(val) ? prev[k].filter(x => x !== val) : [...prev[k], val] }))

  // Colunas selecionadas (padrão)
  const [cols, setCols] = useState(['nome', 'telefone', 'cidade', 'endereco', 'registro', 'data_visita', 'descricao', 'estagio'])
  const toggleCol = key => setCols(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])
  const orderedCols = COLUMNS.filter(c => cols.includes(c.key))

  // Aplica filtros
  const rows = useMemo(() => {
    return clients.filter(c => {
      if (f.treinos.length && !f.treinos.every(t => (c.treinamentos_interesse || []).includes(t))) return false
      if (f.estagios.length && !f.estagios.includes(c.matricula_stage)) return false
      if (f.origens.length && !f.origens.includes(c.origin)) return false

      const matriculado = c.matricula_stage === 'matriculado' || (c.matriculas || []).length > 0
      if (f.matriculado === 'sim' && !matriculado) return false
      if (f.matriculado === 'nao' && matriculado) return false

      const recebeu = ['recebeu_visita', 'matriculado'].includes(c.matricula_stage) || (c.visits || []).some(v => v.visit_outcome)
      if (f.recebeuVisita === 'sim' && !recebeu) return false
      if (f.recebeuVisita === 'nao' && recebeu) return false

      if (f.resultados.length) {
        const outcomes = (c.visits || []).map(v => v.visit_outcome).filter(Boolean)
        if (!f.resultados.some(r => outcomes.includes(r))) return false
      }

      if (f.marcadoPor !== 'all' && c.created_by !== f.marcadoPor) return false
      if (f.vendedor !== 'all' && c.assigned_to !== f.vendedor) return false
      if (f.cidade.trim() && !(c.city || '').toLowerCase().includes(f.cidade.trim().toLowerCase())) return false

      if (f.from || f.to) {
        const raw = f.dateField === 'visita' ? latestVisit(c)?.visit_date : c.created_at
        if (!raw) return false
        // visit_date é só-data (YYYY-MM-DD): parseia como meio-dia local p/ não perder 1 dia no fuso
        const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw + 'T12:00:00' : raw)
        if (f.from && d < new Date(f.from + 'T00:00:00')) return false
        if (f.to && d > new Date(f.to + 'T23:59:59')) return false
      }
      return true
    })
  }, [clients, f])

  function exportCSV() {
    if (!orderedCols.length) { alert('Selecione ao menos uma coluna.'); return }
    const header = orderedCols.map(c => csvEscape(c.label)).join(';')
    const lines = rows.map(r => orderedCols.map(c => csvEscape(c.get(r))).join(';'))
    const stamp = new Date().toISOString().slice(0, 10)
    downloadCSV([header, ...lines].join('\r\n'), `lista-clientes-${stamp}.csv`)
  }

  const outcomeOpts = Object.entries(OUTCOMES).map(([key, label]) => ({ key, label }))
  const stageOpts   = Object.entries(STAGES).map(([key, label]) => ({ key, label }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* ── Filtros ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', background: '#161616', border: '1px solid #252525', borderRadius: '16px', padding: '16px' }}>
        <Section title="Treinamento de interesse">
          <Chips options={TREINAMENTOS.map(t => ({ key: t, label: t }))} selected={f.treinos} onToggle={v => toggleIn('treinos', v)} />
        </Section>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          <Section title="Matriculado"><Toggle3 value={f.matriculado} onChange={v => set('matriculado', v)} /></Section>
          <Section title="Recebeu visita"><Toggle3 value={f.recebeuVisita} onChange={v => set('recebeuVisita', v)} /></Section>
        </div>

        <Section title="Estágio da matrícula">
          <Chips options={stageOpts} selected={f.estagios} onToggle={v => toggleIn('estagios', v)} />
        </Section>

        <Section title="Resultado da visita">
          <Chips options={outcomeOpts} selected={f.resultados} onToggle={v => toggleIn('resultados', v)} />
        </Section>

        <Section title="Origem">
          <Chips options={ORIGENS} selected={f.origens} onToggle={v => toggleIn('origens', v)} />
        </Section>

        {isGerente && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <Section title="Marcado por">
              <select value={f.marcadoPor} onChange={e => set('marcadoPor', e.target.value)} style={inputStyle}>
                <option value="all">Qualquer</option>
                {preVendas.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Section>
            <Section title="Vendedor">
              <select value={f.vendedor} onChange={e => set('vendedor', e.target.value)} style={inputStyle}>
                <option value="all">Qualquer</option>
                {vendedores.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Section>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          <Section title="Cidade">
            <input value={f.cidade} onChange={e => set('cidade', e.target.value)} placeholder="Ex: Lajeado" style={inputStyle} />
          </Section>
          <Section title="Período por">
            <select value={f.dateField} onChange={e => set('dateField', e.target.value)} style={inputStyle}>
              <option value="registro">Data de registro</option>
              <option value="visita">Data da visita</option>
            </select>
          </Section>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          <Section title="De"><input type="date" value={f.from} onChange={e => set('from', e.target.value)} style={inputStyle} /></Section>
          <Section title="Até"><input type="date" value={f.to} onChange={e => set('to', e.target.value)} style={inputStyle} /></Section>
        </div>
      </div>

      {/* ── Colunas ── */}
      <Section title={`Colunas da planilha (${cols.length})`}>
        <Chips options={COLUMNS.map(c => ({ key: c.key, label: c.label }))} selected={cols} onToggle={toggleCol} />
      </Section>

      {/* ── Resultado + export ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
        <p style={{ fontSize: '14px', fontWeight: 700, color: '#EFEFEF' }}>
          {rows.length} {rows.length === 1 ? 'cliente' : 'clientes'}
        </p>
        <button onClick={exportCSV} disabled={!rows.length}
          style={{
            padding: '10px 16px', borderRadius: '12px', cursor: rows.length ? 'pointer' : 'not-allowed',
            background: 'linear-gradient(135deg, #7B1C3A 0%, #C9A84C 100%)', border: 'none',
            color: '#F0EAD6', fontSize: '13px', fontWeight: 700, opacity: rows.length ? 1 : 0.4,
            display: 'flex', alignItems: 'center', gap: '7px',
          }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Exportar CSV
        </button>
      </div>

      {/* ── Preview ── */}
      {orderedCols.length === 0 ? (
        <p style={{ fontSize: '13px', color: '#6B6560', textAlign: 'center', padding: '20px' }}>Selecione ao menos uma coluna.</p>
      ) : rows.length === 0 ? (
        <p style={{ fontSize: '13px', color: '#6B6560', textAlign: 'center', padding: '20px' }}>Nenhum cliente com esses filtros.</p>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid #252525', borderRadius: '12px' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '12px' }}>
            <thead>
              <tr>
                {orderedCols.map(c => (
                  <th key={c.key} style={{ textAlign: 'left', padding: '10px 12px', whiteSpace: 'nowrap', color: '#C9A84C', fontWeight: 700, borderBottom: '1px solid #252525', background: '#141414', position: 'sticky', top: 0 }}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 200).map((r, i) => (
                <tr key={r.id || i}>
                  {orderedCols.map(c => (
                    <td key={c.key} style={{ padding: '9px 12px', whiteSpace: 'nowrap', color: '#B0A99F', borderBottom: '1px solid #1C1C1C', maxWidth: '260px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {c.get(r)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > 200 && (
            <p style={{ fontSize: '11px', color: '#6B6560', textAlign: 'center', padding: '10px' }}>
              Mostrando 200 de {rows.length} — o CSV traz todos.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

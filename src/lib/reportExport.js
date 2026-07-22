// Gerador de relatório HTML para impressão/PDF
// Abre em nova aba — File > Print > Salvar como PDF

const TRAINING_COLORS = {
  'Impacto': '#E85555', 'Perfil': '#E8834A', 'Vendas': '#C9A84C',
  'LORAP': '#4ADE80', 'Academia Vithall': '#60A5FA', 'Mentoria': '#A78BFA',
}
const TRAININGS = ['Impacto', 'Perfil', 'Vendas', 'LORAP', 'Academia Vithall', 'Mentoria']
const ORIGINS = [
  { key: 'frias contatinhos', label: 'Frias contatinhos' },
  { key: 'frias listas',      label: 'Frias listas' },
  { key: 'lead campanha',     label: 'Lead campanha' },
  { key: 'lead organico',    label: 'Lead orgânico' },
  { key: 'feiras',            label: 'Eventos' },
  { key: 'indicacao',         label: 'Indicação' },
]
const ROLE_LABELS = { pre_vendas: 'Pré-vendas', vendedor: 'Vendedor', gerente: 'Gerente' }

function pct(a, b) { return b > 0 ? Math.round((a / b) * 100) : null }
function fmt(n)    { return n ?? '—' }
function fmtPct(n) { return n != null ? `${n}%` : '—' }
function plural(n, s, p) { return n === 1 ? s : (p || s + 's') }

// Escapa texto controlado pelo usuário (nomes) antes de entrar no HTML do
// relatório — evita que um nome com código execute ao abrir o relatório
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ))
}

/** Calcula métricas de um conjunto de clientes/logs */
function calcMetrics(memberClients, logs, periodStart, periodEnd) {
  const inR = (d) => (!periodStart || d >= periodStart) && (!periodEnd || d <= periodEnd)
  const inPeriod   = memberClients.filter(c => inR(new Date(c.created_at)))
  const visits     = memberClients.flatMap(c =>
    (c.visits || []).filter(v => inR(new Date(v.visit_date + 'T12:00:00'))))
  const allEnrolled = memberClients.filter(c => c.matricula_stage === 'matriculado')
  const enrolled   = inPeriod.filter(c => c.matricula_stage === 'matriculado')
  const noShow     = inPeriod.filter(c => c.matricula_stage === 'nao_apareceu')
  const canceled   = inPeriod.filter(c => c.matricula_stage === 'cancelado')
  const logsInPeriod = logs.filter(l => inR(new Date(l.log_date + 'T12:00:00')))
  const calls    = logsInPeriod.reduce((s, l) => s + (l.calls || 0), 0)
  const answered = logsInPeriod.reduce((s, l) => s + (l.answered || 0), 0)

  const trainings = TRAININGS.map(t => ({
    label: t, count: allEnrolled.filter(c => (c.matriculas || []).includes(t)).length
  }))
  const origins = ORIGINS.map(o => ({
    label: o.label, count: allEnrolled.filter(c => c.origin === o.key).length
  }))

  return {
    marcacoes:  inPeriod.length,
    visitas:    visits.length,
    matriculas: enrolled.length,
    noShow:     noShow.length,
    canceled:   canceled.length,
    calls,
    answered,
    answerRate: pct(answered, calls),
    convMV:     pct(visits.length, inPeriod.length),
    convVE:     pct(enrolled.length, visits.length),
    trainings,
    origins,
    totalEnrolled: allEnrolled.length,
  }
}

// ── DESTAQUES ────────────────────────────────────────────────────────
// Observações automáticas sobre o período. Regra da casa: SÓ COISAS
// POSITIVAS. O relatório é lido pela pessoa que produziu os números, e o
// objetivo é destacar o que deu certo — o que foi mal já aparece cru nas
// tabelas, não precisa de holofote. Toda regra devolve nada quando não
// tem o que elogiar (nunca inventa e nunca vira crítica velada).

/** Valor de matrícula é texto livre ("R$ 3.500,00", "3500"). Só soma o que
 *  dá pra ler com certeza; qualquer dúvida vira null e o destaque some. */
function parseMoney(v) {
  if (v == null || v === '') return null
  const s = String(v).replace(/[^\d.,]/g, '')
  if (!s) return null
  // pt-BR: ponto separa milhar, vírgula separa decimal
  const n = Number(s.replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? n : null
}

const firstName = (n) => String(n || '').trim().split(/\s+/)[0] || '—'

function nameList(arr) {
  const ns = arr.map(m => esc(firstName(m.name)))
  if (ns.length === 1) return ns[0]
  return ns.slice(0, -1).join(', ') + ' e ' + ns[ns.length - 1]
}

const brDate = (iso) =>
  new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '')

/**
 * Monta a lista de destaques do período a partir dos números já calculados.
 * Cada item tem um peso; no fim mostra os melhores, para o relatório não
 * virar uma parede de elogio genérico.
 */
function buildHighlights({ members, totals, monthly, trainings, origins, periodStart, periodEnd }) {
  const out = []
  const add = (weight, icon, html) => out.push({ weight, icon, html })
  const isGroup = members.length > 1
  const inR = (d) => (!periodStart || d >= periodStart) && (!periodEnd || d <= periodEnd)

  // — Dia mais forte de ligações (só se realmente destoou da média)
  const byDay = {}
  for (const m of members) {
    for (const l of (m.logs || [])) {
      if (!l.log_date || !inR(new Date(l.log_date + 'T12:00:00'))) continue
      byDay[l.log_date] = (byDay[l.log_date] || 0) + (l.calls || 0)
    }
  }
  const dias = Object.entries(byDay).filter(([, v]) => v > 0)
  if (dias.length >= 3) {
    const [bestDay, bestVal] = dias.sort((a, b) => b[1] - a[1])[0]
    const media = dias.reduce((s, [, v]) => s + v, 0) / dias.length
    if (bestVal >= media * 1.2) {
      add(70, '📞', `<b>Dia mais forte:</b> ${brDate(bestDay)}, com <b>${bestVal} ligações</b> — ${Math.round((bestVal / media - 1) * 100)}% acima da média diária do período.`)
    }
  }

  // — Volume de trabalho (aparece quando não teve um pico pra destacar)
  if (dias.length >= 3 && totals.calls > 0) {
    add(38, '📊', `<b>Constância:</b> ${totals.calls} ${plural(totals.calls, 'ligação', 'ligações')} registradas em ${dias.length} dias — média de ${Math.round(totals.calls / dias.length)} por dia.`)
  }

  // — Taxa de atendimento
  if (totals.answerRate != null && totals.answerRate >= 40 && totals.calls >= 20) {
    add(58, '☎️', `<b>Boa taxa de atendimento:</b> ${totals.answerRate}% das ${totals.calls} ligações foram atendidas.`)
  }

  // — Conversão visita → matrícula (o número que mais importa)
  if (totals.convVE != null && totals.convVE >= 30 && totals.visitas >= 3) {
    add(86, '🎯', `<b>Conversão forte:</b> ${totals.convVE}% das visitas viraram matrícula (${totals.matriculas} de ${totals.visitas}).`)
  }

  // — Marcação que vira visita de verdade
  if (totals.convMV != null && totals.convMV >= 65 && totals.marcacoes >= 5) {
    add(54, '✅', `<b>Marcações bem aproveitadas:</b> ${totals.convMV}% das ${totals.marcacoes} marcações viraram visita.`)
  }

  // — Quem liderou em matrículas
  if (isGroup) {
    const top = [...members].sort((a, b) => b.matriculas - a.matriculas)[0]
    if (top && top.matriculas > 0) {
      add(95, '🏆', `<b>${esc(firstName(top.name))}</b> liderou em matrículas: <b>${top.matriculas}</b> ${plural(top.matriculas, 'fechada')} no período.`)
    }
    // — Melhor aproveitamento (exige amostra, senão "1 visita, 1 matrícula" vira 100%)
    const comAmostra = members.filter(m => m.visitas >= 3 && m.convVE != null)
    if (comAmostra.length) {
      const best = comAmostra.sort((a, b) => b.convVE - a.convVE)[0]
      if (best.convVE >= 40) {
        add(80, '⭐', `<b>Melhor aproveitamento:</b> ${esc(firstName(best.name))} converteu ${best.convVE}% das visitas (${best.matriculas} de ${best.visitas}).`)
      }
    }
    // — Ninguém ficou de fora
    if (members.every(m => m.matriculas > 0)) {
      add(78, '🤝', `<b>Time inteiro no placar:</b> ${plural(members.length, 'a', 'todas as')} ${members.length} ${plural(members.length, 'pessoa', 'pessoas')} ${plural(members.length, 'fechou', 'fecharam')} pelo menos uma matrícula.`)
    }
  }

  // — Período sem falta nem cancelamento
  const limpos = members.filter(m => m.marcacoes >= 5 && m.noShow === 0 && m.canceled === 0)
  if (limpos.length) {
    if (isGroup && limpos.length === members.length) {
      add(76, '💎', `<b>Nenhuma falta ou cancelamento</b> no período — as ${totals.marcacoes} marcações foram todas honradas.`)
    } else {
      add(64, '💎', `<b>${nameList(limpos)}</b> ${plural(limpos.length, 'fechou', 'fecharam')} o período sem nenhuma falta ou cancelamento.`)
    }
  }

  // — Mês a mês (só existe no período anual)
  if (monthly && monthly.length >= 2) {
    const best = [...monthly].sort((a, b) => (b.matriculas || 0) - (a.matriculas || 0))[0]
    if (best && best.matriculas > 0) {
      add(72, '📅', `<b>Melhor mês:</b> ${esc(best.label)}, com ${best.matriculas} ${plural(best.matriculas, 'matrícula')}.`)
    }
    const last = monthly[monthly.length - 1]
    const prev = monthly[monthly.length - 2]
    if (last && prev && prev.matriculas > 0 && last.matriculas > prev.matriculas) {
      add(90, '📈', `<b>Em alta:</b> ${esc(last.label)} superou ${esc(prev.label)} em matrículas (${last.matriculas} contra ${prev.matriculas}, +${Math.round((last.matriculas / prev.matriculas - 1) * 100)}%).`)
    }
  }

  // — Treinamento e origem que mais renderam
  const tTop = [...trainings].sort((a, b) => b.count - a.count)[0]
  if (tTop && tTop.count > 0) {
    add(48, '🎓', `<b>${esc(tTop.label)}</b> foi o treinamento mais vendido: ${tTop.count} ${plural(tTop.count, 'matrícula')}.`)
  }
  const oTop = [...origins].sort((a, b) => b.count - a.count)[0]
  if (oTop && oTop.count > 0) {
    add(44, '🔎', `<b>Origem mais efetiva:</b> ${esc(oTop.label)}, com ${oTop.count} ${plural(oTop.count, 'matrícula')}.`)
  }

  // — Dinheiro: só sai se TODAS as matrículas tiverem valor legível, senão o
  //   total sairia menor que a realidade e viraria informação errada
  const todas = members.flatMap(m => m.enrolled || [])
  if (todas.length >= 2) {
    const valores = todas.map(e => parseMoney(e.valor))
    if (valores.every(v => v != null)) {
      const soma = valores.reduce((s, v) => s + v, 0)
      add(92, '💰', `<b>${soma.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}</b> em matrículas fechadas no período (${todas.length} ${plural(todas.length, 'contrato')}).`)
    }
    // — Todas já efetivadas
    if (todas.every(e => e.status !== 'pendente')) {
      add(66, '🔒', `<b>Todas as ${todas.length} matrículas do período já estão efetivadas</b> — nenhuma pendente.`)
    }
  }

  return out.sort((a, b) => b.weight - a.weight).slice(0, 6)
}

function highlightsSection(items) {
  if (!items.length) return ''
  return `
  <div class="section keep">
    <div class="section-title">Destaques do Período</div>
    <div class="hl-grid">
      ${items.map(h => `
        <div class="hl">
          <div class="hl-icon">${h.icon}</div>
          <div class="hl-text">${h.html}</div>
        </div>`).join('')}
    </div>
    <div class="hl-note">Observações geradas automaticamente a partir dos números do período.</div>
  </div>`
}

// ── BLOCOS ───────────────────────────────────────────────────────────

const MEDALS = ['🥇', '🥈', '🥉']

/** Monta linha de pessoa para a tabela comparativa */
function memberRow(m, i, isTop) {
  const convColor = m.convVE >= 50 ? '#15803D' : m.convVE >= 25 ? '#B45309' : '#9F1239'
  return `
    <tr>
      <td class="t-name">
        <span class="t-medal">${isTop ? MEDALS[i] : ''}</span>
        <span>
          ${esc(m.name)}
          <em>${ROLE_LABELS[m.role] || m.role}</em>
        </span>
      </td>
      <td>${fmt(m.calls || 0)}</td>
      <td class="c-teal">${fmt(m.answered || 0)}</td>
      <td>${fmt(m.marcacoes)}</td>
      <td>${fmt(m.visitas)}</td>
      <td class="c-green b">${fmt(m.matriculas)}</td>
      <td class="c-gold b">${fmt(m.creditos || 0)}</td>
      <td class="c-mute">${m.noShow || '·'}</td>
      <td class="c-mute">${m.canceled || '·'}</td>
      <td class="b" style="color:${convColor}">${fmtPct(m.convVE)}</td>
    </tr>`
}

/** Bloco de métricas resumo */
function metricCard(label, value, sub, color) {
  return `
    <div class="card" style="--c:${color}">
      <div class="card-label">${label}</div>
      <div class="card-value">${value}</div>
      <div class="card-sub">${sub || '&nbsp;'}</div>
    </div>`
}

/** Seção de treinamentos */
function trainingsSection(trainings) {
  const max = Math.max(...trainings.map(t => t.count), 1)
  return `
    <h3 class="sub-title">Matrículas por Treinamento</h3>
    <div class="tr-grid">
      ${trainings.map(t => `
        <div class="tr-item">
          <div class="tr-head">
            <span>${t.label}</span>
            <b style="color:${TRAINING_COLORS[t.label] || '#333'}">${t.count}</b>
          </div>
          <div class="track"><div class="fill" style="width:${Math.round((t.count / max) * 100)}%;background:${TRAINING_COLORS[t.label] || '#999'}"></div></div>
        </div>`).join('')}
    </div>`
}

/** Seção de origens */
function originsSection(origins) {
  const max = Math.max(...origins.map(o => o.count), 1)
  return `
    <h3 class="sub-title">Origem das Matrículas</h3>
    <div class="or-list">
      ${origins.map(o => `
        <div class="or-row">
          <div class="or-label">${o.label}</div>
          <div class="track"><div class="fill" style="width:${Math.round((o.count / max) * 100)}%;background:#C9A84C"></div></div>
          <div class="or-val">${o.count}</div>
        </div>`).join('')}
    </div>`
}

/** Lista de matrículas fechadas por pessoa (quem marcou) — o número da tela
 *  vira nomes no papel: cliente, empresa, data, valor e situação. */
function enrolledSection(members) {
  const withE = members.filter(m => (m.enrolled || []).length > 0)
  if (!withE.length) return ''
  return `
  <div class="section">
    <div class="section-title">Matrículas Fechadas — por quem marcou a visita</div>
    ${withE.map(m => `
      <div class="enr-block">
        <div class="enr-head">
          ${esc(m.name)} <span>· ${m.enrolled.length} ${plural(m.enrolled.length, 'matrícula')}</span>
        </div>
        <table>
          <thead><tr>
            <th class="l">Cliente</th><th class="l">Empresa</th>
            <th>Data</th><th>Valor</th><th>Situação</th>
          </tr></thead>
          <tbody>
            ${m.enrolled.map(e => `
            <tr>
              <td class="l b">${esc(e.matriculado || e.nome)}</td>
              <td class="l c-mute">${esc(e.empresa || '—')}</td>
              <td>${new Date(e.data + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
              <td class="c-gold b">${e.valor ? 'R$ ' + esc(e.valor) : '—'}</td>
              <td>
                <span class="pill ${e.status === 'pendente' ? 'pill-warn' : 'pill-ok'}">${e.status === 'pendente' ? 'Pendente' : 'Efetivada'}</span>
                ${e.status === 'pendente' && e.nota ? `<div class="pill-note">${esc(e.nota)}</div>` : ''}
              </td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>`).join('')}
  </div>`
}

/** Resumo mês a mês (período anual) — 🔥 marca o melhor mês de cada métrica */
function monthlySection(monthly) {
  if (!monthly || monthly.length < 2) return ''
  const METS = [
    ['calls', 'Ligações', '#C2410C'], ['atendidas', 'Atendidas', '#0E7490'],
    ['marcacoes', 'Marcações', '#1D4ED8'], ['visitas', 'Visitas', '#6D28D9'],
    ['matriculas', 'Matrículas', '#15803D'],
  ]
  const best = {}
  METS.forEach(([k]) => { best[k] = Math.max(...monthly.map(d => d[k] || 0)) })
  return `
  <div class="section">
    <div class="section-title">Resumo Mês a Mês</div>
    <table>
      <thead><tr>
        <th class="l">Mês</th>
        ${METS.map(([, l, c]) => `<th style="color:${c}">${l}</th>`).join('')}
      </tr></thead>
      <tbody>
        ${monthly.map(d => `
        <tr>
          <td class="l b cap">${esc(d.label)}</td>
          ${METS.map(([k, , c]) => {
            const v = d[k] || 0
            const top = v > 0 && v === best[k]
            return `<td class="${top ? 'b' : ''}" style="color:${top ? c : (v > 0 ? '#444' : '#CCC')}">${top ? '🔥 ' : ''}${v}</td>`
          }).join('')}
        </tr>`).join('')}
      </tbody>
    </table>
    <div class="foot-note">🔥 marca o melhor mês em cada métrica</div>
  </div>`
}

/** Gera o HTML completo do relatório */
export function generateReportHTML({
  scope,        // 'individual' | 'pre_vendas' | 'vendedores' | 'all'
  members,      // array de { ...profile, memberClients, logs, enrolled }
  periodDays,
  periodStart,
  periodEnd,
  periodLabel,
  exportedBy,
  monthly,      // resumo mês a mês (período anual) ou null
}) {
  const now = new Date().toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })

  const scopeLabel = {
    individual:  `Individual — ${esc(members[0]?.name)}`,
    pre_vendas:  'Equipe de Pré-Vendas',
    vendedores:  'Equipe de Vendedores',
    all:         'Equipe Completa',
  }[scope] || scope

  // Calcula métricas por membro
  const membersWithMetrics = members.map(m => ({
    ...m,
    ...calcMetrics(m.memberClients, m.logs, periodStart, periodEnd),
  }))

  // Total geral (soma de todos)
  const totals = {
    name: scope === 'individual' ? membersWithMetrics[0]?.name : 'Total da equipe',
    role: membersWithMetrics[0]?.role,
    calls:      membersWithMetrics.reduce((s, m) => s + (m.calls || 0), 0),
    answered:   membersWithMetrics.reduce((s, m) => s + (m.answered || 0), 0),
    marcacoes:  membersWithMetrics.reduce((s, m) => s + m.marcacoes, 0),
    visitas:    membersWithMetrics.reduce((s, m) => s + m.visitas, 0),
    matriculas: membersWithMetrics.reduce((s, m) => s + m.matriculas, 0),
    creditos:   membersWithMetrics.reduce((s, m) => s + (m.creditos || 0), 0),
    noShow:     membersWithMetrics.reduce((s, m) => s + m.noShow, 0),
    canceled:   membersWithMetrics.reduce((s, m) => s + m.canceled, 0),
  }
  totals.convMV     = pct(totals.visitas, totals.marcacoes)
  totals.convVE     = pct(totals.matriculas, totals.visitas)
  totals.answerRate = pct(totals.answered, totals.calls)

  // Trainings e origins do total
  const totalTrainings = TRAININGS.map((t, i) => ({
    label: t,
    count: membersWithMetrics.reduce((s, m) => s + (m.trainings?.[i]?.count || 0), 0),
  }))
  const totalOrigins = ORIGINS.map((o, i) => ({
    label: o.label,
    count: membersWithMetrics.reduce((s, m) => s + (m.origins?.[i]?.count || 0), 0),
  }))

  const highlights = buildHighlights({
    members: membersWithMetrics, totals, monthly,
    trainings: totalTrainings, origins: totalOrigins,
    periodStart, periodEnd,
  })

  const showTable = members.length > 1

  // Ranking por matrículas — o pódio ganha medalha na tabela
  const ranked = [...membersWithMetrics].sort((a, b) => b.matriculas - a.matriculas)
  const podium = ranked.filter(m => m.matriculas > 0).slice(0, 3).map(m => m.id)

  // Funil: cada etapa com a taxa de passagem para a seguinte
  const funil = [
    { label: 'Ligações',   val: totals.calls,      color: '#EA580C' },
    { label: 'Atendidas',  val: totals.answered,   color: '#0E7490' },
    { label: 'Marcações',  val: totals.marcacoes,  color: '#2563EB' },
    { label: 'Visitas',    val: totals.visitas,    color: '#7C3AED' },
    { label: 'Matrículas', val: totals.matriculas, color: '#16A34A' },
  ].filter((f, i) => i > 1 || f.val > 0) // sem ligações registradas, começa em Marcações
  const funilMax = Math.max(...funil.map(f => f.val), 1)

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Relatório Vithall CRM — ${periodLabel}</title>
<style>
  *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

  :root {
    --ink:    #14110F;
    --body:   #4A4440;
    --mute:   #8A827B;
    --line:   #E9E5E0;
    --paper:  #FFFFFF;
    --gold:   #A8823C;
    --bordo:  #7B1C3A;
  }

  body {
    font-family: ui-sans-serif, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
    background: #EFEDEA;
    color: var(--body);
    font-size: 13px;
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
  }

  /* Fundo e cor precisam sair na impressão, senão vira tudo branco */
  @media print {
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body { background: #fff; }
    .no-print { display: none !important; }
    .page-break { break-before: page; }
    .keep { break-inside: avoid; }
    .section { box-shadow: none !important; border: 1px solid var(--line); }
  }
  @page { margin: 14mm 11mm; size: A4; }

  .wrap { max-width: 900px; margin: 0 auto; padding-bottom: 40px; }

  /* ── Cabeçalho ─────────────────────────────────────────── */
  .header {
    background:
      radial-gradient(120% 140% at 100% 0%, rgba(168,130,60,.22) 0%, transparent 55%),
      linear-gradient(135deg, #14100E 0%, #221715 100%);
    padding: 34px 40px 30px;
    border-bottom: 3px solid var(--gold);
  }
  .header-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; }
  .brand { display: flex; align-items: center; gap: 13px; }
  .brand-logo {
    width: 40px; height: 40px; border-radius: 11px;
    background: linear-gradient(135deg, var(--bordo), #C9A84C);
    display: flex; align-items: center; justify-content: center;
    font-size: 17px; font-weight: 800; color: #F5EFE0;
    box-shadow: 0 2px 10px rgba(201,168,76,.3);
  }
  .brand-name { font-size: 12px; font-weight: 700; color: #C9A84C; letter-spacing: .14em; text-transform: uppercase; }
  .brand-sub  { font-size: 10.5px; color: #857C72; margin-top: 3px; letter-spacing: .03em; }
  .header-meta { text-align: right; font-size: 10.5px; color: #857C72; line-height: 1.7; }
  .header-meta b { color: #C9A84C; font-weight: 600; }
  .header h1 {
    font-size: 27px; font-weight: 800; color: #F7F4EF;
    margin-top: 26px; letter-spacing: -.6px; line-height: 1.15;
  }
  .scope {
    display: inline-block; margin-top: 10px; padding: 5px 15px;
    border-radius: 99px; background: rgba(201,168,76,.13);
    border: 1px solid rgba(201,168,76,.32); color: #D4B15E;
    font-size: 11.5px; font-weight: 600; letter-spacing: .02em;
  }

  /* ── Seções ────────────────────────────────────────────── */
  .section {
    background: var(--paper); border-radius: 14px;
    box-shadow: 0 1px 3px rgba(20,17,15,.07), 0 8px 24px -12px rgba(20,17,15,.12);
    padding: 26px 30px; margin: 18px 16px 0;
  }
  .section-title {
    font-size: 10.5px; font-weight: 700; text-transform: uppercase;
    letter-spacing: .16em; color: var(--mute); margin-bottom: 18px;
    padding-bottom: 10px; border-bottom: 1px solid var(--line);
  }
  .sub-title {
    font-size: 10.5px; font-weight: 700; text-transform: uppercase;
    letter-spacing: .14em; color: var(--mute); margin-bottom: 13px;
  }
  .divider { height: 1px; background: var(--line); margin: 24px 0 20px; }
  .foot-note { font-size: 10px; color: #B3ABA3; margin-top: 10px; }

  /* ── Cards de métrica ──────────────────────────────────── */
  .card-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 11px; }
  .card {
    position: relative; overflow: hidden;
    background: linear-gradient(180deg, color-mix(in srgb, var(--c) 7%, #fff) 0%, #fff 62%);
    border: 1px solid var(--line); border-radius: 12px; padding: 15px 17px 14px;
  }
  .card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px; background: var(--c); }
  .card-label { font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .11em; color: var(--mute); }
  .card-value {
    font-size: 31px; font-weight: 800; color: var(--ink);
    letter-spacing: -1.4px; line-height: 1.1; margin-top: 5px;
    font-variant-numeric: tabular-nums;
  }
  .card-sub { font-size: 10.5px; color: var(--mute); margin-top: 3px; }

  /* ── Avisos ────────────────────────────────────────────── */
  .flags { display: flex; gap: 10px; margin-top: 14px; flex-wrap: wrap; }
  .flag { padding: 8px 14px; border-radius: 9px; font-size: 11.5px; font-weight: 500; }
  .flag b { font-weight: 800; }
  .flag-red  { background: #FEF2F2; border: 1px solid #FBD5D5; color: #9B1C1C; }
  .flag-amb  { background: #FFFAF0; border: 1px solid #FCE4B6; color: #92400E; }

  /* ── Funil ─────────────────────────────────────────────── */
  .fn-row { display: flex; align-items: center; gap: 12px; margin-bottom: 7px; }
  .fn-label { font-size: 11.5px; color: var(--body); width: 82px; flex-shrink: 0; font-weight: 500; }
  .fn-track { flex: 1; height: 26px; background: #F6F4F1; border-radius: 7px; overflow: hidden; }
  .fn-bar { height: 100%; border-radius: 7px; display: flex; align-items: center; padding: 0 10px; min-width: 42px; }
  .fn-val { font-size: 12.5px; font-weight: 800; font-variant-numeric: tabular-nums; }
  .fn-step { font-size: 10px; color: var(--mute); width: 58px; text-align: right; flex-shrink: 0; font-variant-numeric: tabular-nums; }

  /* ── Destaques ─────────────────────────────────────────── */
  .hl-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .hl {
    display: flex; gap: 11px; align-items: flex-start;
    padding: 13px 15px; border-radius: 11px;
    background: linear-gradient(180deg, #FDFAF3 0%, #FCF8F0 100%);
    border: 1px solid #F0E6D0;
  }
  .hl-icon { font-size: 16px; line-height: 1.35; flex-shrink: 0; }
  .hl-text { font-size: 12px; line-height: 1.55; color: #5A5048; }
  .hl-text b { color: #6B4E14; font-weight: 700; }
  .hl-note { font-size: 10px; color: #B3ABA3; margin-top: 12px; font-style: italic; }

  /* ── Barras (treinamentos / origens) ───────────────────── */
  .track { height: 6px; border-radius: 99px; background: #F1EEEA; overflow: hidden; }
  .fill  { height: 100%; border-radius: 99px; }
  .tr-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 9px; }
  .tr-item { padding: 11px 13px; border: 1px solid var(--line); border-radius: 10px; background: #FCFBFA; }
  .tr-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 7px; }
  .tr-head span { font-size: 11.5px; font-weight: 600; color: var(--ink); }
  .tr-head b { font-size: 17px; font-weight: 800; font-variant-numeric: tabular-nums; }
  .or-list { display: flex; flex-direction: column; gap: 9px; }
  .or-row { display: flex; align-items: center; gap: 11px; }
  .or-label { width: 104px; font-size: 11px; font-weight: 600; color: var(--body); flex-shrink: 0; }
  .or-val { width: 22px; text-align: right; font-size: 12px; font-weight: 700; color: var(--ink); font-variant-numeric: tabular-nums; }

  /* ── Tabelas ───────────────────────────────────────────── */
  table { width: 100%; border-collapse: collapse; font-size: 11.5px; }
  thead th {
    padding: 9px 7px; text-align: center; font-size: 9.5px;
    font-weight: 700; text-transform: uppercase; letter-spacing: .07em;
    color: var(--mute); background: #FAF9F7; border-bottom: 1.5px solid var(--line);
    white-space: nowrap;
  }
  thead th.l, td.l { text-align: left; }
  thead th:first-child { min-width: 132px; }
  tbody td {
    padding: 9px 7px; text-align: center; color: var(--body);
    border-bottom: 1px solid #F2EFEB; font-variant-numeric: tabular-nums;
  }
  tbody tr:nth-child(even) td { background: #FCFBFA; }
  td.b, .b { font-weight: 700; }
  td.cap { text-transform: capitalize; }
  .c-green { color: #15803D; } .c-gold { color: #8C6D1F; }
  .c-teal  { color: #0E7490; } .c-mute { color: #A39B93; }
  .t-name { display: flex; align-items: center; gap: 7px; text-align: left; color: var(--ink); font-weight: 600; white-space: nowrap; }
  .t-medal { width: 15px; flex-shrink: 0; font-size: 12px; }
  .t-name em {
    display: block; font-size: 9px; font-weight: 400; color: var(--mute);
    text-transform: uppercase; letter-spacing: .07em; font-style: normal; margin-top: 1px;
    white-space: nowrap;
  }
  .total-row td {
    background: #FDF9EE !important; font-weight: 800; color: var(--ink);
    border-top: 2px solid #E4D3A0; border-bottom: none;
  }

  /* ── Matrículas fechadas ───────────────────────────────── */
  .enr-block { margin-bottom: 20px; }
  .enr-block:last-child { margin-bottom: 0; }
  .enr-head { font-weight: 700; font-size: 12.5px; color: var(--ink); margin-bottom: 9px; }
  .enr-head span { color: #8C6D1F; font-weight: 600; }
  .pill { display: inline-block; padding: 2px 10px; border-radius: 99px; font-size: 9.5px; font-weight: 700; letter-spacing: .02em; }
  .pill-ok   { background: #F0FDF4; color: #15803D; border: 1px solid #BBF7D0; }
  .pill-warn { background: #FFF7ED; color: #C2410C; border: 1px solid #FED7AA; }
  .pill-note { font-size: 9.5px; color: var(--mute); margin-top: 3px; font-style: italic; }

  /* ── Cards individuais ─────────────────────────────────── */
  .ind-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 13px; }
  .ind { border: 1px solid var(--line); border-radius: 12px; overflow: hidden; }
  .ind-head {
    padding: 12px 15px; background: #FAF9F7; border-bottom: 1px solid var(--line);
    display: flex; justify-content: space-between; align-items: center; gap: 10px;
  }
  .ind-head .n { font-weight: 700; font-size: 13px; color: var(--ink); }
  .ind-head .r { font-size: 9px; color: var(--mute); text-transform: uppercase; letter-spacing: .07em; margin-top: 2px; }
  .ind-head .v { font-size: 21px; font-weight: 800; color: #15803D; font-variant-numeric: tabular-nums; }
  .ind-body { padding: 12px 15px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; text-align: center; }
  .ind-body .num { font-size: 17px; font-weight: 700; font-variant-numeric: tabular-nums; }
  .ind-body .cap { font-size: 8.5px; color: var(--mute); text-transform: uppercase; letter-spacing: .06em; margin-top: 1px; }
  .ind-foot { padding: 7px 15px; background: #FDFAF3; border-top: 1px solid #F2EAD8; font-size: 10.5px; color: var(--mute); display: flex; gap: 12px; }

  /* ── Rodapé + botão ────────────────────────────────────── */
  .footer { text-align: center; padding: 22px 16px 0; font-size: 9.5px; color: #B8B0A8; letter-spacing: .03em; }
  .print-btn {
    position: fixed; bottom: 24px; right: 24px;
    padding: 13px 26px; background: linear-gradient(135deg, var(--bordo), #C9A84C);
    color: #F5EFE0; font-weight: 700; font-size: 13.5px; border-radius: 13px;
    cursor: pointer; border: none; box-shadow: 0 6px 22px rgba(123,28,58,.32);
    font-family: inherit;
  }
</style>
</head>
<body>
<div class="wrap">

  <!-- ── HEADER ── -->
  <div class="header">
    <div class="header-top">
      <div class="brand">
        <div class="brand-logo">V</div>
        <div>
          <div class="brand-name">Vithall Treinamentos</div>
          <div class="brand-sub">CRM · Relatório de Desempenho</div>
        </div>
      </div>
      <div class="header-meta">
        <div>Período: <b>${periodLabel}</b></div>
        <div>Gerado em ${now}</div>
        <div>por ${esc(exportedBy)}</div>
      </div>
    </div>
    <h1>Relatório de Desempenho</h1>
    <div class="scope">${scopeLabel}</div>
  </div>

  <!-- ── MÉTRICAS GERAIS ── -->
  <div class="section keep">
    <div class="section-title">Resumo do Período</div>
    <div class="card-grid">
      ${metricCard('Ligações',   fmt(totals.calls),      null,                                        '#EA580C')}
      ${metricCard('Atendidas',  fmt(totals.answered),   `${fmtPct(totals.answerRate)} das ligações`,  '#0E7490')}
      ${metricCard('Marcações',  fmt(totals.marcacoes),  null,                                        '#2563EB')}
      ${metricCard('Visitas',    fmt(totals.visitas),    `${fmtPct(totals.convMV)} das marcações`,     '#7C3AED')}
      ${metricCard('Matrículas', fmt(totals.matriculas), `${fmtPct(totals.convVE)} das visitas`,       '#16A34A')}
      ${metricCard('Matr. de marcações', fmt(totals.creditos), 'comissão — de quem marcou',            '#A8823C')}
    </div>

    ${totals.noShow > 0 || totals.canceled > 0 ? `
    <div class="flags">
      ${totals.noShow > 0 ? `<div class="flag flag-red">🚫 <b>${totals.noShow}</b> não ${plural(totals.noShow, 'apareceu', 'apareceram')}</div>` : ''}
      ${totals.canceled > 0 ? `<div class="flag flag-amb">📵 <b>${totals.canceled}</b> ${plural(totals.canceled, 'cancelou', 'cancelaram')}</div>` : ''}
    </div>` : ''}

    <div class="divider"></div>
    <h3 class="sub-title">Funil de Conversão</h3>
    ${funil.map((f, i) => {
      const prev = funil[i - 1]
      const step = prev && prev.val > 0 ? Math.round((f.val / prev.val) * 100) : null
      return `<div class="fn-row">
        <div class="fn-label">${f.label}</div>
        <div class="fn-track">
          <div class="fn-bar" style="width:${Math.max(Math.round((f.val / funilMax) * 100), 4)}%;background:${f.color}1F">
            <span class="fn-val" style="color:${f.color}">${f.val}</span>
          </div>
        </div>
        <div class="fn-step">${step != null ? `↓ ${step}%` : ''}</div>
      </div>`
    }).join('')}
  </div>

  ${highlightsSection(highlights)}

  ${monthlySection(monthly)}

  <!-- ── TABELA COMPARATIVA (só para grupos) ── -->
  ${showTable ? `
  <div class="section ${members.length > 6 ? 'page-break' : ''}">
    <div class="section-title">Desempenho Individual — Período</div>
    <table>
      <thead>
        <tr>
          <th class="l">Pessoa</th>
          <th>Ligações</th>
          <th>Atendidas</th>
          <th>Marcações</th>
          <th>Visitas</th>
          <th>Matrículas</th>
          <th>Matr. de marcações</th>
          <th>Não apareceu</th>
          <th>Cancelou</th>
          <th>Conv. V→M</th>
        </tr>
      </thead>
      <tbody>
        ${ranked.map((m, i) => memberRow(m, i, podium.includes(m.id))).join('')}
        <tr class="total-row">
          <td class="l">∑ Total</td>
          <td>${totals.calls}</td>
          <td class="c-teal">${totals.answered}</td>
          <td>${totals.marcacoes}</td>
          <td>${totals.visitas}</td>
          <td class="c-green">${totals.matriculas}</td>
          <td class="c-gold">${totals.creditos}</td>
          <td>${totals.noShow}</td>
          <td>${totals.canceled}</td>
          <td>${fmtPct(totals.convVE)}</td>
        </tr>
      </tbody>
    </table>
  </div>` : ''}

  <!-- ── TREINAMENTOS + ORIGENS ── -->
  <div class="section keep">
    <div class="section-title">Composição das Matrículas</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:30px">
      <div>${trainingsSection(totalTrainings)}</div>
      <div>${originsSection(totalOrigins)}</div>
    </div>
  </div>

  ${enrolledSection(membersWithMetrics)}

  <!-- ── CARDS INDIVIDUAIS (para grupos) ── -->
  ${showTable ? `
  <div class="section page-break">
    <div class="section-title">Detalhe Individual — Acumulado</div>
    <div class="ind-grid">
      ${ranked.map(m => `
        <div class="ind keep">
          <div class="ind-head">
            <div>
              <div class="n">${esc(m.name)}</div>
              <div class="r">${ROLE_LABELS[m.role] || m.role}</div>
            </div>
            <div class="v">${m.matriculas}</div>
          </div>
          <div class="ind-body">
            <div><div class="num" style="color:#2563EB">${m.marcacoes}</div><div class="cap">marcações</div></div>
            <div><div class="num" style="color:#7C3AED">${m.visitas}</div><div class="cap">visitas</div></div>
            <div><div class="num" style="color:${m.convVE >= 40 ? '#15803D' : '#B45309'}">${fmtPct(m.convVE)}</div><div class="cap">conv.</div></div>
          </div>
          ${m.noShow > 0 || m.canceled > 0 ? `
          <div class="ind-foot">
            ${m.noShow   > 0 ? `<span>🚫 ${m.noShow} não apareceu</span>` : ''}
            ${m.canceled > 0 ? `<span>📵 ${m.canceled} cancelou</span>` : ''}
          </div>` : ''}
        </div>`).join('')}
    </div>
  </div>` : ''}

  <div class="footer">
    Vithall CRM · ${periodLabel} · gerado em ${now}
  </div>

</div>

<button class="no-print print-btn" onclick="window.print()">
  🖨 Imprimir / Salvar PDF
</button>

</body>
</html>`
}

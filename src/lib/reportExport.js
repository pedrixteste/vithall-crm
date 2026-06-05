// Gerador de relatório HTML para impressão/PDF
// Abre em nova aba — File > Print > Salvar como PDF

const TRAINING_COLORS = {
  'Impacto': '#E85555', 'Perfil': '#E8834A', 'Vendas': '#C9A84C',
  'LORAPE': '#4ADE80', 'Academia Vithall': '#60A5FA', 'Mentoria': '#A78BFA',
}
const TRAININGS = ['Impacto', 'Perfil', 'Vendas', 'LORAPE', 'Academia Vithall', 'Mentoria']
const ORIGINS = [
  { key: 'frias contatinhos', label: 'Frias contatinhos' },
  { key: 'frias listas',      label: 'Frias listas' },
  { key: 'lead campanha',     label: 'Lead campanha' },
  { key: 'lead organico',    label: 'Lead orgânico' },
  { key: 'feiras',            label: 'Feiras' },
  { key: 'indicacao',         label: 'Indicação' },
]
const ROLE_LABELS = { pre_vendas: 'Pré-vendas', vendedor: 'Vendedor', gerente: 'Gerente' }

function pct(a, b) { return b > 0 ? Math.round((a / b) * 100) : null }
function fmt(n)    { return n ?? '—' }
function fmtPct(n) { return n != null ? `${n}%` : '—' }

/** Calcula métricas de um conjunto de clientes/logs */
function calcMetrics(memberClients, logs, periodStart) {
  const inPeriod   = memberClients.filter(c => new Date(c.created_at) >= periodStart)
  const visits     = memberClients.flatMap(c =>
    (c.visits || []).filter(v => new Date(v.visit_date + 'T12:00:00') >= periodStart))
  const allEnrolled = memberClients.filter(c => c.matricula_stage === 'matriculado')
  const enrolled   = inPeriod.filter(c => c.matricula_stage === 'matriculado')
  const noShow     = inPeriod.filter(c => c.matricula_stage === 'nao_apareceu')
  const canceled   = inPeriod.filter(c => c.matricula_stage === 'cancelado')
  const calls      = logs
    .filter(l => new Date(l.log_date + 'T12:00:00') >= periodStart)
    .reduce((s, l) => s + (l.calls || 0), 0)

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
    convMV:     pct(visits.length, inPeriod.length),
    convVE:     pct(enrolled.length, visits.length),
    trainings,
    origins,
    totalEnrolled: allEnrolled.length,
  }
}

/** Monta linha de pessoa para a tabela comparativa */
function memberRow(m, bg) {
  const conv = fmtPct(m.convVE)
  return `
    <tr style="background:${bg}">
      <td style="padding:10px 14px;font-weight:600;color:#111;border-bottom:1px solid #E8E8E8">
        ${m.name}<br>
        <span style="font-size:10px;font-weight:400;color:#888;text-transform:uppercase;letter-spacing:.06em">${ROLE_LABELS[m.role] || m.role}</span>
      </td>
      <td style="padding:10px 14px;text-align:center;color:#555;border-bottom:1px solid #E8E8E8">${fmt(m.calls || 0)}</td>
      <td style="padding:10px 14px;text-align:center;color:#555;border-bottom:1px solid #E8E8E8">${fmt(m.marcacoes)}</td>
      <td style="padding:10px 14px;text-align:center;color:#555;border-bottom:1px solid #E8E8E8">${fmt(m.visitas)}</td>
      <td style="padding:10px 14px;text-align:center;font-weight:700;color:#1A7F4B;border-bottom:1px solid #E8E8E8">${fmt(m.matriculas)}</td>
      <td style="padding:10px 14px;text-align:center;color:#C0392B;border-bottom:1px solid #E8E8E8">${fmt(m.noShow)}</td>
      <td style="padding:10px 14px;text-align:center;color:#E67E22;border-bottom:1px solid #E8E8E8">${fmt(m.canceled)}</td>
      <td style="padding:10px 14px;text-align:center;font-weight:700;color:${m.convVE >= 50 ? '#1A7F4B' : m.convVE >= 25 ? '#E67E22' : '#C0392B'};border-bottom:1px solid #E8E8E8">${conv}</td>
    </tr>`
}

/** Bloco de métricas resumo */
function metricCard(label, value, sub, color) {
  return `
    <div style="background:#fff;border:1px solid #E8E8E8;border-radius:12px;padding:18px 20px;border-top:3px solid ${color}">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#999;margin-bottom:6px">${label}</div>
      <div style="font-size:32px;font-weight:800;color:#111;letter-spacing:-1px;line-height:1">${value}</div>
      ${sub ? `<div style="font-size:11px;color:#888;margin-top:5px">${sub}</div>` : ''}
    </div>`
}

/** Barra de progresso CSS */
function bar(count, max, color) {
  const w = max > 0 ? Math.round((count / max) * 100) : 0
  return `<div style="height:6px;border-radius:99px;background:#F0F0F0;margin-top:6px">
    <div style="width:${w}%;height:100%;border-radius:99px;background:${color}"></div>
  </div>`
}

/** Seção de treinamentos */
function trainingsSection(trainings) {
  const max = Math.max(...trainings.map(t => t.count), 1)
  return `
    <div style="margin-top:32px">
      <h3 style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:#999;margin:0 0 14px">Matrículas por Treinamento</h3>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        ${trainings.map(t => `
          <div style="padding:12px 14px;border:1px solid #E8E8E8;border-radius:10px;background:#FAFAFA">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <span style="font-size:12px;font-weight:600;color:#333">${t.label}</span>
              <span style="font-size:18px;font-weight:800;color:${TRAINING_COLORS[t.label] || '#333'}">${t.count}</span>
            </div>
            ${bar(t.count, max, TRAINING_COLORS[t.label] || '#999')}
          </div>`).join('')}
      </div>
    </div>`
}

/** Seção de origens */
function originsSection(origins) {
  const max = Math.max(...origins.map(o => o.count), 1)
  return `
    <div style="margin-top:28px">
      <h3 style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:#999;margin:0 0 14px">Origem das Matrículas</h3>
      <div style="display:flex;flex-direction:column;gap:8px">
        ${origins.map(o => `
          <div style="display:flex;align-items:center;gap:12px">
            <div style="width:110px;font-size:11px;font-weight:600;color:#666;flex-shrink:0">${o.label}</div>
            <div style="flex:1;height:8px;border-radius:99px;background:#F0F0F0">
              <div style="width:${max > 0 ? Math.round((o.count/max)*100) : 0}%;height:100%;border-radius:99px;background:#C9A84C"></div>
            </div>
            <div style="width:24px;text-align:right;font-size:12px;font-weight:700;color:#333">${o.count}</div>
          </div>`).join('')}
      </div>
    </div>`
}

/** Gera o HTML completo do relatório */
export function generateReportHTML({
  scope,        // 'individual' | 'pre_vendas' | 'vendedores' | 'all'
  members,      // array de { ...profile, memberClients, logs }
  periodDays,
  periodStart,
  periodLabel,
  exportedBy,
}) {
  const now = new Date().toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })

  const scopeLabel = {
    individual:  `Individual — ${members[0]?.name}`,
    pre_vendas:  'Equipe de Pré-Vendas',
    vendedores:  'Equipe de Vendedores',
    all:         'Equipe Completa',
  }[scope] || scope

  // Calcula métricas por membro
  const membersWithMetrics = members.map(m => ({
    ...m,
    ...calcMetrics(m.memberClients, m.logs, periodStart),
  }))

  // Total geral (soma de todos)
  const totals = {
    name: scope === 'individual' ? membersWithMetrics[0]?.name : 'Total da equipe',
    role: membersWithMetrics[0]?.role,
    calls:      membersWithMetrics.reduce((s, m) => s + (m.calls || 0), 0),
    marcacoes:  membersWithMetrics.reduce((s, m) => s + m.marcacoes, 0),
    visitas:    membersWithMetrics.reduce((s, m) => s + m.visitas, 0),
    matriculas: membersWithMetrics.reduce((s, m) => s + m.matriculas, 0),
    noShow:     membersWithMetrics.reduce((s, m) => s + m.noShow, 0),
    canceled:   membersWithMetrics.reduce((s, m) => s + m.canceled, 0),
  }
  totals.convMV  = pct(totals.visitas, totals.marcacoes)
  totals.convVE  = pct(totals.matriculas, totals.visitas)

  // Trainings e origins do total
  const totalTrainings = TRAININGS.map((t, i) => ({
    label: t,
    count: membersWithMetrics.reduce((s, m) => s + (m.trainings?.[i]?.count || 0), 0),
  }))
  const totalOrigins = ORIGINS.map((o, i) => ({
    label: o.label,
    count: membersWithMetrics.reduce((s, m) => s + (m.origins?.[i]?.count || 0), 0),
  }))

  const showTable = members.length > 1

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Relatório Vithall CRM — ${periodLabel}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, 'Segoe UI', sans-serif; background: #F5F5F5; color: #111; }
  @page { margin: 16mm 12mm; size: A4; }
  @media print {
    body { background: #fff; }
    .no-print { display: none !important; }
    .page-break { page-break-before: always; }
    .card-grid { grid-template-columns: repeat(4, 1fr) !important; }
    .section { box-shadow: none !important; }
  }
  .wrap { max-width: 860px; margin: 0 auto; padding: 0 0 48px; }
  .header {
    background: linear-gradient(135deg, #0A0A0A 0%, #1A1210 100%);
    padding: 36px 48px 32px;
    margin-bottom: 28px;
    position: relative;
  }
  .header-top { display: flex; justify-content: space-between; align-items: flex-start; }
  .brand { display: flex; align-items: center; gap: 12px; }
  .brand-logo {
    width: 42px; height: 42px; border-radius: 12px;
    background: linear-gradient(135deg, #7B1C3A, #C9A84C);
    display: flex; align-items: center; justify-content: center;
    font-size: 18px; font-weight: 800; color: #F0EAD6;
  }
  .brand-name { font-size: 13px; font-weight: 700; color: #C9A84C; letter-spacing: .08em; text-transform: uppercase; }
  .brand-sub  { font-size: 11px; color: #555; margin-top: 2px; }
  .header-meta { text-align: right; }
  .header-meta .period { font-size: 12px; color: #888; }
  .header-meta .date   { font-size: 11px; color: #555; margin-top: 4px; }
  .header h1 { font-size: 28px; font-weight: 800; color: #EFEFEF; margin-top: 24px; letter-spacing: -.5px; }
  .header .scope {
    display: inline-block; margin-top: 8px; padding: 4px 14px;
    border-radius: 99px; background: rgba(201,168,76,.12);
    border: 1px solid rgba(201,168,76,.3); color: #C9A84C;
    font-size: 12px; font-weight: 600;
  }
  .section { background: #fff; border-radius: 16px; box-shadow: 0 1px 4px rgba(0,0,0,.06); padding: 28px 32px; margin: 0 16px 20px; }
  .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .14em; color: #999; margin-bottom: 18px; }
  .card-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
  .funnel-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
  .funnel-label { font-size: 12px; color: #888; width: 90px; flex-shrink: 0; }
  .funnel-bar-wrap { flex: 1; height: 20px; background: #F5F5F5; border-radius: 6px; overflow: hidden; }
  .funnel-bar { height: 100%; border-radius: 6px; display: flex; align-items: center; padding-left: 8px; }
  .funnel-val { font-size: 12px; font-weight: 700; color: #111; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  thead th {
    padding: 10px 14px; text-align: center; font-size: 10px;
    font-weight: 700; text-transform: uppercase; letter-spacing: .08em;
    color: #999; background: #F8F8F8; border-bottom: 2px solid #EFEFEF;
  }
  thead th:first-child { text-align: left; }
  .total-row td { background: #FFFBF0 !important; font-weight: 700; border-top: 2px solid #E8D87A !important; }
  .print-btn {
    position: fixed; bottom: 24px; right: 24px;
    padding: 14px 28px; background: linear-gradient(135deg, #7B1C3A, #C9A84C);
    color: #F0EAD6; font-weight: 700; font-size: 14px; border-radius: 14px;
    cursor: pointer; border: none; box-shadow: 0 4px 20px rgba(201,168,76,.35);
    display: flex; align-items: center; gap: 8px;
  }
  .divider { height: 1px; background: #F0F0F0; margin: 24px 0; }
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
          <div class="brand-sub">CRM — Relatório de Desempenho</div>
        </div>
      </div>
      <div class="header-meta">
        <div class="period">Período: <strong style="color:#C9A84C">${periodLabel}</strong></div>
        <div class="date">Gerado em ${now}</div>
        <div class="date" style="margin-top:2px">por ${exportedBy}</div>
      </div>
    </div>
    <h1>Relatório de Desempenho</h1>
    <div class="scope">${scopeLabel}</div>
  </div>

  <!-- ── MÉTRICAS GERAIS ── -->
  <div class="section">
    <div class="section-title">Resumo do Período</div>
    <div class="card-grid">
      ${metricCard('Ligações',  fmt(totals.calls),      null,                              '#E8834A')}
      ${metricCard('Marcações', fmt(totals.marcacoes),  null,                              '#60A5FA')}
      ${metricCard('Visitas',   fmt(totals.visitas),    `${fmtPct(totals.convMV)} das marcações`, '#A78BFA')}
      ${metricCard('Matrículas',fmt(totals.matriculas), `${fmtPct(totals.convVE)} das visitas`,   '#4ADE80')}
    </div>

    <!-- Alertas -->
    ${totals.noShow > 0 || totals.canceled > 0 ? `
    <div style="display:flex;gap:12px;margin-top:16px">
      ${totals.noShow > 0 ? `
      <div style="padding:10px 16px;border-radius:10px;background:#FEF2F2;border:1px solid #FECACA;font-size:12px;color:#991B1B">
        🚫 <strong>${totals.noShow}</strong> não apareceu${totals.noShow > 1 ? 'ram' : ''}
      </div>` : ''}
      ${totals.canceled > 0 ? `
      <div style="padding:10px 16px;border-radius:10px;background:#FFF7ED;border:1px solid #FED7AA;font-size:12px;color:#92400E">
        📵 <strong>${totals.canceled}</strong> cancelou${totals.canceled > 1 ? 'ram' : ''}
      </div>` : ''}
    </div>` : ''}

    <!-- Funil visual -->
    <div class="divider"></div>
    <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:#999;margin-bottom:14px">Funil de Conversão</div>
    ${[
      { label: 'Ligações',  val: totals.calls,      color: '#E8834A' },
      { label: 'Marcações', val: totals.marcacoes,  color: '#60A5FA' },
      { label: 'Visitas',   val: totals.visitas,    color: '#A78BFA' },
      { label: 'Matrículas',val: totals.matriculas, color: '#4ADE80' },
    ].map(f => {
      const maxVal = Math.max(totals.calls || 0, totals.marcacoes, totals.visitas, totals.matriculas, 1)
      const w = Math.round((f.val / maxVal) * 100)
      return `<div class="funnel-row">
        <div class="funnel-label">${f.label}</div>
        <div class="funnel-bar-wrap">
          <div class="funnel-bar" style="width:${w}%;background:${f.color}22">
            <span style="font-size:12px;font-weight:700;color:${f.color}">${f.val}</span>
          </div>
        </div>
      </div>`
    }).join('')}
  </div>

  <!-- ── TABELA COMPARATIVA (só para grupos) ── -->
  ${showTable ? `
  <div class="section ${members.length > 6 ? 'page-break' : ''}">
    <div class="section-title">Desempenho Individual — Período</div>
    <table>
      <thead>
        <tr>
          <th style="text-align:left">Pessoa</th>
          <th>Ligações</th>
          <th>Marcações</th>
          <th>Visitas</th>
          <th>Matrículas</th>
          <th>Não apareceu</th>
          <th>Cancelamentos</th>
          <th>Conv. V→M</th>
        </tr>
      </thead>
      <tbody>
        ${membersWithMetrics
          .sort((a, b) => b.matriculas - a.matriculas)
          .map((m, i) => memberRow(m, i % 2 === 0 ? '#fff' : '#FAFAFA'))
          .join('')}
        <tr class="total-row">
          <td style="padding:10px 14px;font-weight:800;color:#111;font-size:13px">
            ∑ Total
          </td>
          <td style="padding:10px 14px;text-align:center;font-weight:800">${totals.calls}</td>
          <td style="padding:10px 14px;text-align:center;font-weight:800">${totals.marcacoes}</td>
          <td style="padding:10px 14px;text-align:center;font-weight:800">${totals.visitas}</td>
          <td style="padding:10px 14px;text-align:center;font-weight:800;color:#1A7F4B">${totals.matriculas}</td>
          <td style="padding:10px 14px;text-align:center;font-weight:800;color:#C0392B">${totals.noShow}</td>
          <td style="padding:10px 14px;text-align:center;font-weight:800;color:#E67E22">${totals.canceled}</td>
          <td style="padding:10px 14px;text-align:center;font-weight:800">${fmtPct(totals.convVE)}</td>
        </tr>
      </tbody>
    </table>
  </div>` : ''}

  <!-- ── TREINAMENTOS + ORIGENS ── -->
  <div class="section">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:32px">
      <div>
        ${trainingsSection(totalTrainings)}
      </div>
      <div>
        ${originsSection(totalOrigins)}
      </div>
    </div>
  </div>

  <!-- ── INDIVIDUAL CARDS (para grupos) ── -->
  ${showTable ? `
  <div class="section page-break">
    <div class="section-title">Detalhe Individual — All Time</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
      ${membersWithMetrics.map(m => `
        <div style="border:1px solid #E8E8E8;border-radius:12px;overflow:hidden">
          <div style="padding:14px 16px;background:#F8F8F8;border-bottom:1px solid #E8E8E8;display:flex;justify-content:space-between;align-items:center">
            <div>
              <div style="font-weight:700;font-size:14px;color:#111">${m.name}</div>
              <div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:.06em;margin-top:2px">${ROLE_LABELS[m.role] || m.role}</div>
            </div>
            <div style="font-size:22px;font-weight:800;color:#1A7F4B">${m.matriculas}</div>
          </div>
          <div style="padding:12px 16px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;text-align:center">
            <div><div style="font-size:18px;font-weight:700;color:#60A5FA">${m.marcacoes}</div><div style="font-size:9px;color:#999;text-transform:uppercase">marcações</div></div>
            <div><div style="font-size:18px;font-weight:700;color:#A78BFA">${m.visitas}</div><div style="font-size:9px;color:#999;text-transform:uppercase">visitas</div></div>
            <div><div style="font-size:18px;font-weight:700;color:#${m.convVE >= 40 ? '1A7F4B' : 'E67E22'}">${fmtPct(m.convVE)}</div><div style="font-size:9px;color:#999;text-transform:uppercase">conv.</div></div>
          </div>
          ${m.noShow > 0 || m.canceled > 0 ? `
          <div style="padding:8px 16px;background:#FEF9F0;border-top:1px solid #F0E8D0;font-size:11px;color:#888;display:flex;gap:12px">
            ${m.noShow   > 0 ? `<span>🚫 ${m.noShow} não apareceu</span>` : ''}
            ${m.canceled > 0 ? `<span>📵 ${m.canceled} cancelou</span>` : ''}
          </div>` : ''}
        </div>`).join('')}
    </div>
  </div>` : ''}

  <!-- ── FOOTER ── -->
  <div style="text-align:center;padding:0 16px 8px;font-size:10px;color:#CCC">
    Vithall CRM · Relatório gerado em ${now} · ${periodLabel}
  </div>

</div>

<!-- Botão imprimir (some ao imprimir) -->
<button class="no-print print-btn" onclick="window.print()">
  🖨 Imprimir / Salvar PDF
</button>

</body>
</html>`
}

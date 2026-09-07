// Datas do cliente — regras puras, sem React nem banco.
//
//   • Aniversário de idade: `aniversario_dia` + `aniversario_mes`, com
//     `nascimento_ano` opcional (quando tem ano, mostra a idade).
//   • Aniversário Vithall: `aniversario_vithall` (data da primeira matrícula/
//     treinamento). Todo ano, no mesmo dia, "faz X anos de Vithall".
//   • Datas especiais: feriados e dias comemorativos, lista fixa aqui.
//
// Datas viajam como texto 'YYYY-MM-DD' (dia local, como `localDateStr`).
// Testes: scripts/teste-aniversarios.mjs

export const COR_DATA = {
  aniversario: '#F472B6', // rosa
  vithall:     '#C9A84C', // dourado (a cor do app)
  especial:    '#60A5FA', // azul
}

export const ICONE_DATA = { aniversario: '🎂', vithall: '🎓', especial: '📌' }

const DIAS_NO_MES = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho',
  'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const DIAS_SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']

export const NOME_MES = (mes) => MESES[mes - 1] || ''

const bissexto = (ano) => (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0
const pad = (n) => String(n).padStart(2, '0')
const dataStr = (ano, mes, dia) => `${ano}-${pad(mes)}-${pad(dia)}`
const partes = (s) => s.split('-').map(Number) // [ano, mes, dia]

export function somaDias(s, n) {
  const [a, m, d] = partes(s)
  const x = new Date(a, m - 1, d + n, 12)
  return dataStr(x.getFullYear(), x.getMonth() + 1, x.getDate())
}

function diaSemana(s) {
  const [a, m, d] = partes(s)
  return new Date(a, m - 1, d, 12).getDay()
}

// ── Aniversário de idade ────────────────────────────────────────────

// "15/03" ou "15/03/1980" → { ok, dia, mes, ano }. Vazio limpa (ok com nulos);
// texto que não é data devolve { ok: false }.
export function parseAniversario(texto) {
  const t = (texto || '').trim()
  if (!t) return { ok: true, dia: null, mes: null, ano: null }
  const m = t.match(/^(\d{1,2})\s*[\/.-]\s*(\d{1,2})(?:\s*[\/.-]\s*(\d{2}|\d{4}))?$/)
  if (!m) return { ok: false }
  const dia = Number(m[1]), mes = Number(m[2])
  let ano = m[3] ? Number(m[3]) : null
  if (ano !== null && m[3].length === 2) ano += ano <= 30 ? 2000 : 1900
  if (mes < 1 || mes > 12 || dia < 1 || dia > DIAS_NO_MES[mes - 1]) return { ok: false }
  if (ano !== null && (ano < 1900 || ano > 2100)) return { ok: false }
  if (ano !== null && dia === 29 && mes === 2 && !bissexto(ano)) return { ok: false }
  return { ok: true, dia, mes, ano }
}

export function formataAniversario(c) {
  if (!c?.aniversario_dia || !c?.aniversario_mes) return ''
  const base = `${pad(c.aniversario_dia)}/${pad(c.aniversario_mes)}`
  return c.nascimento_ano ? `${base}/${c.nascimento_ano}` : base
}

// Idade que a pessoa faz/tem no dia `s` (null sem ano de nascimento).
export function idadeEm(c, s) {
  if (!c?.nascimento_ano || !c.aniversario_mes) return null
  const [a, m, d] = partes(s)
  const antes = m < c.aniversario_mes || (m === c.aniversario_mes && d < c.aniversario_dia)
  return a - c.nascimento_ano - (antes ? 1 : 0)
}

// Nascido em 29/02 comemora em 28/02 nos anos sem o dia 29.
export function ehAniversarioEm(c, s) {
  if (!c?.aniversario_dia || !c?.aniversario_mes) return false
  const [a, m, d] = partes(s)
  if (c.aniversario_mes !== m) return false
  if (c.aniversario_dia === d) return true
  return c.aniversario_dia === 29 && m === 2 && d === 28 && !bissexto(a)
}

// ── Aniversário Vithall ─────────────────────────────────────────────

export function anosVithallEm(c, s) {
  if (!c?.aniversario_vithall) return null
  const [a0] = partes(c.aniversario_vithall)
  return partes(s)[0] - a0
}

export function ehVithallEm(c, s) {
  if (!c?.aniversario_vithall) return false
  const [a0, m0, d0] = partes(c.aniversario_vithall)
  const [a, m, d] = partes(s)
  if (a <= a0 || m !== m0) return false // no ano da matrícula ainda não é aniversário
  if (d === d0) return true
  return d0 === 29 && m === 2 && d === 28 && !bissexto(a)
}

// ── Datas especiais (feriados e dias comemorativos) ─────────────────

function pascoa(ano) {
  const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const mes = Math.floor((h + l - 7 * m + 114) / 31)
  const dia = ((h + l - 7 * m + 114) % 31) + 1
  return dataStr(ano, mes, dia)
}

// N-ésimo domingo do mês (Dia das Mães = 2º de maio, Dia dos Pais = 2º de agosto)
function enesimoDomingo(ano, mes, n) {
  const primeiro = new Date(ano, mes - 1, 1, 12).getDay()
  const dia = 1 + ((7 - primeiro) % 7) + (n - 1) * 7
  return dataStr(ano, mes, dia)
}

// Lista aprovada pelo usuário em 06/09/2026. Só aparecem no calendário —
// não geram notificação.
const FIXAS = [
  ['01-01', 'Ano Novo'],
  ['03-08', 'Dia da Mulher'],
  ['03-15', 'Dia do Consumidor'],
  ['04-21', 'Tiradentes'],
  ['05-01', 'Dia do Trabalho'],
  ['06-03', 'Dia do RH'],
  ['06-12', 'Dia dos Namorados'],
  ['08-27', 'Dia do Corretor de Imóveis'],
  ['08-27', 'Dia do Psicólogo'],
  ['09-04', 'Dia do Empresário'],
  ['09-07', 'Independência do Brasil'],
  ['09-09', 'Dia do Administrador'],
  ['09-20', 'Revolução Farroupilha'],
  ['09-22', 'Dia do Contador'],
  ['09-30', 'Dia da Secretária'],
  ['10-01', 'Dia do Vendedor'],
  ['10-05', 'Dia do Empreendedor'],
  ['10-12', 'N. S. Aparecida / Dia das Crianças'],
  ['10-15', 'Dia do Professor'],
  ['11-02', 'Finados'],
  ['11-15', 'Proclamação da República'],
  ['11-20', 'Consciência Negra'],
  ['11-21', 'Dia do Gerente'],
  ['12-04', 'Dia do Publicitário'],
  ['12-15', 'Dia do Arquiteto'],
  ['12-25', 'Natal'],
]

export function datasEspeciais(ano) {
  const p = pascoa(ano)
  const lista = [
    ...FIXAS.map(([md, nome]) => ({ data: `${ano}-${md}`, nome })),
    { data: somaDias(p, -47), nome: 'Carnaval' },
    { data: somaDias(p, -2),  nome: 'Sexta-feira Santa' },
    { data: p,                nome: 'Páscoa' },
    { data: somaDias(p, 60),  nome: 'Corpus Christi' },
    { data: enesimoDomingo(ano, 5, 2), nome: 'Dia das Mães' },
    { data: enesimoDomingo(ano, 8, 2), nome: 'Dia dos Pais' },
  ]
  return lista.sort((x, y) => x.data.localeCompare(y.data) || x.nome.localeCompare(y.nome, 'pt-BR'))
}

// ── Janela da aba Hoje / do robô ────────────────────────────────────

// Hoje + os dias até o próximo dia útil: sexta mostra sábado, domingo e
// segunda; sábado mostra domingo e segunda; os outros dias mostram amanhã.
export function diasJanela(hoje) {
  const dow = diaSemana(hoje)
  const n = dow === 5 ? 3 : dow === 6 ? 2 : 1
  const out = []
  for (let i = 0; i <= n; i++) {
    const data = somaDias(hoje, i)
    out.push({ data, rotulo: i === 0 ? 'hoje' : i === 1 ? 'amanhã' : DIAS_SEMANA[diaSemana(data)] })
  }
  return out
}

// Um item por (cliente, tipo, dia) dentro da janela, na ordem do dia.
export function aniversariosNaJanela(clientes, hoje) {
  const out = []
  for (const { data, rotulo } of diasJanela(hoje)) {
    for (const c of clientes || []) {
      if (ehAniversarioEm(c, data)) out.push({ client: c, tipo: 'aniversario', data, rotulo, anos: idadeEm(c, data) })
      if (ehVithallEm(c, data))     out.push({ client: c, tipo: 'vithall',     data, rotulo, anos: anosVithallEm(c, data) })
    }
  }
  return out.sort((x, y) => x.data.localeCompare(y.data) || nome(x.client).localeCompare(nome(y.client), 'pt-BR'))
}

// ── Calendário mensal ───────────────────────────────────────────────

const nome = (c) => c?.contact_name || c?.company_name || '—'
const ORDEM_TIPO = { especial: 0, aniversario: 1, vithall: 2 }

// Todos os eventos do mês, ordenados por dia (feriado antes dos aniversários).
export function eventosDoMes(clientes, ano, mes) {
  const out = []
  for (const e of datasEspeciais(ano)) {
    if (Number(e.data.slice(5, 7)) === mes) out.push({ dia: Number(e.data.slice(8)), tipo: 'especial', nome: e.nome, client: null, anos: null })
  }
  const ultimo = mes === 2 && !bissexto(ano) ? 28 : DIAS_NO_MES[mes - 1]
  for (let dia = 1; dia <= ultimo; dia++) {
    const s = dataStr(ano, mes, dia)
    for (const c of clientes || []) {
      if (ehAniversarioEm(c, s)) out.push({ dia, tipo: 'aniversario', nome: nome(c), client: c, anos: idadeEm(c, s) })
      if (ehVithallEm(c, s))     out.push({ dia, tipo: 'vithall',     nome: nome(c), client: c, anos: anosVithallEm(c, s) })
    }
  }
  return out.sort((x, y) => x.dia - y.dia || ORDEM_TIPO[x.tipo] - ORDEM_TIPO[y.tipo] || x.nome.localeCompare(y.nome, 'pt-BR'))
}

// "🎂 Jonas (Empresa) · 41 anos" / "🎓 Maria · 2 anos de Vithall" / "Dia das Mães"
export function rotuloEvento(ev) {
  if (ev.tipo === 'especial') return ev.nome
  const c = ev.client
  const quem = c?.contact_name && c?.company_name && c.contact_name !== c.company_name
    ? `${c.contact_name} (${c.company_name})` : nome(c)
  if (ev.tipo === 'vithall') return `${quem} · ${ev.anos} ${ev.anos === 1 ? 'ano' : 'anos'} de Vithall`
  return ev.anos ? `${quem} · ${ev.anos} anos` : quem
}

import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

// Só os dígitos de um telefone — comparação de repetição ignora formatação
// ("(51) 99754-5182" e "51997545182" são o MESMO contato). Chaves com menos
// de 8 dígitos são descartadas pelo chamador (evita lixo de dados de teste).
export const phoneDigits = (p) => (p || '').replace(/\D/g, '')

// Teto de telefones por cadastro (o principal + os adicionais). É regra de
// TELA, não do banco — a coluna `phones` é uma lista, então mudar este número
// muda o app inteiro sem migração.
export const MAX_PHONES = 4

// Todos os telefones de um cliente/callback como [{ n, t }], já na ordem em
// que devem aparecer: o principal primeiro, depois os adicionais de `phones`.
// Cobre o `phone2` antigo caso algum registro não tenha sido migrado.
export function allPhones(c) {
  if (!c) return []
  const out = []
  if (c.phone) out.push({ n: c.phone, t: c.phone_type || 'pessoal' })
  for (const p of Array.isArray(c.phones) ? c.phones : []) {
    if (p?.n) out.push({ n: p.n, t: p.t || 'pessoal' })
  }
  if (c.phone2 && !out.some(x => phoneDigits(x.n) === phoneDigits(c.phone2))) {
    out.push({ n: c.phone2, t: c.phone_type === 'empresa' ? 'pessoal' : 'empresa' })
  }
  return out
}

/** Dígitos de todos os telefones — para busca e comparação de repetidos. */
export const allPhoneDigits = (c) =>
  allPhones(c).map(p => phoneDigits(p.n)).filter(d => d.length >= 8)

// Lista de datas 'YYYY-MM-DD' de um reminder_config do tipo specific_date.
// Compatível com o formato ANTIGO (uma só `date`, que podia ser ISO com hora).
export function reminderDates(cfg) {
  if (!cfg) return []
  if (Array.isArray(cfg.dates)) return cfg.dates.filter(Boolean)
  if (cfg.date) return [String(cfg.date).slice(0, 10)]
  return []
}

// Dias da semana — mesma convenção do reminder_config de clients/callbacks
export const DOW_KEYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab']
const DOW_LABELS = { dom: 'Dom', seg: 'Seg', ter: 'Ter', qua: 'Qua', qui: 'Qui', sex: 'Sex', sab: 'Sáb' }
const UTEIS = ['seg', 'ter', 'qua', 'qui', 'sex']

// ── Tarefas soltas ──────────────────────────────────────────────────
// `due_time` é sempre a HORA do lembrete. O que muda é o PADRÃO: sem
// reminder_config a tarefa é de uma data só (due_date); com ele, repete.
// O `last_done` mora dentro do próprio reminder_config de propósito — a
// coluna já existia, então repetição não precisou de migração.

export const taskIsRecurring = (t) =>
  t?.reminder_config?.type === 'daily' || t?.reminder_config?.type === 'weekly'

/** A tarefa cai HOJE? Data única também conta quando já venceu. */
export function taskDueToday(t, ref = new Date()) {
  const cfg = t?.reminder_config
  if (cfg?.type === 'daily')  return true
  if (cfg?.type === 'weekly') return (cfg.days || []).includes(DOW_KEYS[ref.getDay()])
  return !!t?.due_date && t.due_date <= localDateStr(ref)
}

/** Tarefa que repete e já foi resolvida hoje — o ✓ dela vale só para o dia. */
export const taskDoneToday = (t, ref = new Date()) =>
  !!t?.reminder_config?.last_done && t.reminder_config.last_done === localDateStr(ref)

/** Rótulo curto da repetição para os cards ("Todo dia", "Seg, Qua"). */
export function taskRecurrenceLabel(t) {
  const cfg = t?.reminder_config
  if (cfg?.type === 'daily') return 'Todo dia'
  if (cfg?.type === 'weekly') {
    const ds = cfg.days || []
    if (!ds.length) return 'Toda semana'
    if (ds.length === 5 && UTEIS.every(d => ds.includes(d))) return 'Dias úteis'
    return DOW_KEYS.filter(k => ds.includes(k)).map(k => DOW_LABELS[k]).join(', ')
  }
  return null
}

// Cor da urgência de uma tarefa (0-10): verde → dourado → vermelho.
export function urgencyColor(u) {
  if (u === null || u === undefined) return '#6B6560'
  if (u >= 8) return '#E85555'
  if (u >= 5) return '#E8834A'
  if (u >= 3) return '#C9A84C'
  return '#4ADE80'
}

// Data LOCAL no formato YYYY-MM-DD. NÃO usar toISOString() para isso: ele
// converte p/ UTC e, entre 21h e meia-noite (Brasil), cai no dia seguinte.
export function localDateStr(d = new Date()) {
  const x = new Date(d)
  const y = x.getFullYear()
  const m = String(x.getMonth() + 1).padStart(2, '0')
  const dd = String(x.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

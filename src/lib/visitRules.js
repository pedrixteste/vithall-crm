// ── Regras da visita, sem banco ─────────────────────────────────────
// Só decisão pura: recebe dados, devolve resposta. Fica separado de
// visitBooking.js (que grava no Supabase) para poder ser testado direto no
// Node — `node scripts/teste-remarcacao.mjs` roda tudo isto sem login,
// sem internet e sem tocar em cliente nenhum.

// Carimbo de QUANDO a marcação foi feita — não confundir com
// `visit_scheduled_at`, que é quando a VISITA acontece. Antes disso, remarcar
// sobrescrevia a data e a marcação original não deixava rastro nenhum.
//
// `visit_first_booked_at` nunca muda depois da primeira; `visit_booked_at`
// acompanha a marcação atual; a contagem só sobe quando é remarcação de
// verdade (já existia uma data antes).
export function bookingStamp(client, { isReschedule } = {}) {
  const now = new Date().toISOString()
  return {
    visit_booked_at:        now,
    visit_first_booked_at:  client?.visit_first_booked_at || now,
    visit_reschedule_count: (client?.visit_reschedule_count || 0) + (isReschedule ? 1 : 0),
  }
}

const shortDate = (v) => new Date(v).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })

// "Marcação feita em 18/07 · remarcada em 21/07 (2ª vez)".
// Vazio para registros sem carimbo (marcados antes desta versão).
// A data ANTERIOR da visita não entra aqui: ela só existe no histórico da
// ficha, e buscar isso por card custaria uma consulta a cada linha.
export function bookingLabel(c) {
  if (!c?.visit_first_booked_at) return ''
  const first = `Marcação feita em ${shortDate(c.visit_first_booked_at)}`
  const count = c.visit_reschedule_count || 0
  if (!count || !c.visit_booked_at) return first
  const vezes = count > 1 ? ` (${count}ª vez)` : ''
  return `${first} · remarcada em ${shortDate(c.visit_booked_at)}${vezes}`
}

// Estágios em que a visita já caiu e remarcar faz sentido de cara
export const REMARCAVEL = ['cancelado', 'nao_apareceu']

/**
 * Dá para remarcar a visita deste cliente agora? Devolve { pode, motivo } —
 * `motivo` é o texto cinza que explica o "ainda não".
 * Três portas abrem: o cliente cancelou, o cliente não apareceu, ou a data da
 * visita passou e ninguém registrou o que houve (o caso que ficava encalhado).
 */
export function podeRemarcar(client, agora = new Date()) {
  const stage = client?.matricula_stage
  if (REMARCAVEL.includes(stage))  return { pode: true, motivo: null }
  if (stage === 'matriculado')     return { pode: false, motivo: 'Cliente já matriculado.' }
  if (stage === 'recebeu_visita')  return { pode: false, motivo: 'A visita já aconteceu.' }
  if (!client?.visit_scheduled_at) return { pode: false, motivo: 'Este cliente ainda não tem visita marcada.' }

  if (new Date(client.visit_scheduled_at) < agora) return { pode: true, motivo: null } // passou sem registro
  return {
    pode: false,
    motivo: 'A visita ainda está marcada — só libera se for cancelada, o cliente não aparecer, ou a data passar sem registro.',
  }
}

// Quem MARCOU esta visita, para efeito de comissão. Desde 04/09/26 a
// remarcação divide: quem marcou na origem não perde o crédito, e quem
// remarcou entra junto. Sem remarcação, é uma pessoa só — igual a sempre.
//   marcou   = visit_first_booked_by (fallback created_by, que neste CRM é
//              quem marcou: "quem cadastra é quem marcou")
//   remarcou = visit_scheduled_by, quando é gente diferente
export function bookersDaMatricula(client) {
  const origem = client?.visit_first_booked_by || client?.created_by
  const atual  = client?.visit_scheduled_by    || client?.created_by
  const out = []
  if (origem) out.push({ id: origem, role: 'marcou' })
  if (atual && atual !== origem) out.push({ id: atual, role: 'remarcou' })
  return out
}

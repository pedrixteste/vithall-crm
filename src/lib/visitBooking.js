import { supabase } from './supabase'

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

// Rastro completo na ficha: um evento por marcação/remarcação, guardando a data
// que saiu e a que entrou. As colunas só sabem a primeira e a atual — é isto
// que responde "quantas vezes remarcou e em que datas".
export async function logVisitScheduled({ clientId, userId, userName, from, to }) {
  if (!clientId || !to) return
  await supabase.from('client_history').insert({
    client_id:  clientId,
    user_id:    userId,
    user_name:  userName || null,
    event_type: 'visit_scheduled',
    event_data: { from: from || null, to },
  })
}

import { supabase } from './supabase'
// As regras puras (sem banco) moram em visitRules.js para poderem ser testadas
// no Node. Reexportadas aqui: quem já importava daqui não precisa mudar nada.
import { bookingStamp } from './visitRules'
export { bookingStamp, bookingLabel, podeRemarcar, REMARCAVEL } from './visitRules'

// Rastro completo na ficha: um evento por marcação/remarcação, guardando a data
// que saiu e a que entrou. As colunas só sabem a primeira e a atual — é isto
// que responde "quantas vezes remarcou e em que datas".
//
// ⚠️ TODO caminho que muda a data da visita passa por aqui — são cinco
// (formulário, estágio "Marcado", "Remarcou" da confirmação, retorno da
// estrela e o botão Remarcar). O relatório conta ESTES eventos, não o estágio:
// é o único jeito de nenhuma remarcação escapar da conta.
export async function logVisitScheduled({ clientId, userId, userName, from, to, extra = null }) {
  if (!clientId || !to) return
  await supabase.from('client_history').insert({
    client_id:  clientId,
    user_id:    userId,
    user_name:  userName || null,
    event_type: 'visit_scheduled',
    event_data: { from: from || null, to, ...(extra || {}) },
  })
}

// Quem fez a PRIMEIRA marcação deste cliente. A coluna só existe desde
// 04/09/26; nos clientes antigos a resposta está no primeiro evento do
// histórico, e o último recurso é quem cadastrou.
export async function primeiroMarcador(client) {
  if (client?.visit_first_booked_by) return client.visit_first_booked_by
  const { data } = await supabase.from('client_history')
    .select('user_id')
    .eq('client_id', client.id)
    .eq('event_type', 'visit_scheduled')
    .order('created_at', { ascending: true })
    .limit(1)
  return data?.[0]?.user_id || client?.created_by || null
}

/**
 * REMARCAÇÃO — o funil único. Grava o cliente, o rastro no histórico e a
 * mudança de estágio. Devolve { error, payload, oldEventId, oldIso } para a
 * tela cuidar do resto (Google Agenda, agenda de horários, aviso ao vendedor).
 *
 * O que muda e o que NÃO muda:
 *   muda   → data da visita, vendedor, estágio ('remarcado'), quem responde a
 *            confirmação (visit_scheduled_by), remarcado_por/em/motivo
 *   NÃO muda → created_by ("Marcado por" na ficha) nem quem marcou na ORIGEM
 *            (visit_first_booked_by), que divide a comissão com quem remarcou
 */
export async function remarcarVisita({
  client, userId, userName, motivo, vendedorId, novaDataIso,
  enderecoPayload = null, telefonePayload = null,
}) {
  const oldIso    = client.visit_scheduled_at ? new Date(client.visit_scheduled_at).toISOString() : null
  const oldStage  = client.matricula_stage
  const oldEventId = client.google_calendar_event_id || null
  const agora     = new Date().toISOString()
  const origem    = await primeiroMarcador(client)

  const payload = {
    matricula_stage:         'remarcado',
    visit_scheduled_at:      novaDataIso,
    visit_scheduled_by:      userId,
    visit_first_booked_by:   origem,
    assigned_to:             vendedorId || client.assigned_to || null,
    // Data nova → a resposta antiga não vale mais, senão a visita nasce
    // "já confirmada" e some da fila de quem confirma
    visit_confirmation:      null,
    visit_confirmation_note: null,
    remarcado_por:           userId,
    remarcado_em:            agora,
    remarcacao_motivo:       (motivo || '').trim() || null,
    ...bookingStamp(client, { isReschedule: true }),
    ...(enderecoPayload || {}),
    ...(telefonePayload || {}),
  }

  const { error } = await supabase.from('clients').update(payload).eq('id', client.id)
  if (error) return { error }

  const trocouEndereco = !!enderecoPayload
  const trocouTelefone = !!telefonePayload
  await logVisitScheduled({
    clientId: client.id, userId, userName, from: oldIso, to: novaDataIso,
    extra: {
      via: 'remarcar',
      motivo: payload.remarcacao_motivo,
      vendedor: payload.assigned_to,
      endereco_mudou: trocouEndereco,
      telefone_mudou: trocouTelefone,
      vez: payload.visit_reschedule_count,
    },
  })
  if (oldStage !== 'remarcado') {
    await supabase.from('client_history').insert({
      client_id:  client.id,
      user_id:    userId,
      user_name:  userName || null,
      event_type: 'stage_change',
      event_data: { from: oldStage, to: 'remarcado' },
    })
  }
  if (trocouEndereco) {
    await supabase.from('client_history').insert({
      client_id:  client.id,
      user_id:    userId,
      user_name:  userName || null,
      event_type: 'endereco',
      event_data: { acao: 'novo', endereco: {
        rua: payload.address_street, numero: payload.address_number,
        bairro: payload.address_neighborhood, cidade: payload.city,
        referencia: payload.address_reference,
      } },
    })
  }
  if (trocouTelefone) {
    await supabase.from('client_history').insert({
      client_id:  client.id,
      user_id:    userId,
      user_name:  userName || null,
      event_type: 'telefone',
      event_data: { acao: 'novo', numero: payload.phone, anterior: client.phone || null },
    })
  }

  return { error: null, payload, oldEventId, oldIso }
}

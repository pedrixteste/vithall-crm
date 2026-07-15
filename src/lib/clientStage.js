import { supabase } from './supabase'
import { localDateStr } from './utils'

const todayStr = () => localDateStr()

// Crédito de matrícula p/ comissão: vai para quem marcou a visita ATUAL
// (visit_scheduled_by; se remarcada, é quem remarcou), fallback created_by.
// 1 crédito por cliente — repetir a ação não duplica (ignoreDuplicates).
export async function creditMatricula(client, enrolledById) {
  const creditedTo = client.visit_scheduled_by || client.created_by
  if (!creditedTo) return
  await supabase.from('matricula_credits').upsert({
    client_id:   client.id,
    credited_to: creditedTo,
    enrolled_by: enrolledById || null,
    credit_date: todayStr(),
  }, { onConflict: 'client_id', ignoreDuplicates: true })
}

// Cliente saiu do estágio "matriculado" → remove o crédito (foi engano)
export async function removeMatriculaCredit(clientId) {
  await supabase.from('matricula_credits').delete().eq('client_id', clientId)
}

// Muda o estágio de matrícula do cliente e registra no histórico (client_history),
// igual ao fluxo do ClienteDetalhe. Usado pelos botões de resultado da aba "Hoje".
export async function updateClientStage({ client, newStage, oldStage, userId, userName }) {
  if (oldStage === newStage) return
  await supabase.from('clients').update({ matricula_stage: newStage }).eq('id', client.id)
  await supabase.from('client_history').insert({
    client_id:  client.id,
    user_id:    userId,
    user_name:  userName || null,
    event_type: 'stage_change',
    event_data: { from: oldStage, to: newStage },
  })
  if (newStage === 'matriculado')      await creditMatricula(client, userId)
  else if (oldStage === 'matriculado') await removeMatriculaCredit(client.id)
}

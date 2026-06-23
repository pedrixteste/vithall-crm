import { supabase } from './supabase'

// Muda o estágio de matrícula do cliente e registra no histórico (client_history),
// igual ao fluxo do ClienteDetalhe. Usado pelos botões de resultado da aba "Hoje".
export async function updateClientStage({ clientId, newStage, oldStage, userId, userName }) {
  if (oldStage === newStage) return
  await supabase.from('clients').update({ matricula_stage: newStage }).eq('id', clientId)
  await supabase.from('client_history').insert({
    client_id:  clientId,
    user_id:    userId,
    user_name:  userName || null,
    event_type: 'stage_change',
    event_data: { from: oldStage, to: newStage },
  })
}

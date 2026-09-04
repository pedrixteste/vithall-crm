import { supabase } from './supabase'
import { localDateStr } from './utils'
// Regra pura (quem divide a comissão) mora em visitRules.js para ser testável
// no Node. Reexportada: a ficha do cliente importa daqui.
import { bookersDaMatricula } from './visitRules'
export { bookersDaMatricula } from './visitRules'

const todayStr = () => localDateStr()

// Crédito de matrícula p/ comissão. Desde ago/2026 a mesma matrícula pode
// contar para MAIS de uma pessoa (os participantes escolhidos na estrela),
// então a chave única é (client_id, credited_to); este crédito é o de quem
// marcou/remarcou a visita.
export async function creditMatricula(client, enrolledById) {
  const bookers = bookersDaMatricula(client)
  if (!bookers.length) return
  // Insere só quem ainda não tem crédito neste cliente — assim repetir a
  // ação não duplica nem apaga o motivo/data de um crédito já existente.
  const { data: existentes } = await supabase.from('matricula_credits')
    .select('credited_to').eq('client_id', client.id)
  const jaTem = new Set((existentes || []).map(r => r.credited_to))
  const novos = bookers.filter(b => !jaTem.has(b.id)).map(b => ({
    client_id:   client.id,
    credited_to: b.id,
    enrolled_by: enrolledById || null,
    credit_date: todayStr(),
    role:        b.role,
  }))
  if (novos.length) await supabase.from('matricula_credits').insert(novos)
}

// Reconcilia QUEM recebe esta matrícula: quem marcou/remarcou a visita (cada
// um com sua caixinha marcada) + os participantes escolhidos na estrela, cada
// um com o motivo. Quem for desmarcado PERDE o crédito — a matrícula sai da
// conta dele.
// `bookersCredited`: { [id]: bool } — quais dos marcadores ficam creditados.
// `participants`: [{ id, note }]. Retorna { error }.
export async function syncMatriculaCredits({ client, enrolledById, bookersCredited = null, bookerCredited, participants = [] }) {
  const desejado = new Map()
  for (const b of bookersDaMatricula(client)) {
    // Sem o mapa novo, cai na regra antiga (uma caixinha só para todo mundo)
    const marcado = bookersCredited ? bookersCredited[b.id] !== false : bookerCredited !== false
    if (marcado) desejado.set(b.id, { note: null, is_participant: false, role: b.role })
  }
  participants.forEach(p => {
    if (!p?.id || desejado.has(p.id)) return
    desejado.set(p.id, { note: p.note?.trim() || null, is_participant: true, role: 'participante' })
  })

  const { data: atuais, error } = await supabase.from('matricula_credits')
    .select('id, credited_to, credit_date').eq('client_id', client.id)
  if (error) return { error }

  const remover = (atuais || []).filter(r => !desejado.has(r.credited_to)).map(r => r.id)
  if (remover.length) {
    const { error: delErr } = await supabase.from('matricula_credits').delete().in('id', remover)
    if (delErr) return { error: delErr }
  }

  if (desejado.size === 0) return { error: null }
  // Mantém a data do crédito antigo: reeditar a estrela não pode empurrar uma
  // matrícula velha para o dia de hoje nos relatórios.
  const dataDe = new Map((atuais || []).map(r => [r.credited_to, r.credit_date]))
  const linhas = [...desejado].map(([pid, d]) => ({
    client_id:      client.id,
    credited_to:    pid,
    enrolled_by:    enrolledById || null,
    credit_date:    dataDe.get(pid) || todayStr(),
    note:           d.note,
    is_participant: d.is_participant,
    role:           d.role,
  }))
  const { error: upErr } = await supabase.from('matricula_credits')
    .upsert(linhas, { onConflict: 'client_id,credited_to' })
  return { error: upErr || null }
}

// Cliente saiu do estágio "matriculado" → remove o crédito (foi engano)
export async function removeMatriculaCredit(clientId) {
  await supabase.from('matricula_credits').delete().eq('client_id', clientId)
}

// Muda o estágio de matrícula do cliente e registra no histórico (client_history),
// igual ao fluxo do ClienteDetalhe. Usado pelos botões de resultado da aba "Hoje".
// Retorna { error }: os botões da aba Hoje mudam o estágio de forma OTIMISTA,
// então precisam saber se a gravação falhou para desfazer na tela.
// `canceledBy` ('cliente' | 'nos') só se aplica ao estágio 'cancelado': registra
// no histórico QUEM desmarcou. Só quando o CLIENTE cancela é que conta para o
// aviso "cancelou Xx" na ficha (cancelamento nosso não mancha o cliente).
export async function updateClientStage({ client, newStage, oldStage, userId, userName, canceledBy = null }) {
  if (oldStage === newStage) return { error: null }
  const { error } = await supabase.from('clients').update({ matricula_stage: newStage }).eq('id', client.id)
  if (error) return { error }
  await supabase.from('client_history').insert({
    client_id:  client.id,
    user_id:    userId,
    user_name:  userName || null,
    event_type: 'stage_change',
    event_data: { from: oldStage, to: newStage, ...(canceledBy ? { by: canceledBy } : {}) },
  })
  if (newStage === 'matriculado')      await creditMatricula(client, userId)
  else if (oldStage === 'matriculado') await removeMatriculaCredit(client.id)
  return { error: null }
}

// Visitas que "pertencem" à marcação de um PRÉ-VENDAS.
//
// A métrica mede a qualidade da marcação: se a pessoa marca muito e o cliente
// não recebe o vendedor, a marcação está ruim. Por isso só conta a PRIMEIRA
// visita de cada cliente (fruto da ligação dela). As visitas seguintes são do
// vendedor — ele remarca e mantém o contato — e não entram, SALVO quando foi
// o próprio pré-vendas quem registrou a nova marcação (aí é outra marcação
// dela que virou visita).
//
// bookingsByClient: { client_id: [{ at: ISO, user_id }] } — histórico de
// marcações (client_history.visit_scheduled), em ordem cronológica.
// Pode receber TODOS os clientes: a 1ª visita só conta se o cliente foi
// cadastrado pela pessoa (created_by); as seguintes, se ela remarcou.
export function visitasDaMarcacao(clients, bookingsByClient, userId, inRange) {
  const out = []
  for (const c of clients) {
    const vs = (c.visits || [])
      .filter(v => v.visit_date && v.rating !== 'nao_teve') // "não teve" = não recebeu
      .sort((a, b) => a.visit_date.localeCompare(b.visit_date))
    vs.forEach((v, i) => {
      if (inRange && !inRange(new Date(v.visit_date + 'T12:00:00'))) return
      if (i === 0) { if (c.created_by === userId) out.push(v); return }
      // Visita seguinte: conta só se a marcação que a gerou (a última
      // registrada entre a visita anterior e esta) foi do próprio pré-vendas
      const prev = vs[i - 1].visit_date
      const evs = (bookingsByClient?.[c.id] || [])
        .filter(e => e.at > prev + 'T23:59:59' && e.at <= v.visit_date + 'T23:59:59')
      const last = evs[evs.length - 1]
      if (last && last.user_id === userId) out.push(v)
    })
  }
  return out
}

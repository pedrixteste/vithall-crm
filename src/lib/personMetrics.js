// Métricas de UMA pessoa e de um GRUPO num período — regra única usada pela
// tela de Relatórios e pelo relatório exportado, pra os números baterem.
//
// Por pessoa:
//   marcacoes        = clientes que ELA cadastrou no período (quem cadastra é quem marcou)
//   visitasMarc      = visitas nascidas das marcações dela: a 1ª visita de cada
//                      cliente que ela marcou (+ remarcações que ela mesma registrou)
//   visitasTotais    = todas as visitas realizadas dos clientes ATRIBUÍDOS a ela
//                      (trabalho de vendedor — pré-vendas não tem)
//   matriculas       = fechadas nos clientes atribuídos a ela (só vendedor/gerente)
//   noShow/canceled  = das marcações dela no período
// O que antes dava contagem dupla (Amanda marcou, Gabrielle vendeu → contava 2)
// agora tem dono único em cada métrica.
import { visitasDaMarcacao } from './visitMetrics'
import { matriculaConta } from './matricula'

// "Visita realizada": tem linha em visits e o cliente recebeu (não é "Não teve")
export const visitaRealizada = (v) => v?.visit_date && v.rating !== 'nao_teve'

// Dia em que a matrícula aconteceu: visita matriculada → (crédito, se houver) → cadastro
export function matriculaDia(c, credits) {
  const mv = (c.visits || []).filter(v => v.visit_outcome === 'matriculada' && v.visit_date)
    .map(v => v.visit_date).sort().pop()
  if (mv) return mv
  const cr = (credits || []).filter(x => x.client_id === c.id && x.credit_date).map(x => x.credit_date).sort()[0]
  if (cr) return cr
  const d = new Date(c.created_at)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : null)

export function personMetrics({ person, clients, bookingsByClient, inRange, credits }) {
  const id    = person.id
  const isPre = person.role === 'pre_vendas'
  const inDay = (ds) => inRange(new Date(ds + 'T12:00:00'))

  const booked    = clients.filter(c => c.created_by === id)
  const marcacoes = booked.filter(c => inRange(new Date(c.created_at)))
  const marcacoesComVisita = marcacoes.filter(c => (c.visits || []).some(visitaRealizada))

  // Passa TODOS os clientes: a 1ª visita só conta se o cliente é dela
  // (created_by); as seguintes só se foi ela quem registrou a remarcação
  const visitasMarc = visitasDaMarcacao(clients, bookingsByClient, id, inRange)

  const atendidos     = isPre ? [] : clients.filter(c => c.assigned_to === id)
  const visitasTotais = atendidos.flatMap(c => (c.visits || []).filter(v => visitaRealizada(v) && inDay(v.visit_date)))
  const matriculas    = atendidos.filter(c => matriculaConta(c) && inDay(matriculaDia(c, credits)))
  const matriculasAcum = atendidos.filter(matriculaConta)

  const noShow   = marcacoes.filter(c => c.matricula_stage === 'nao_apareceu')
  const canceled = marcacoes.filter(c => c.matricula_stage === 'cancelado')

  const visitasRef = isPre ? visitasMarc.length : visitasTotais.length
  return {
    marcacoes:          marcacoes.length,
    marcacoesComVisita: marcacoesComVisita.length,
    visitasMarc:        visitasMarc.length,
    visitasTotais:      visitasTotais.length,
    // "visitas" = a referência da pessoa: pré-vendas → das marcações; vendedor → totais
    visitas:            visitasRef,
    matriculas:         matriculas.length,
    matriculasAcum:     matriculasAcum.length,
    noShow:             noShow.length,
    canceled:           canceled.length,
    convMV:             pct(marcacoesComVisita.length, marcacoes.length),
    // conversão visita→matrícula: vendedor pelas fechadas; pré-vendas pelos créditos (participação)
    convVE:             isPre ? null : pct(matriculas.length, visitasTotais.length),
    _marcacoesList:     marcacoes,
    _matriculasList:    matriculas,
    _matriculasAcumList: matriculasAcum,
  }
}

// Totais de um grupo, contando cada cliente/visita/matrícula UMA vez:
//   marcações = cadastradas por alguém do grupo; visitas = dos clientes
//   atribuídos a alguém do grupo; matrículas = clientes do grupo (atribuídos
//   OU cadastrados por alguém dele) que fecharam no período.
export function scopeTotals({ people, clients, inRange, credits }) {
  const ids   = new Set(people.map(p => p.id))
  const inDay = (ds) => inRange(new Date(ds + 'T12:00:00'))
  const doGrupo   = clients.filter(c => ids.has(c.created_by) || ids.has(c.assigned_to))
  const marcacoes = clients.filter(c => ids.has(c.created_by) && inRange(new Date(c.created_at)))
  const marcacoesComVisita = marcacoes.filter(c => (c.visits || []).some(visitaRealizada))
  const visitas   = clients.filter(c => ids.has(c.assigned_to))
    .flatMap(c => (c.visits || []).filter(v => visitaRealizada(v) && inDay(v.visit_date)))
  const matriculas = doGrupo.filter(c => matriculaConta(c) && inDay(matriculaDia(c, credits)))
  const matriculasAcum = doGrupo.filter(matriculaConta)
  return {
    marcacoes:          marcacoes.length,
    marcacoesComVisita: marcacoesComVisita.length,
    visitas:            visitas.length,
    matriculas:         matriculas.length,
    matriculasAcum:     matriculasAcum.length,
    noShow:             marcacoes.filter(c => c.matricula_stage === 'nao_apareceu').length,
    canceled:           marcacoes.filter(c => c.matricula_stage === 'cancelado').length,
    convMV:             pct(marcacoesComVisita.length, marcacoes.length),
    convVE:             pct(matriculas.length, visitas.length),
    _matriculasList:    matriculas,
    _matriculasAcumList: matriculasAcum,
  }
}

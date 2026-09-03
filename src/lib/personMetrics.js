// Métricas de UMA pessoa e de um GRUPO num período — regra única usada pela
// tela de Relatórios e pelo relatório exportado, pra os números baterem.
//
// Por pessoa:
//   marcacoes        = clientes que ELA cadastrou no período (quem cadastra é quem marcou)
//   visitasMarc      = quantos clientes que ELA marcou no período receberam visita.
//                      Cada cliente conta UMA vez, tenha tido 1 ou 10 visitas — a
//                      métrica mede a marcação (o cliente recebeu?), não o volume
//   visitasTotais    = todas as visitas realizadas dos clientes ATRIBUÍDOS a ela
//                      (trabalho de vendedor — pré-vendas não tem)
//   matriculas       = fechadas nos clientes atribuídos a ela (só vendedor/gerente)
//   noShow/canceled  = das marcações dela no período
// O que antes dava contagem dupla (Amanda marcou, Gabrielle vendeu → contava 2)
// agora tem dono único em cada métrica.
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

// Destino de UMA marcação — toda marcação cai em exatamente uma caixa, pra
// conta fechar (marcações = soma de todos os destinos):
//   recebeu      → teve pelo menos uma visita realizada (ou já matriculou)
//   naoApareceu  → estágio "Não apareceu"
//   cancelou     → estágio "Cancelou visita" OU quem marcou registrou o
//                  cancelamento na confirmação (visit_confirmation
//                  'nao_confirmada', que o app mostra como "Cancelou visita")
//   naoTeve      → só tem visita marcada como "Não teve" (o cliente não recebeu)
//   aguardando   → visita marcada para uma data que ainda não chegou
//   semRegistro  → visita marcada, data já passou e ninguém registrou o que houve
//   semMarcacao  → não chegou a ter visita marcada (pediu p/ ligar, não marcou)
//
// ⚠️ O cancelamento vive em DOIS lugares (estágio e confirmação da visita) —
// olhar só o estágio jogava um cancelamento registrado na confirmação para
// "sem registro" (caso Roberta, 28/08/26). Campo novo que registre desfecho
// tem que entrar aqui; a lista nominal do relatório mostra a confirmação de
// cada linha justamente para um erro desses aparecer.
export const DESTINOS = [
  ['recebeu',     'Receberam visita'],
  ['naoApareceu', 'Não apareceu'],
  ['cancelou',    'Cancelou'],
  ['naoTeve',     'Não teve visita'],
  ['aguardando',  'Visita futura'],
  ['semRegistro', 'Passou sem registro'],
  ['semMarcacao', 'Sem visita marcada'],
]
// Caixas que entram na lista nominal do relatório: "não apareceu" e "cancelou"
// já estão fechadas (a conta acima mostra quantas) — a lista serve pro que
// ainda pode ser resolvido.
export const DESTINOS_LISTAR = ['naoTeve', 'aguardando', 'semRegistro', 'semMarcacao']
// Notas da estrela (visits.rating) — mesma lista do ClienteDetalhe, com o
// peso de cada nota para a média (1 · 4 · 7 · 10)
export const NOTAS = [
  ['pessima',  'Péssima',  '#B91C1C', 1],
  ['razoavel', 'Razoável', '#C2410C', 4],
  ['boa',      'Boa',      '#1D4ED8', 7],
  ['otima',    'Ótima',    '#15803D', 10],
]
export function destinoMarcacao(c, agora = new Date()) {
  const vs = c.visits || []
  // Matriculado é o melhor destino possível — mesmo sem a visita registrada
  if (vs.some(visitaRealizada) || c.matricula_stage === 'matriculado') return 'recebeu'
  if (c.matricula_stage === 'nao_apareceu') return 'naoApareceu'
  if (c.matricula_stage === 'cancelado' || c.visit_confirmation === 'nao_confirmada') return 'cancelou'
  if (vs.some(v => v.rating === 'nao_teve')) return 'naoTeve'
  const marcada = c.visit_scheduled_at ? new Date(c.visit_scheduled_at) : null
  if (marcada && marcada >= agora) return 'aguardando'
  if (marcada || ['marcado', 'nao_visitado', 'recebeu_visita', 'matriculado'].includes(c.matricula_stage)) return 'semRegistro'
  return 'semMarcacao'
}

export function personMetrics({ person, clients, inRange, credits }) {
  const id    = person.id
  const isPre = person.role === 'pre_vendas'
  const inDay = (ds) => inRange(new Date(ds + 'T12:00:00'))

  const booked    = clients.filter(c => c.created_by === id)
  const marcacoes = booked.filter(c => inRange(new Date(c.created_at)))
  // Recebeu = mesma regra do destino (visita realizada OU já matriculado)
  const marcacoesComVisita = marcacoes.filter(c => destinoMarcacao(c) === 'recebeu')

  // A 1ª visita realizada de cada marcação que recebeu — uma por cliente
  // (matriculado sem visita registrada não tem objeto de visita)
  const visitasMarc = marcacoesComVisita.map(c =>
    (c.visits || []).filter(visitaRealizada).sort((a, b) => a.visit_date.localeCompare(b.visit_date))[0])

  const atendidos     = isPre ? [] : clients.filter(c => c.assigned_to === id)
  const visitasTotais = atendidos.flatMap(c => (c.visits || []).filter(v => visitaRealizada(v) && inDay(v.visit_date)))
  const matriculas    = atendidos.filter(c => matriculaConta(c) && inDay(matriculaDia(c, credits)))
  const matriculasAcum = atendidos.filter(matriculaConta)

  // Cada marcação em uma caixa só — a soma das caixas é o total de marcações
  const destinos = Object.fromEntries(DESTINOS.map(([k]) => [k, 0]))
  const marcacoesSemVisita = []
  for (const c of marcacoes) {
    const d = destinoMarcacao(c)
    destinos[d]++
    if (DESTINOS_LISTAR.includes(d)) marcacoesSemVisita.push({ client: c, destino: d })
  }
  // Mesma régua do destino, pro relatório não mostrar dois números diferentes
  const noShow   = marcacoes.filter(c => destinoMarcacao(c) === 'naoApareceu')
  const canceled = marcacoes.filter(c => destinoMarcacao(c) === 'cancelou')

  // Nota que o vendedor deu (na estrela) à 1ª visita de cada marcação que
  // recebeu — mede a qualidade da marcação na visão de quem visitou.
  // A média usa os pesos de NOTAS (péssima 1 · razoável 4 · boa 7 · ótima 10)
  // e só entra quem tem nota: visita sem estrela preenchida não puxa a média.
  const notas = Object.fromEntries([...NOTAS.map(([k]) => [k, 0]), ['semNota', 0]])
  for (const v of visitasMarc) notas[NOTAS.some(([k]) => k === v?.rating) ? v.rating : 'semNota']++
  const comNota   = NOTAS.reduce((s, [k]) => s + notas[k], 0)
  const notaMedia = comNota > 0
    ? NOTAS.reduce((s, [k, , , peso]) => s + notas[k] * peso, 0) / comNota
    : null

  const visitasRef = isPre ? visitasMarc.length : visitasTotais.length
  return {
    destinos,
    notas,
    notaMedia,
    comNota,
    _marcacoesSemVisita: marcacoesSemVisita,
    marcacoes:          marcacoes.length,
    marcacoesComVisita: marcacoesComVisita.length,
    visitasMarc:        marcacoesComVisita.length,
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
    _visitasMarcList:   visitasMarc.filter(Boolean),
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
  const marcacoesComVisita = marcacoes.filter(c => destinoMarcacao(c) === 'recebeu')
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
    noShow:             marcacoes.filter(c => destinoMarcacao(c) === 'naoApareceu').length,
    canceled:           marcacoes.filter(c => destinoMarcacao(c) === 'cancelou').length,
    convMV:             pct(marcacoesComVisita.length, marcacoes.length),
    convVE:             pct(matriculas.length, visitas.length),
    _matriculasList:    matriculas,
    _matriculasAcumList: matriculasAcum,
  }
}

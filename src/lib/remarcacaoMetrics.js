// ── Marcação ≠ Remarcação ≠ Repescagem ──────────────────────────────
// As três andam juntas no relatório mas NUNCA se misturam na conta. O que
// cada uma é, em uma linha:
//
//   marcação   = um cliente novo entrou com visita marcada (o cadastro).
//                Já vive em lib/personMetrics — aqui não se mexe nela.
//   remarcação = a data de uma visita que JÁ existia mudou. É um evento, não
//                um cliente: o mesmo cliente pode ter 3 remarcações.
//   repescagem = alguém marcou para religar para esse cliente no futuro.
//                Também é um evento (marcada / desmarcada).
//
// Remarcação e repescagem são contadas pelos EVENTOS do client_history, não
// pelo estágio nem pelas colunas do cliente. Motivo: existem cinco caminhos
// que remarcam uma visita e a coluna só guarda a última — pelo evento nenhuma
// escapa, e desmarcar uma repescagem não apaga a história dela.
//
// ⚠️ Os eventos de repescagem só existem a partir de 04/09/2026. Antes disso
// a repescagem não deixava rastro nenhum, então o bloco dela no relatório
// começa a contar dessa data — e a tela diz isso em vez de fingir um zero.
export const REPESCAGEM_DESDE = '2026-09-04'

const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : null)

/**
 * Uma remarcação é um evento visit_scheduled que tinha data anterior.
 *
 * ⚠️ O event_type PRECISA ser conferido: o evento de mudança de estágio também
 * tem `from` no event_data ({from:'cancelado', to:'remarcado'}) e, numa lista
 * misturada, seria contado como remarcação — inflando o número do relatório.
 * Lista já filtrada (sem event_type nos itens) continua valendo.
 */
export const ehRemarcacao = (ev) =>
  (ev?.event_type === undefined || ev?.event_type === 'visit_scheduled') && !!ev?.event_data?.from

/**
 * Remarcações que aconteceram no período. `bookings` são os eventos
 * visit_scheduled crus (com created_at, user_id, client_id, event_data).
 * `pessoaId` filtra por quem remarcou.
 */
export function remarcacoesNoPeriodo(bookings = [], inRange, pessoaId = null) {
  return bookings.filter(ev =>
    ehRemarcacao(ev) &&
    inRange(new Date(ev.created_at)) &&
    (!pessoaId || ev.user_id === pessoaId))
}

/** Quantas remarcações cada pessoa fez — [{ id, total }] do maior p/ o menor. */
export function remarcacoesPorPessoa(remarcacoes = []) {
  const mapa = new Map()
  for (const ev of remarcacoes) {
    if (!ev.user_id) continue
    mapa.set(ev.user_id, (mapa.get(ev.user_id) || 0) + 1)
  }
  return [...mapa].map(([id, total]) => ({ id, total })).sort((a, b) => b.total - a.total)
}

/**
 * A pergunta que interessa: quantas remarcações costumam ser necessárias até
 * a venda? Agrupa os clientes por quantas vezes a visita foi remarcada e diz,
 * em cada grupo, quantos matricularam.
 *
 * `clients` já vem filtrado (as marcações do período). `matriculou` é a régua
 * de matrícula de verdade (matriculaConta), passada de fora para não haver
 * duas definições de matrícula no app.
 *
 * Devolve [{ faixa, label, clientes, matriculas, conversao }] com as faixas
 * 0, 1, 2 e "3 ou mais" — e a média de remarcações de quem matriculou contra
 * a de quem não matriculou, que é a comparação que mostra o ponto de virada.
 */
export function remarcacoesAteAMatricula(clients = [], matriculou) {
  const FAIXAS = [
    { faixa: 0, label: 'Sem remarcação', teste: n => n === 0 },
    { faixa: 1, label: '1 remarcação',   teste: n => n === 1 },
    { faixa: 2, label: '2 remarcações',  teste: n => n === 2 },
    { faixa: 3, label: '3 ou mais',      teste: n => n >= 3 },
  ]
  const vezes = (c) => c.visit_reschedule_count || 0

  const linhas = FAIXAS.map(f => {
    const doGrupo = clients.filter(c => f.teste(vezes(c)))
    const mats    = doGrupo.filter(matriculou)
    return {
      faixa: f.faixa, label: f.label,
      clientes: doGrupo.length,
      matriculas: mats.length,
      conversao: pct(mats.length, doGrupo.length),
    }
  })

  const comMat  = clients.filter(matriculou)
  const semMat  = clients.filter(c => !matriculou(c))
  const media   = (lista) => lista.length
    ? Math.round((lista.reduce((s, c) => s + vezes(c), 0) / lista.length) * 100) / 100
    : null

  return {
    linhas,
    total: clients.length,
    mediaMatriculados:    media(comMat),
    mediaNaoMatriculados: media(semMat),
    // Quantas marcações precisaram de pelo menos uma remarcação
    comRemarcacao: clients.filter(c => vezes(c) > 0).length,
    pctComRemarcacao: pct(clients.filter(c => vezes(c) > 0).length, clients.length),
  }
}

/**
 * Repescagem dá resultado? Compara quem foi marcado para repescagem com a
 * régua geral do período.
 *
 * `repescagemEvents` são os eventos 'repescagem' do client_history (acao
 * 'marcada'), `clientById` resolve o cliente de cada evento, `recebeuVisita` e
 * `matriculou` são as réguas de fora (mesmas do resto do relatório).
 *
 * Conta CLIENTES únicos, não eventos: marcar, desmarcar e marcar de novo o
 * mesmo cliente é uma repescagem só na conversão — senão o mesmo cliente
 * apareceria duas vezes e inflaria o número.
 */
export function repescagemMetrics({ repescagemEvents = [], clientById, inRange, recebeuVisita, matriculou }) {
  const ids = new Set()
  for (const ev of repescagemEvents) {
    if (ev.event_type !== undefined && ev.event_type !== 'repescagem') continue
    if (ev.event_data?.acao !== 'marcada') continue
    if (inRange && !inRange(new Date(ev.created_at))) continue
    if (ev.client_id) ids.add(ev.client_id)
  }
  const lista = [...ids].map(clientById).filter(Boolean)
  const comVisita = lista.filter(recebeuVisita)
  const comMat    = lista.filter(matriculou)
  return {
    clientes:    lista.length,
    receberam:   comVisita.length,
    matriculas:  comMat.length,
    convVisita:  pct(comVisita.length, lista.length),
    convMat:     pct(comMat.length, lista.length),
    _lista:      lista,
  }
}

/**
 * Repescagens marcadas por pessoa no período — [{ id, total }].
 * Conta CLIENTES, não eventos: marcar, desmarcar e marcar de novo o mesmo
 * cliente é uma repescagem só, senão o ranking premiaria quem fica mexendo.
 */
export function repescagensPorPessoa(repescagemEvents = [], inRange) {
  const mapa = new Map()
  for (const ev of repescagemEvents) {
    if (ev.event_type !== undefined && ev.event_type !== 'repescagem') continue
    if (ev.event_data?.acao !== 'marcada') continue
    if (inRange && !inRange(new Date(ev.created_at))) continue
    if (!ev.user_id || !ev.client_id) continue
    if (!mapa.has(ev.user_id)) mapa.set(ev.user_id, new Set())
    mapa.get(ev.user_id).add(ev.client_id)
  }
  return [...mapa].map(([id, set]) => ({ id, total: set.size })).sort((a, b) => b.total - a.total)
}

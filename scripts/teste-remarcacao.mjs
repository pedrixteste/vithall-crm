// Testes das contas de remarcação, repescagem e endereços.
// Rodar: node scripts/teste-remarcacao.mjs
// Funções puras só — não toca no banco nem precisa de login.
import {
  adicionarEndereco, excluirEndereco, tornarAtual, enderecosAtivos,
  enderecoAtual, enderecoTexto, mesmoEndereco, enderecosDoCliente, MAX_ENDERECOS,
} from '../src/lib/enderecos.js'
import {
  remarcacoesNoPeriodo, remarcacoesPorPessoa, remarcacoesAteAMatricula,
  repescagemMetrics, repescagensPorPessoa, ehRemarcacao,
} from '../src/lib/remarcacaoMetrics.js'
import { podeRemarcar, bookersDaMatricula } from '../src/lib/visitRules.js'
import { destinoMarcacao } from '../src/lib/personMetrics.js'
import { proximaOcorrencia } from '../src/lib/utils.js'
import { trocarTelefone, telefoneTexto } from '../src/lib/telefones.js'

let ok = 0, fail = 0
const eq = (nome, a, b) => {
  const A = JSON.stringify(a), B = JSON.stringify(b)
  if (A === B) { ok++; return }
  fail++
  console.log(`  ✗ ${nome}\n     esperado: ${B}\n     veio:     ${A}`)
}
const grupo = (t) => console.log(`\n── ${t}`)

// ═══════════════ ENDEREÇOS ═══════════════
grupo('Endereços')

const clienteAntigo = {
  id: 'c1', created_at: '2026-01-01', created_by: 'u1',
  address_street: 'Av. Brasil', address_number: '100',
  address_neighborhood: 'Centro', city: 'Porto Alegre', address_reference: 'perto da praça',
}
eq('cliente antigo vira 1 endereço "principal"', enderecosDoCliente(clienteAntigo).length, 1)
eq('e ele é o atual', enderecoAtual(clienteAntigo).id, 'principal')
eq('texto do endereço', enderecoTexto(enderecoAtual(clienteAntigo)), 'Av. Brasil, 100, Centro, Porto Alegre')

const novo1 = { rua: 'Rua B', numero: '20', bairro: 'Sul', cidade: 'Canoas', referencia: 'ao lado do posto' }
const r1 = adicionarEndereco(clienteAntigo, novo1, 'u2')
eq('adicionar → 2 ativos', enderecosAtivos({ enderecos: r1.enderecos }).length, 2)
eq('o novo vira o atual', enderecoAtual({ enderecos: r1.enderecos }).rua, 'Rua B')
eq('colunas antigas espelham o novo', [r1.address_street, r1.city], ['Rua B', 'Canoas'])
eq('o antigo continua lá', enderecosAtivos({ enderecos: r1.enderecos })[0].rua, 'Av. Brasil')

const c2 = { ...clienteAntigo, enderecos: r1.enderecos }
const r2 = adicionarEndereco(c2, { rua: 'Rua C', numero: '3', bairro: 'Norte', cidade: 'Gravataí', referencia: 'x' }, 'u2')
eq('terceiro endereço entra', enderecosAtivos({ enderecos: r2.enderecos }).length, 3)

const c3 = { ...clienteAntigo, enderecos: r2.enderecos }
const r3 = adicionarEndereco(c3, { rua: 'Rua D', numero: '4', bairro: 'Leste', cidade: 'Viamão', referencia: 'y' }, 'u2')
eq('quarto endereço é barrado', !!r3.erro, true)
eq('a mensagem diz o que fazer', /Escolha qual excluir/.test(r3.erro), true)

const alvo = enderecosAtivos(c3)[0].id
const r4 = adicionarEndereco(c3, { rua: 'Rua D', numero: '4', bairro: 'Leste', cidade: 'Viamão', referencia: 'y' }, 'u2', alvo)
eq('substituindo um, o quarto entra', enderecosAtivos({ enderecos: r4.enderecos }).length, 3)
eq('o substituído ficou marcado como excluído (não sumiu)',
  enderecosDoCliente({ enderecos: r4.enderecos }).filter(e => e.excluido_em).length, 1)
eq('total de itens continua 4 (o backup guarda o excluído)', r4.enderecos.length, 4)

const rep = adicionarEndereco(c3, { rua: 'rua c', numero: '3', bairro: 'norte', cidade: 'gravataí', referencia: 'x' }, 'u2')
eq('endereço repetido não cria item novo', enderecosAtivos({ enderecos: rep.enderecos }).length, 3)
eq('e só vira o atual', enderecoAtual({ enderecos: rep.enderecos }).rua, 'Rua C')
eq('mesmoEndereco ignora maiúscula e espaço', mesmoEndereco({ rua: ' AV. Brasil ', numero: '100', bairro: 'Centro', cidade: 'Porto Alegre' }, clienteAntigo && { rua: 'av. brasil', numero: '100', bairro: 'centro', cidade: 'porto alegre' }), true)

const exc = excluirEndereco(c3, enderecoAtual(c3).id, 'u2')
eq('excluir o atual passa a vez para outro', !!exc.address_street, true)
eq('e sobram 2 ativos', enderecosAtivos({ enderecos: exc.enderecos }).length, 2)
const soUm = excluirEndereco(clienteAntigo, 'principal', 'u2')
eq('não dá para excluir o único endereço', !!soUm.erro, true)
const tv = tornarAtual(c3, enderecosAtivos(c3)[0].id)
eq('tornar atual espelha nas colunas', tv.address_street, 'Av. Brasil')

// ═══════════════ QUANDO O BOTÃO LIBERA ═══════════════
grupo('podeRemarcar')
const agora = new Date('2026-09-10T12:00:00')
const futuro = '2026-09-20T14:00:00.000Z'
const passado = '2026-09-01T14:00:00.000Z'

eq('cancelou → libera', podeRemarcar({ matricula_stage: 'cancelado', visit_scheduled_at: passado }, agora).pode, true)
eq('não apareceu → libera', podeRemarcar({ matricula_stage: 'nao_apareceu', visit_scheduled_at: passado }, agora).pode, true)
eq('visita marcada no futuro → NÃO libera', podeRemarcar({ matricula_stage: 'marcado', visit_scheduled_at: futuro }, agora).pode, false)
eq('data passou sem registro → libera', podeRemarcar({ matricula_stage: 'marcado', visit_scheduled_at: passado }, agora).pode, true)
eq('remarcado com data futura → NÃO libera de novo', podeRemarcar({ matricula_stage: 'remarcado', visit_scheduled_at: futuro }, agora).pode, false)
eq('remarcado e a data passou → libera', podeRemarcar({ matricula_stage: 'remarcado', visit_scheduled_at: passado }, agora).pode, true)
eq('sem visita nenhuma → NÃO libera', podeRemarcar({ matricula_stage: 'nao_marcou' }, agora).pode, false)
eq('matriculado → NÃO libera', podeRemarcar({ matricula_stage: 'matriculado', visit_scheduled_at: passado }, agora).pode, false)
eq('recebeu visita → NÃO libera', podeRemarcar({ matricula_stage: 'recebeu_visita', visit_scheduled_at: passado }, agora).pode, false)
eq('todo "não" tem explicação', [
  podeRemarcar({ matricula_stage: 'marcado', visit_scheduled_at: futuro }, agora),
  podeRemarcar({ matricula_stage: 'nao_marcou' }, agora),
  podeRemarcar({ matricula_stage: 'matriculado' }, agora),
].every(r => !r.pode && !!r.motivo), true)

// ═══════════════ COMISSÃO DIVIDIDA ═══════════════
grupo('Comissão')
eq('sem remarcação: uma pessoa só',
  bookersDaMatricula({ created_by: 'amanda', visit_scheduled_by: 'amanda' }),
  [{ id: 'amanda', role: 'marcou' }])
eq('com remarcação: as duas (Amanda marcou, Mafe remarcou)',
  bookersDaMatricula({ created_by: 'amanda', visit_first_booked_by: 'amanda', visit_scheduled_by: 'mafe' }),
  [{ id: 'amanda', role: 'marcou' }, { id: 'mafe', role: 'remarcou' }])
eq('cliente antigo sem a coluna nova cai em created_by',
  bookersDaMatricula({ created_by: 'amanda', visit_scheduled_by: 'mafe' }),
  [{ id: 'amanda', role: 'marcou' }, { id: 'mafe', role: 'remarcou' }])
eq('a mesma pessoa remarcando não conta duas vezes',
  bookersDaMatricula({ created_by: 'mafe', visit_first_booked_by: 'mafe', visit_scheduled_by: 'mafe' }).length, 1)

// ═══════════════ REMARCAÇÕES NO RELATÓRIO ═══════════════
grupo('Remarcações')
const inSet = (a, b) => (d) => d >= new Date(a) && d <= new Date(b)
const dentro = inSet('2026-09-01', '2026-09-30T23:59:59')

const eventos = [
  { client_id: 'c1', user_id: 'amanda', created_at: '2026-09-05T10:00:00Z', event_data: { to: 'x' } },            // 1ª marcação
  { client_id: 'c1', user_id: 'mafe',   created_at: '2026-09-08T10:00:00Z', event_data: { from: 'a', to: 'b' } },
  { client_id: 'c1', user_id: 'mafe',   created_at: '2026-09-12T10:00:00Z', event_data: { from: 'b', to: 'c' } },
  { client_id: 'c2', user_id: 'amanda', created_at: '2026-09-09T10:00:00Z', event_data: { from: 'a', to: 'b' } },
  { client_id: 'c3', user_id: 'amanda', created_at: '2026-08-20T10:00:00Z', event_data: { from: 'a', to: 'b' } }, // fora do período
]
eq('primeira marcação NÃO é remarcação', ehRemarcacao(eventos[0]), false)
// Achado no teste com dados reais (04/09/26): o evento de mudança de estágio
// também tem `from` — numa lista misturada ele era contado como remarcação
eq('mudança de estágio NÃO é remarcação',
  ehRemarcacao({ event_type: 'stage_change', event_data: { from: 'cancelado', to: 'remarcado' } }), false)
eq('numa lista MISTURADA só a remarcação de verdade conta',
  remarcacoesNoPeriodo([
    { event_type: 'visit_scheduled', user_id: 'a', created_at: '2026-09-05T10:00:00Z', event_data: { from: 'x', to: 'y' } },
    { event_type: 'stage_change',    user_id: 'a', created_at: '2026-09-05T10:00:00Z', event_data: { from: 'cancelado', to: 'remarcado' } },
    { event_type: 'endereco',        user_id: 'a', created_at: '2026-09-05T10:00:00Z', event_data: { acao: 'novo' } },
  ], dentro).length, 1)
eq('remarcações no período', remarcacoesNoPeriodo(eventos, dentro).length, 3)
eq('filtrando por pessoa', remarcacoesNoPeriodo(eventos, dentro, 'mafe').length, 2)
eq('ranking', remarcacoesPorPessoa(remarcacoesNoPeriodo(eventos, dentro)), [{ id: 'mafe', total: 2 }, { id: 'amanda', total: 1 }])

const matriculou = (c) => c.matricula_stage === 'matriculado'
const marcacoes = [
  { id: 'a', visit_reschedule_count: 0, matricula_stage: 'matriculado' },
  { id: 'b', visit_reschedule_count: 0, matricula_stage: 'recebeu_visita' },
  { id: 'c', visit_reschedule_count: 1, matricula_stage: 'matriculado' },
  { id: 'd', visit_reschedule_count: 1, matricula_stage: 'cancelado' },
  { id: 'e', visit_reschedule_count: 2, matricula_stage: 'cancelado' },
  { id: 'f', visit_reschedule_count: 4, matricula_stage: 'cancelado' },
]
const ate = remarcacoesAteAMatricula(marcacoes, matriculou)
eq('faixa 0: 2 clientes, 1 matrícula, 50%', [ate.linhas[0].clientes, ate.linhas[0].matriculas, ate.linhas[0].conversao], [2, 1, 50])
eq('faixa 1: 2 clientes, 1 matrícula, 50%', [ate.linhas[1].clientes, ate.linhas[1].matriculas, ate.linhas[1].conversao], [2, 1, 50])
eq('faixa 2: 1 cliente, 0 matrícula, 0%', [ate.linhas[2].clientes, ate.linhas[2].matriculas, ate.linhas[2].conversao], [1, 0, 0])
eq('faixa 3+: pega o de 4 remarcações', ate.linhas[3].clientes, 1)
eq('a soma das faixas é o total', ate.linhas.reduce((s, l) => s + l.clientes, 0), marcacoes.length)
eq('média de quem matriculou', ate.mediaMatriculados, 0.5)
eq('média de quem não matriculou', ate.mediaNaoMatriculados, 1.75) // (0+1+2+4)/4
eq('% que precisou remarcar', ate.pctComRemarcacao, 67)
eq('lista vazia não quebra', remarcacoesAteAMatricula([], matriculou).total, 0)

// ═══════════════ REPESCAGEM ═══════════════
grupo('Repescagem')
const clientesRep = [
  { id: 'r1', matricula_stage: 'matriculado', visits: [] },
  { id: 'r2', matricula_stage: 'recebeu_visita', visits: [{ visit_date: '2026-09-10', rating: 'boa' }] },
  { id: 'r3', matricula_stage: 'nao_marcou', visits: [] },
]
const repEventos = [
  { client_id: 'r1', user_id: 'amanda', created_at: '2026-09-05T10:00:00Z', event_data: { acao: 'marcada' } },
  { client_id: 'r1', user_id: 'amanda', created_at: '2026-09-06T10:00:00Z', event_data: { acao: 'desmarcada' } },
  { client_id: 'r1', user_id: 'mafe',   created_at: '2026-09-07T10:00:00Z', event_data: { acao: 'marcada' } },
  { client_id: 'r2', user_id: 'amanda', created_at: '2026-09-08T10:00:00Z', event_data: { acao: 'marcada' } },
  { client_id: 'r3', user_id: 'amanda', created_at: '2026-09-09T10:00:00Z', event_data: { acao: 'marcada' } },
  { client_id: 'r2', user_id: 'amanda', created_at: '2026-08-01T10:00:00Z', event_data: { acao: 'marcada' } }, // fora
]
const rm = repescagemMetrics({
  repescagemEvents: repEventos,
  clientById: (id) => clientesRep.find(c => c.id === id),
  inRange: dentro,
  recebeuVisita: (c) => destinoMarcacao(c) === 'recebeu',
  matriculou,
})
eq('cliente marcado 2x conta 1 vez só', rm.clientes, 3)
eq('desmarcar não tira da conta histórica', rm.clientes, 3)
eq('receberam visita', rm.receberam, 2)
eq('matricularam', rm.matriculas, 1)
eq('conversão p/ visita', rm.convVisita, 67)
eq('conversão p/ matrícula', rm.convMat, 33)
// amanda marcou r1, r2 e r3 dentro do período (o evento de r2 em agosto fica fora)
eq('ranking de quem repescou', repescagensPorPessoa(repEventos, dentro), [{ id: 'amanda', total: 3 }, { id: 'mafe', total: 1 }])
eq('marcar o MESMO cliente duas vezes conta 1 no ranking', repescagensPorPessoa([
  { client_id: 'z', user_id: 'amanda', created_at: '2026-09-05T10:00:00Z', event_data: { acao: 'marcada' } },
  { client_id: 'z', user_id: 'amanda', created_at: '2026-09-06T10:00:00Z', event_data: { acao: 'desmarcada' } },
  { client_id: 'z', user_id: 'amanda', created_at: '2026-09-07T10:00:00Z', event_data: { acao: 'marcada' } },
], dentro), [{ id: 'amanda', total: 1 }])
eq('sem eventos → zero sem quebrar', repescagemMetrics({
  repescagemEvents: [], clientById: () => null, inRange: dentro,
  recebeuVisita: () => false, matriculou,
}).clientes, 0)

// ═══════════════ O ESTÁGIO NOVO NO FUNIL ═══════════════
grupo('destinoMarcacao com o estágio "remarcado"')
const hoje = new Date('2026-09-15T12:00:00')
eq('remarcado com data futura → visita futura',
  destinoMarcacao({ matricula_stage: 'remarcado', visit_scheduled_at: '2026-09-20T14:00:00Z', visits: [] }, hoje), 'aguardando')
eq('remarcado, data passou, nada registrado → passou sem registro (NÃO "sem marcação")',
  destinoMarcacao({ matricula_stage: 'remarcado', visit_scheduled_at: '2026-09-10T14:00:00Z', visits: [] }, hoje), 'semRegistro')
eq('remarcado que recebeu visita → recebeu',
  destinoMarcacao({ matricula_stage: 'remarcado', visit_scheduled_at: '2026-09-10T14:00:00Z', visits: [{ visit_date: '2026-09-10', rating: 'boa' }] }, hoje), 'recebeu')
eq('remarcado sem data nenhuma ainda cai em sem marcação',
  destinoMarcacao({ matricula_stage: 'remarcado', visits: [] }, hoje), 'semRegistro')

// ═══════════════ DATAS DA REPESCAGEM (regressão) ═══════════════
grupo('proximaOcorrencia (regressão da repescagem)')
const ref = new Date('2026-09-04T12:00:00') // sexta
eq('todo dia → hoje', proximaOcorrencia({ type: 'daily' }, ref).daysUntil, 0)
eq('dia 31 em fevereiro cai no último dia',
  new Date(proximaOcorrencia({ type: 'monthly', day: 31 }, new Date('2027-02-01T12:00:00')).date).getDate(), 28)
eq('mensal com o dia já passado vai para o mês seguinte',
  new Date(proximaOcorrencia({ type: 'monthly', day: 1 }, ref).date).getMonth(), 9)
eq('semanal pega o próximo dia marcado', proximaOcorrencia({ type: 'weekly', days: ['seg'] }, ref).daysUntil, 3)
eq('datas específicas: a próxima que não passou',
  proximaOcorrencia({ type: 'specific_date', dates: ['2026-09-01', '2026-09-10', '2026-12-01'] }, ref).daysUntil, 6)
eq('todas as datas passadas → null', proximaOcorrencia({ type: 'specific_date', dates: ['2026-01-01'] }, ref), null)

// ═══════════════ TELEFONES (trocou de número) ═══════════════
grupo('Telefones')
const cliFone = {
  phone: '51900000001', phone_type: 'pessoal',
  phones: [{ n: '51900000002', t: 'empresa', d: 'do sócio' }],
}
const t1f = trocarTelefone(cliFone, { numero: '51988887777', tipo: 'pessoal', dono: 'novo dele' })
eq('número novo vira o principal', t1f.phone, '51988887777')
eq('o antigo desce para a lista', t1f.phones[0].n, '51900000001')
eq('e os que já eram adicionais continuam', t1f.phones[1].n, '51900000002')
eq('a descrição de quem já tinha é preservada', t1f.phones[1].d, 'do sócio')
eq('phone2 antigo é zerado (senão duplica)', t1f.phone2, null)

const cheio = { phone: '1', phone_type: 'pessoal', phones: [
  { n: '22222222', t: 'pessoal' }, { n: '33333333', t: 'pessoal' }, { n: '44444444', t: 'pessoal' }] }
eq('no limite de 4, barra sem escolher quem sai', !!trocarTelefone(cheio, { numero: '55555555' }).erro, true)
const subst = trocarTelefone(cheio, { numero: '55555555' }, '33333333')
eq('escolhendo quem sai, entra', subst.phone, '55555555')
eq('e o escolhido sumiu', subst.phones.some(p => p.n === '33333333'), false)
eq('continua com 4 no total', 1 + subst.phones.length, 4)
eq('número curto é recusado', !!trocarTelefone(cliFone, { numero: '123' }).erro, true)
eq('número vazio é recusado', !!trocarTelefone(cliFone, { numero: '  ' }).erro, true)
const repet = trocarTelefone(cliFone, { numero: '(51) 90000-0002' })
eq('número que já existe só vira principal, não duplica', repet.phone, '(51) 90000-0002')
eq('e não fica repetido na lista', repet.phones.filter(p => p.n.includes('90000-0002') || p.n === '51900000002').length, 0)
eq('total continua 2', 1 + repet.phones.length, 2)

console.log(`
${fail === 0 ? '✅' : '❌'}  ${ok} passaram · ${fail} falharam
`)
process.exit(fail === 0 ? 0 : 1)

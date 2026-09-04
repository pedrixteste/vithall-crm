// Confere se os DADOS QUE ESTÃO NO BANCO produzem os números certos.
// Diferente de teste-remarcacao.mjs (que usa dados inventados): aqui as linhas
// vieram do Supabase de verdade, exportadas para JSON antes.
//
// Rodar: node scripts/teste-banco.mjs <pasta-com-os-json>
import { readFileSync } from 'node:fs'
import { podeRemarcar } from '../src/lib/visitRules.js'
import { destinoMarcacao } from '../src/lib/personMetrics.js'
import { enderecosAtivos, enderecoAtual, enderecoTexto } from '../src/lib/enderecos.js'
import {
  remarcacoesNoPeriodo, remarcacoesAteAMatricula, repescagemMetrics,
} from '../src/lib/remarcacaoMetrics.js'

const dir = process.argv[2]
if (!dir) { console.error('uso: node scripts/teste-banco.mjs <pasta>'); process.exit(2) }
const clients = JSON.parse(readFileSync(`${dir}/raw_clients.clean.json`, 'utf8'))
const hist    = JSON.parse(readFileSync(`${dir}/raw_hist.clean.json`, 'utf8'))

let ok = 0, fail = 0
const eq = (nome, a, b) => {
  if (JSON.stringify(a) === JSON.stringify(b)) { ok++; return }
  fail++
  console.log(`  ✗ ${nome}\n     esperado: ${JSON.stringify(b)}\n     veio:     ${JSON.stringify(a)}`)
}
const por = (n) => clients.find(c => c.contact_name.startsWith(n))

console.log(`\n${clients.length} clientes de teste · ${hist.length} eventos no histórico`)

// ── O botão libera onde deve? ──────────────────────────────────────
console.log('\n── Botão Remarcar, com os dados reais')
eq('T1 remarcado (visita futura) → botão CINZA de novo', podeRemarcar(por('TESTE 1')).pode, false)
eq('T2 não apareceu → LIBERA',        podeRemarcar(por('TESTE 2')).pode, true)
eq('T3 visita futura → CINZA',        podeRemarcar(por('TESTE 3')).pode, false)
eq('T4 data passou sem registro → LIBERA', podeRemarcar(por('TESTE 4')).pode, true)
eq('T5 cancelou → LIBERA',            podeRemarcar(por('TESTE 5')).pode, true)
eq('T6 não apareceu → LIBERA',        podeRemarcar(por('TESTE 6')).pode, true)

// ── A remarcação gravou tudo que precisava? ────────────────────────
console.log('\n── O que a remarcação gravou (T1)')
const t1 = por('TESTE 1')
eq('estágio virou remarcado', t1.matricula_stage, 'remarcado')
eq('contador subiu para 1', t1.visit_reschedule_count, 1)
eq('quem remarcou ficou registrado', !!t1.remarcado_por, true)
eq('quem marcou na ORIGEM foi preservado', t1.visit_first_booked_by, t1.created_by)
eq('quem remarcou é diferente de quem marcou', t1.remarcado_por !== t1.visit_first_booked_by, true)
eq('confirmação foi zerada (a visita volta pra fila)', t1.visit_confirmation, null)
eq('motivo gravado', /pediu para ir na semana/.test(t1.remarcacao_motivo), true)

// ── Endereços ──────────────────────────────────────────────────────
console.log('\n── Endereços (T1 trocou de endereço)')
eq('dois endereços ativos', enderecosAtivos(t1).length, 2)
eq('o novo é o atual', enderecoTexto(enderecoAtual(t1)), 'Av. Nova, 999, Bela Vista, Canoas')
eq('as colunas antigas espelham o atual', [t1.address_street, t1.city], ['Av. Nova', 'Canoas'])
eq('o endereço anterior continua guardado',
  enderecosAtivos(t1).some(e => e.rua === 'Rua Teste'), true)
eq('cliente sem lista nova ainda mostra o endereço dele',
  enderecosAtivos(por('TESTE 3')).length, 1)

// ── Histórico ──────────────────────────────────────────────────────
console.log('\n── Histórico')
const tipos = hist.map(h => h.event_type).sort()
eq('os quatro eventos certos', tipos, ['endereco', 'repescagem', 'stage_change', 'visit_scheduled'])
const vs = hist.find(h => h.event_type === 'visit_scheduled')
eq('a data ANTERIOR sobreviveu no histórico', !!vs.event_data.from, true)
eq('veio pelo botão Remarcar', vs.event_data.via, 'remarcar')
eq('o motivo está no evento', /semana que vem/.test(vs.event_data.motivo), true)
eq('marcou que o endereço mudou', vs.event_data.endereco_mudou, true)

// ── Os números do relatório ────────────────────────────────────────
console.log('\n── Números do relatório')
const sempre = () => true
eq('1 remarcação contada', remarcacoesNoPeriodo(hist, sempre).length, 1)
eq('a 1ª marcação não virou remarcação', remarcacoesNoPeriodo(hist, sempre).length,
  hist.filter(h => h.event_type === 'visit_scheduled' && h.event_data.from).length)

const matriculou = (c) => c.matricula_stage === 'matriculado'
const ate = remarcacoesAteAMatricula(clients, matriculou)
eq('a soma das faixas bate com o total de clientes',
  ate.linhas.reduce((s, l) => s + l.clientes, 0), clients.length)
eq('só T1 tem remarcação', ate.comRemarcacao, 1)

const rep = repescagemMetrics({
  repescagemEvents: hist, clientById: (id) => clients.find(c => c.id === id),
  inRange: sempre, recebeuVisita: (c) => destinoMarcacao(c) === 'recebeu', matriculou,
})
eq('1 repescagem marcada', rep.clientes, 1)
eq('ela ainda não recebeu visita', rep.receberam, 0)

// ── O funil não perde ninguém ──────────────────────────────────────
console.log('\n── Funil')
const destinos = clients.map(c => [c.contact_name.slice(0, 8), destinoMarcacao(c)])
for (const [n, d] of destinos) console.log(`     ${n} → ${d}`)
eq('nenhum cliente de teste cai em "sem visita marcada"',
  destinos.filter(([, d]) => d === 'semMarcacao').length, 0)
eq('T1 (remarcado p/ o futuro) está em "visita futura"',
  destinoMarcacao(por('TESTE 1')), 'aguardando')
eq('T4 (passou sem ninguém registrar) aparece como pendência',
  destinoMarcacao(por('TESTE 4')), 'semRegistro')

console.log(`\n${fail === 0 ? '✅' : '❌'}  ${ok} passaram · ${fail} falharam\n`)
process.exit(fail === 0 ? 0 : 1)

// Regras puras do encaminhamento e do filtro da aba Clientes (sem banco).
//   node scripts/teste-encaminhamento.mjs
import { comEncaminhado, filtroMeusClientes } from '../src/lib/visitRules.js'

let falhas = 0
const t = (nome, cond) => { console.log(`${cond ? '✓' : '✗'} ${nome}`); if (!cond) falhas++ }
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b)

// comEncaminhado
t('cliente sem lista → lista com a pessoa',        igual(comEncaminhado({}, 'mafe'), ['mafe']))
t('cliente com lista null → lista com a pessoa',   igual(comEncaminhado({ encaminhado_para: null }, 'mafe'), ['mafe']))
t('acrescenta no fim, sem perder quem já estava',  igual(comEncaminhado({ encaminhado_para: ['amanda'] }, 'mafe'), ['amanda', 'mafe']))
t('já está na lista → null (nada a gravar)',       comEncaminhado({ encaminhado_para: ['mafe'] }, 'mafe') === null)
t('sem pessoa → null',                             comEncaminhado({ encaminhado_para: [] }, null) === null)
t('não muda o objeto original',                    (() => { const c = { encaminhado_para: ['a'] }; comEncaminhado(c, 'b'); return c.encaminhado_para.length === 1 })())

// filtroMeusClientes
t('gerente → sem filtro',                          filtroMeusClientes('gerente', 'u1') === null)
t('papel desconhecido → sem filtro',               filtroMeusClientes(undefined, 'u1') === null)
t('sem usuário → sem filtro',                      filtroMeusClientes('pre_vendas', null) === null)
t('pré-vendas: carteira + cadastrados + encaminhados',
  filtroMeusClientes('pre_vendas', 'u1') === 'dono_id.eq.u1,created_by.eq.u1,encaminhado_para.cs.{u1}')
t('vendedor: idem + atribuídos',
  filtroMeusClientes('vendedor', 'u1') === 'assigned_to.eq.u1,dono_id.eq.u1,created_by.eq.u1,encaminhado_para.cs.{u1}')

console.log(falhas ? `\n${falhas} falha(s)` : '\nTudo certo (11 testes).')
process.exit(falhas ? 1 : 0)

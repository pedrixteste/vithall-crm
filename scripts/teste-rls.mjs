// TESTE DA TRAVA (RLS por dono) — vira cada pessoa da equipe por SQL, sem
// senha, e confere o que ela enxerga contra a regra escrita AQUI (independente
// das funções do banco). Também tenta o que NÃO pode (mexer em cliente alheio,
// cadastrar em nome de outro, apagar) com clientes de teste descartáveis.
//
//   node scripts/teste-rls.mjs            (depois das etapas 1 e 2)
//   node scripts/teste-rls.mjs --antes    (antes: mostra o buraco, vai falhar)
//   node scripts/teste-rls.mjs --so-leitura   (só a parte 1: não cria nada)
//
// Técnica: set_config('request.jwt.claims', {sub: <id>}) + set role authenticated
// faz o Postgres tratar a sessão como aquela pessoa (auth.uid() e as políticas
// obedecem). Provado em 04/09/26. Não toca em nenhum cliente real: os clientes
// de teste nascem e morrem aqui, com o gatilho da planilha desligado.
import { query } from './db-cli.mjs'

const ANTES = process.argv.includes('--antes')
let falhas = 0, total = 0
const ok = (cond, msg, detalhe = '') => {
  total++
  console.log(`  ${cond ? '✓' : '✗'} ${msg}${!cond && detalhe ? `  → ${detalhe}` : ''}`)
  if (!cond) falhas++
}
const claims = (id) => `select set_config('request.jwt.claims', '${JSON.stringify({ sub: id, role: 'authenticated' })}', false);`
const como = (id, sql) => query(`${claims(id)}\nset role authenticated;\n${sql}`)
const comoPostgres = (id, sql) => query(`${claims(id)}\n${sql}`)

// ── A regra, escrita de novo aqui (não usa eh_gerente/cliente_visivel) ────
const temColuna = query(`select exists (select 1 from information_schema.columns where table_schema='public' and table_name='clients' and column_name='encaminhado_para') as ok`)[0].ok
const G = `exists (select 1 from profiles pg where pg.id = auth.uid() and pg.role = 'gerente')`
const P = `(${G}
  or c.created_by = auth.uid() or c.dono_id = auth.uid() or c.assigned_to = auth.uid()
  or c.visit_scheduled_by = auth.uid() or c.visit_first_booked_by = auth.uid() or c.repescagem_by = auth.uid()
  ${temColuna ? 'or auth.uid() = any (c.encaminhado_para)' : ''}
  or exists (select 1 from matricula_credits m2 where m2.client_id = c.id and (m2.credited_to = auth.uid() or m2.enrolled_by = auth.uid())))`
const CV = (col) => `exists (select 1 from clients c where c.id = ${col} and ${P})`

const perfis = query(`select id, name, role from profiles order by role, name`)
const totais = query(`select (select count(*) from clients)::int as clientes, (select count(*) from visits)::int as visitas,
  (select count(*) from client_history)::int as historico, (select count(*) from tasks)::int as tarefas,
  (select count(*) from matricula_credits)::int as creditos, (select count(*) from callbacks)::int as ligar_depois`)[0]
console.log(`\nBase: ${totais.clientes} clientes · ${totais.visitas} visitas · ${totais.historico} histórico · ${totais.tarefas} tarefas · ${totais.creditos} créditos · ${totais.ligar_depois} ligar-depois${ANTES ? '   [modo ANTES da trava]' : ''}\n`)

// ── 1. O que cada pessoa vê × o que deveria ver ─────────────────────────
console.log('1) Visão de cada pessoa (política × regra escrita aqui × cliente_visivel)')
const tabela = []
for (const p of perfis) {
  const visto = como(p.id, `
    select (select count(*) from clients)::int as clientes,
           (select coalesce(string_agg(id::text, ',' order by id), '') from clients) as ids,
           (select count(*) from visits)::int as visitas,
           (select count(*) from client_history)::int as historico,
           (select count(*) from tasks)::int as tarefas,
           (select count(*) from matricula_credits)::int as creditos,
           (select count(*) from callbacks)::int as ligar_depois,
           (select count(*) from clients where public.cliente_visivel(id))::int as via_funcao;`)[0]
  const esperado = comoPostgres(p.id, `
    select (select count(*) from clients c where ${P})::int as clientes,
           (select coalesce(string_agg(c.id::text, ',' order by c.id), '') from clients c where ${P}) as ids,
           (select count(*) from visits v where ${CV('v.client_id')})::int as visitas,
           (select count(*) from client_history h where ${G} or h.user_id = auth.uid() or ${CV('h.client_id')})::int as historico,
           -- gerente vê TODAS as tarefas, inclusive as soltas (sem cliente) dos outros — como hoje
           (select count(*) from tasks t where ${G} or t.seller_id = auth.uid() or ${CV('t.client_id')})::int as tarefas,
           (select count(*) from matricula_credits m where ${G} or m.credited_to = auth.uid() or m.enrolled_by = auth.uid() or ${CV('m.client_id')})::int as creditos,
           (select count(*) from callbacks k where ${G} or k.created_by = auth.uid())::int as ligar_depois,
           (select count(*) from clients c where ${P} and public.cliente_visivel(c.id))::int as via_funcao;`)[0]
  const campos = ['clientes', 'visitas', 'historico', 'tarefas', 'creditos', 'ligar_depois']
  const difs = campos.filter(k => visto[k] !== esperado[k]).map(k => `${k} ${visto[k]}≠${esperado[k]}`)
  const idsOk = visto.ids === esperado.ids
  const funcOk = visto.via_funcao === esperado.clientes && esperado.via_funcao === esperado.clientes
  ok(difs.length === 0 && idsOk, `${p.name} (${p.role}): vê ${visto.clientes} clientes, ${visto.visitas} visitas, ${visto.tarefas} tarefas, ${visto.creditos} créditos, ${visto.ligar_depois} ligar-depois`,
     difs.join(', ') || 'ids diferentes')
  ok(funcOk, `${p.name}: cliente_visivel() bate com a política e com a regra`, `${visto.via_funcao} / ${esperado.via_funcao} / ${esperado.clientes}`)
  if (p.role === 'gerente') ok(visto.clientes === totais.clientes, `${p.name} (gerente) vê a base inteira`)
  tabela.push({ pessoa: p.name, papel: p.role, clientes: visto.clientes, visitas: visto.visitas, tarefas: visto.tarefas, creditos: visto.creditos, ligar_depois: visto.ligar_depois })
}
console.table(tabela)

// ── 2. O que NÃO pode — com clientes descartáveis ──────────────────────
if (process.argv.includes('--so-leitura')) { console.log('2) (pulado: --so-leitura)'); fim() }
console.log('2) Tentativas proibidas (clientes de teste, apagados no fim)')
const amanda = perfis.find(p => p.name === 'Amanda'), mafe = perfis.find(p => p.name === 'Mafê')
const gabi = perfis.find(p => p.role === 'gerente' && p.name !== 'pedro'), vend = perfis.find(p => p.role === 'vendedor')
const zero = perfis.find(p => p.name === 'pedrohggehlen')
if (!amanda || !mafe || !gabi) { console.log('  (equipe diferente do esperado — pulei)'); fim() }

const ids = query(`
  alter table public.clients disable trigger clients_sheet_mirror;
  insert into public.clients (company_name, contact_name, phone, created_by, matricula_stage)
  values ('TESTE RLS A', 'TESTE RLS A', '(51) 90000-0001', '${amanda.id}', 'nao_marcou'),
         ('TESTE RLS G', 'TESTE RLS G', '(51) 90000-0002', '${gabi.id}',   'nao_marcou')
  returning id, contact_name;`)
const A = ids.find(r => r.contact_name === 'TESTE RLS A').id, Gc = ids.find(r => r.contact_name === 'TESTE RLS G').id
const criados = [A, Gc]
try {
  const n = (sql, quem = amanda.id) => como(quem, sql)[0].n

  ok(n(`select count(*)::int as n from clients where id in ('${A}','${Gc}')`) === 1, 'Amanda vê o dela e NÃO vê o da Gabi')
  ok(n(`with u as (update clients set notes = 'x' where id = '${Gc}' returning 1) select count(*)::int as n from u`) === 0, 'Amanda tenta alterar cliente da Gabi → 0 linhas')
  ok(n(`with u as (update clients set notes = 'ok' where id = '${A}' returning 1) select count(*)::int as n from u`) === 1, 'Amanda altera o próprio → 1 linha')
  ok(n(`with u as (update clients set assigned_to = '${vend?.id || gabi.id}' where id = '${A}' returning 1) select count(*)::int as n from u`) === 1, 'Amanda passa o próprio cliente para um vendedor → permitido (sem 403)')
  ok(n(`select count(*)::int as n from clients where id = '${A}'`) === 1, '…e continua vendo (cadastrou)')
  // Apagar: a política deixa só gerente — e o papel authenticated nem tem
  // GRANT DELETE em clients, então o banco barra antes (permission denied).
  // Qualquer um dos dois é "não pode".
  let del = null
  try { del = n(`with u as (delete from clients where id = '${A}' returning 1) select count(*)::int as n from u`) }
  catch (e) { del = /permission denied/i.test(e.message) ? 'negado' : e.message }
  ok(del === 0 || del === 'negado', 'Amanda tenta apagar → barrado', String(del).slice(0, 120))

  let erro = ''
  try { como(amanda.id, `insert into clients (company_name, created_by) values ('TESTE RLS X', '${gabi.id}') returning id;`) }
  catch (e) { erro = e.message }
  ok(/row-level security/i.test(erro), 'Amanda cadastra em nome da Gabi → recusado', erro.slice(0, 120))
  erro = ''
  try { como(amanda.id, `insert into visits (client_id, visit_date) values ('${Gc}', current_date) returning id;`) }
  catch (e) { erro = e.message }
  ok(/row-level security/i.test(erro), 'Amanda cria visita em cliente da Gabi → recusado', erro.slice(0, 120))
  // C nasce com o MESMO telefone do cliente da Gabi: é o caso do contato repetido
  const novo = como(amanda.id, `insert into clients (company_name, contact_name, phone, created_by) values ('TESTE RLS C', 'TESTE RLS C', '(51) 90000-0002', '${amanda.id}') returning id;`)
  ok(novo.length === 1, 'Amanda cadastra em nome próprio → ok')
  if (novo[0]?.id) criados.push(novo[0].id)

  if (temColuna) {
    ok(n(`select count(*)::int as n from clients where id = '${A}'`, mafe.id) === 0, 'Mafê ainda não vê o cliente da Amanda')
    ok(n(`with u as (update clients set encaminhado_para = array['${mafe.id}']::uuid[] where id = '${A}' returning 1) select count(*)::int as n from u`) === 1, 'Amanda encaminha para a Mafê')
    ok(n(`select count(*)::int as n from clients where id = '${A}'`, mafe.id) === 1, 'Mafê passou a ver (encaminhado_para)')
    ok(n(`select count(*)::int as n from clients where encaminhado_para @> array['${mafe.id}']::uuid[]`, mafe.id) === 1, 'Filtro da aba Clientes (cs) acha o encaminhado')
  }
  if (zero) {
    ok(n(`select count(*)::int as n from clients`, zero.id) === 0, 'pedrohggehlen (0 clientes) vê 0 — e sem trava de avaliação')
  }

  // RPCs do 📞ˣ: contam a base toda sem entregar ficha alheia.
  // "(51) 90000-0002" → 11 dígitos: 51900000002 (o DDD entra na chave).
  const cont = como(amanda.id, `select public.contato_contagem(array['51900000002']) as n;`)[0].n
  ok(cont === 2, 'contato_contagem: o número repetido (Gabi + Amanda) conta 2 na base toda', String(cont))
  const hist = como(amanda.id, `select visivel, dono, registro->>'contact_name' as nome, registro->>'phone' as fone from public.contato_historico(array['51900000002']) order by visivel;`)
  ok(hist.length === 2, 'contato_historico do número repetido → 2 registros para a Amanda', JSON.stringify(hist))
  const alheio = hist.find(h => h.visivel === false), meu = hist.find(h => h.visivel === true)
  ok(!!alheio && alheio.dono === gabi.name && alheio.nome == null && alheio.fone == null, 'registro da Gabi vem SEM ficha (só data e "de quem é")', JSON.stringify(alheio))
  ok(!!meu && meu.nome === 'TESTE RLS C', 'registro da própria Amanda vem completo', JSON.stringify(meu))
  const histA = como(amanda.id, `select visivel from public.contato_historico(array['51900000001']);`)
  ok(histA.length === 1 && histA[0].visivel === true, 'contato_historico do próprio número → 1 registro visível', JSON.stringify(histA))
  const joice = perfis.find(p => p.name === 'Joice')
  if (joice) {
    const hj = como(joice.id, `select count(*)::int as n from public.contato_historico(array['51900000002']);`)[0].n
    ok(hj === 0, 'Joice (não tem esse contato) → contato_historico vazio: não dá para pescar números', String(hj))
  }
  const cc = como(amanda.id, `select count(*)::int as n from public.contato_contagens();`)[0].n
  const vis = como(amanda.id, `select count(*)::int as n from clients;`)[0].n
  ok(cc === vis, 'contato_contagens devolve uma linha por cliente visível', `${cc} ≠ ${vis}`)
} finally {
  const r = query(`
    delete from public.client_history where client_id in (${criados.map(i => `'${i}'`).join(',')});
    delete from public.visits where client_id in (${criados.map(i => `'${i}'`).join(',')});
    delete from public.clients where id in (${criados.map(i => `'${i}'`).join(',')});
    alter table public.clients enable trigger clients_sheet_mirror;
    select (select count(*) from public.clients where contact_name like 'TESTE RLS%')::int as restantes,
           (select tgenabled from pg_trigger where tgname = 'clients_sheet_mirror') as gatilho;`)[0]
  ok(r.restantes === 0 && r.gatilho === 'O', 'Clientes de teste apagados e gatilho da planilha religado', JSON.stringify(r))
}
fim()

function fim() {
  console.log(falhas ? `\n${falhas} de ${total} verificações FALHARAM.` : `\nTudo certo: ${total} verificações.`)
  process.exit(falhas ? 1 : 0)
}

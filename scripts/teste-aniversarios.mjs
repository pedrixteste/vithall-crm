// Regras puras dos aniversários e do calendário (sem banco).
//   node scripts/teste-aniversarios.mjs
import {
  parseAniversario, formataAniversario, idadeEm, ehAniversarioEm,
  anosVithallEm, ehVithallEm, datasEspeciais, diasJanela,
  aniversariosNaJanela, eventosDoMes, rotuloEvento, somaDias,
} from '../src/lib/aniversarios.js'

let falhas = 0
const t = (nome, cond) => { console.log(`${cond ? '✓' : '✗'} ${nome}`); if (!cond) falhas++ }
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b)

// parse / formata
t('vazio limpa',                    igual(parseAniversario('  '), { ok: true, dia: null, mes: null, ano: null }))
t('15/03 sem ano',                  igual(parseAniversario('15/03'), { ok: true, dia: 15, mes: 3, ano: null }))
t('15/3/1980',                      igual(parseAniversario('15/3/1980'), { ok: true, dia: 15, mes: 3, ano: 1980 }))
t('ano com 2 dígitos (80 → 1980)',  parseAniversario('15/03/80').ano === 1980)
t('ano com 2 dígitos (05 → 2005)',  parseAniversario('15/03/05').ano === 2005)
t('aceita ponto e traço',           parseAniversario('15.03-1980').ok === true)
t('31/02 é inválido',               parseAniversario('31/02').ok === false)
t('29/02 sem ano vale',             parseAniversario('29/02').ok === true)
t('29/02/1999 não vale',            parseAniversario('29/02/1999').ok === false)
t('29/02/2000 vale',                parseAniversario('29/02/2000').ok === true)
t('texto solto é inválido',         parseAniversario('março').ok === false)
t('mês 13 é inválido',              parseAniversario('01/13').ok === false)
t('formata com ano',                formataAniversario({ aniversario_dia: 5, aniversario_mes: 9, nascimento_ano: 1990 }) === '05/09/1990')
t('formata sem ano',                formataAniversario({ aniversario_dia: 5, aniversario_mes: 9 }) === '05/09')
t('formata vazio',                  formataAniversario({}) === '')

// idade
const jonas = { contact_name: 'Jonas', company_name: 'Loja', aniversario_dia: 7, aniversario_mes: 9, nascimento_ano: 1985 }
t('idade no dia do aniversário',    idadeEm(jonas, '2026-09-07') === 41)
t('idade um dia antes',             idadeEm(jonas, '2026-09-06') === 40)
t('sem ano → idade null',           idadeEm({ aniversario_dia: 7, aniversario_mes: 9 }, '2026-09-07') === null)
t('faz aniversário hoje',           ehAniversarioEm(jonas, '2026-09-07'))
t('não faz amanhã',                 !ehAniversarioEm(jonas, '2026-09-08'))
t('29/02 cai em 28/02 no ano comum', ehAniversarioEm({ aniversario_dia: 29, aniversario_mes: 2 }, '2027-02-28'))
t('29/02 fica em 29/02 no bissexto', ehAniversarioEm({ aniversario_dia: 29, aniversario_mes: 2 }, '2028-02-29') && !ehAniversarioEm({ aniversario_dia: 29, aniversario_mes: 2 }, '2028-02-28'))

// vithall
const maria = { contact_name: 'Maria', company_name: 'Imob', aniversario_vithall: '2024-09-07' }
t('2 anos de Vithall',              anosVithallEm(maria, '2026-09-07') === 2)
t('é aniversário Vithall hoje',     ehVithallEm(maria, '2026-09-07'))
t('no ano da matrícula não é',      !ehVithallEm(maria, '2024-09-07'))
t('outro dia não é',                !ehVithallEm(maria, '2026-09-08'))

// datas especiais
const d2026 = datasEspeciais(2026)
const acha = (nome) => d2026.find(x => x.nome === nome)?.data
t('Páscoa 2026 = 05/04',            acha('Páscoa') === '2026-04-05')
t('Carnaval 2026 = 17/02',          acha('Carnaval') === '2026-02-17')
t('Sexta Santa 2026 = 03/04',       acha('Sexta-feira Santa') === '2026-04-03')
t('Corpus Christi 2026 = 04/06',    acha('Corpus Christi') === '2026-06-04')
t('Dia das Mães 2026 = 10/05',      acha('Dia das Mães') === '2026-05-10')
t('Dia dos Pais 2026 = 09/08',      acha('Dia dos Pais') === '2026-08-09')
t('Dia das Mães 2027 = 09/05',      datasEspeciais(2027).find(x => x.nome === 'Dia das Mães').data === '2027-05-09')
t('Farroupilha 20/09',              acha('Revolução Farroupilha') === '2026-09-20')
t('lista em ordem',                 d2026.every((x, i) => i === 0 || d2026[i - 1].data <= x.data))
t('32 datas no ano',                d2026.length === 32)

// janela
t('quarta → hoje + amanhã',         igual(diasJanela('2026-09-09').map(x => x.rotulo), ['hoje', 'amanhã']))
t('sexta → sáb, dom, seg',          igual(diasJanela('2026-09-11').map(x => x.rotulo), ['hoje', 'amanhã', 'domingo', 'segunda']))
t('sábado → dom, seg',              igual(diasJanela('2026-09-12').map(x => x.rotulo), ['hoje', 'amanhã', 'segunda']))
t('somaDias vira o mês',            somaDias('2026-09-30', 1) === '2026-10-01')

const seg = { contact_name: 'Ana', aniversario_dia: 14, aniversario_mes: 9 }
const jan = aniversariosNaJanela([jonas, maria, seg], '2026-09-11') // sexta
t('sexta pega a segunda (14/09)',   jan.some(x => x.client === seg && x.rotulo === 'segunda'))
t('quem não faz não entra',         !jan.some(x => x.client === jonas))
const hoje = aniversariosNaJanela([jonas, maria, seg], '2026-09-07')
t('hoje: idade e vithall separados', hoje.length === 2 && hoje[0].tipo === 'aniversario' && hoje[1].tipo === 'vithall')
t('anos calculados na janela',      hoje[0].anos === 41 && hoje[1].anos === 2)

// mês
const mes = eventosDoMes([jonas, maria, seg], 2026, 9)
t('mês: feriados + aniversários',   mes.filter(e => e.tipo === 'especial').length === 6 && mes.filter(e => e.tipo !== 'especial').length === 3)
t('mês em ordem de dia',            mes.every((x, i) => i === 0 || mes[i - 1].dia <= x.dia))
t('no mesmo dia feriado vem antes', (() => { const d7 = mes.filter(e => e.dia === 7); return d7[0].tipo === 'especial' && d7[1].tipo === 'aniversario' && d7[2].tipo === 'vithall' })())
t('rótulo com idade',               rotuloEvento(mes.find(e => e.tipo === 'aniversario')) === 'Jonas (Loja) · 41 anos')
t('rótulo vithall',                 rotuloEvento(mes.find(e => e.tipo === 'vithall')) === 'Maria (Imob) · 2 anos de Vithall')
t('rótulo sem ano',                 rotuloEvento(mes.find(e => e.client === seg)) === 'Ana')
t('rótulo especial',                rotuloEvento(mes[0]) === 'Dia do Empresário')
t('fevereiro comum não gera 29',    eventosDoMes([{ aniversario_dia: 29, aniversario_mes: 2 }], 2027, 2).every(e => e.dia <= 28))

const total = falhas ? `\n${falhas} falha(s)` : '\nTudo certo.'
console.log(total)
process.exit(falhas ? 1 : 0)

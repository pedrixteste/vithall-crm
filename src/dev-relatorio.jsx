// Bancada de teste visual do bloco novo do relatório — NÃO faz parte do app.
// Usa as MESMAS funções de cálculo que a tela de verdade, com dados de mentira.
// Apagar depois do teste.
import React from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import RelatorioRemarcacoes from './components/RelatorioRemarcacoes'
import {
  remarcacoesNoPeriodo, remarcacoesPorPessoa, remarcacoesAteAMatricula,
  repescagemMetrics, repescagensPorPessoa,
} from './lib/remarcacaoMetrics'
import { destinoMarcacao } from './lib/personMetrics'

const sempre = () => true
const matriculou = (c) => c.matricula_stage === 'matriculado'

// 14 marcações com histórias diferentes — o suficiente para as 4 faixas
const marcacoes = [
  { id: '1', matricula_stage: 'matriculado',    visit_reschedule_count: 0, visits: [{ visit_date: '2026-09-01', rating: 'boa' }] },
  { id: '2', matricula_stage: 'matriculado',    visit_reschedule_count: 0, visits: [{ visit_date: '2026-09-02', rating: 'otima' }] },
  { id: '3', matricula_stage: 'recebeu_visita', visit_reschedule_count: 0, visits: [{ visit_date: '2026-09-02', rating: 'boa' }] },
  { id: '4', matricula_stage: 'cancelado',      visit_reschedule_count: 0, visits: [] },
  { id: '5', matricula_stage: 'nao_marcou',     visit_reschedule_count: 0, visits: [] },
  { id: '6', matricula_stage: 'matriculado',    visit_reschedule_count: 1, visits: [{ visit_date: '2026-09-05', rating: 'boa' }] },
  { id: '7', matricula_stage: 'recebeu_visita', visit_reschedule_count: 1, visits: [{ visit_date: '2026-09-06', rating: 'razoavel' }] },
  { id: '8', matricula_stage: 'cancelado',      visit_reschedule_count: 1, visits: [] },
  { id: '9', matricula_stage: 'nao_apareceu',   visit_reschedule_count: 1, visits: [] },
  { id: '10', matricula_stage: 'cancelado',     visit_reschedule_count: 2, visits: [] },
  { id: '11', matricula_stage: 'nao_apareceu',  visit_reschedule_count: 2, visits: [] },
  { id: '12', matricula_stage: 'recebeu_visita', visit_reschedule_count: 2, visits: [{ visit_date: '2026-09-09', rating: 'boa' }] },
  { id: '13', matricula_stage: 'cancelado',     visit_reschedule_count: 3, visits: [] },
  { id: '14', matricula_stage: 'nao_apareceu',  visit_reschedule_count: 5, visits: [] },
]

const ev = (client_id, user_id, dia, data, tipo = 'visit_scheduled') =>
  ({ client_id, user_id, created_at: `2026-09-${String(dia).padStart(2, '0')}T10:00:00Z`, event_type: tipo, event_data: data })

const bookingEvents = [
  ev('6', 'amanda', 3, { from: 'a', to: 'b' }),
  ev('7', 'amanda', 4, { from: 'a', to: 'b' }),
  ev('8', 'mafe', 5, { from: 'a', to: 'b' }),
  ev('9', 'mafe', 6, { from: 'a', to: 'b' }),
  ev('10', 'mafe', 7, { from: 'a', to: 'b' }),
  ev('10', 'joice', 8, { from: 'b', to: 'c' }),
  ev('11', 'amanda', 9, { from: 'a', to: 'b' }),
  ev('11', 'amanda', 10, { from: 'b', to: 'c' }),
  ev('12', 'joice', 11, { from: 'a', to: 'b' }),
  ev('12', 'joice', 12, { from: 'b', to: 'c' }),
  ev('13', 'mafe', 13, { from: 'a', to: 'b' }),
  ev('14', 'mafe', 14, { from: 'a', to: 'b' }),
]
const repescagemEvents = [
  ev('1', 'amanda', 2, { acao: 'marcada' }, 'repescagem'),
  ev('3', 'amanda', 3, { acao: 'marcada' }, 'repescagem'),
  ev('12', 'mafe', 4, { acao: 'marcada' }, 'repescagem'),
  ev('5', 'mafe', 5, { acao: 'marcada' }, 'repescagem'),
]

const ate = remarcacoesAteAMatricula(marcacoes, matriculou)
const rep = repescagemMetrics({
  repescagemEvents, clientById: (id) => marcacoes.find(c => c.id === id),
  inRange: sempre, recebeuVisita: (c) => destinoMarcacao(c) === 'recebeu', matriculou,
})
const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : null)
const nomes = { amanda: 'Amanda', mafe: 'Mafê', joice: 'Joice' }

function App() {
  return (
    <div style={{ background: '#0A0A0A', minHeight: '100vh', padding: '16px' }}>
      <div style={{ width: '390px', margin: '0 auto' }}>
        <RelatorioRemarcacoes
          totalMarcacoes={marcacoes.length}
          remarcacoes={remarcacoesNoPeriodo(bookingEvents, sempre).length}
          ate={ate}
          rep={rep}
          baseConvVis={pct(marcacoes.filter(c => destinoMarcacao(c) === 'recebeu').length, marcacoes.length)}
          baseConvMat={pct(marcacoes.filter(matriculou).length, marcacoes.length)}
          remarcRanking={remarcacoesPorPessoa(remarcacoesNoPeriodo(bookingEvents, sempre))}
          repRanking={repescagensPorPessoa(repescagemEvents, sempre)}
          nomeDe={(id) => nomes[id] || '—'}
          mostrarRanking
          onInfo={(i) => alert(`${i.title}\n\n${i.text}`)}
        />
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')).render(<App />)

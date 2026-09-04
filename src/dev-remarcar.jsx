// Bancada de teste visual do botão Remarcar — NÃO faz parte do app.
// Roda sem login e sem banco: só desenha o componente com dados de mentira,
// para eu conferir os estados antes de subir. Apagar depois do teste.
import React from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { RemarcarBlock } from './components/RemarcarForm'
import RemarcarForm from './components/RemarcarForm'
import { AuthContext } from './contexts/AuthContext'

const user    = { id: 'u-pedro' }
const profile = { id: 'u-pedro', name: 'pedro', role: 'gerente' }

const vendedores = [
  { id: 'u-pedro', name: 'pedro', role: 'gerente' },
  { id: 'u-vend',  name: 'Gabrielle Lanius', role: 'vendedor' },
]

const base = {
  id: 'x', contact_name: 'Alisson Teste', company_name: 'Padaria do Alisson',
  city: 'Porto Alegre', address_street: 'Av. Brasil', address_number: '100',
  address_neighborhood: 'Centro', address_reference: 'em frente à praça',
  created_by: 'u-pedro', assigned_to: 'u-vend',
}
const daqui = (d) => new Date(Date.now() + d * 86400000).toISOString()

const casos = [
  ['1. Visita marcada (botão CINZA)', { ...base, matricula_stage: 'marcado', visit_scheduled_at: daqui(5) }],
  ['2. Cliente cancelou (LIBERA)',    { ...base, matricula_stage: 'cancelado', visit_scheduled_at: daqui(-2) }],
  ['3. Não apareceu (LIBERA)',        { ...base, matricula_stage: 'nao_apareceu', visit_scheduled_at: daqui(-3) }],
  ['4. Data passou sem registro (LIBERA)', { ...base, matricula_stage: 'marcado', visit_scheduled_at: daqui(-4) }],
  ['5. Sem visita nenhuma (CINZA)',   { ...base, matricula_stage: 'nao_marcou' }],
  ['6. Matriculado (CINZA)',          { ...base, matricula_stage: 'matriculado', visit_scheduled_at: daqui(-9) }],
  ['7. Já remarcado 2x (LIBERA + histórico)', {
    ...base, matricula_stage: 'cancelado', visit_scheduled_at: daqui(-1),
    visit_reschedule_count: 2, remarcado_por: 'u-vend',
    remarcacao_motivo: 'cliente teve imprevisto e pediu para ir na semana que vem',
  }],
]

// Cliente com 3 endereços — para ver o aviso do limite no formulário
const clienteCheio = {
  ...base, matricula_stage: 'cancelado', visit_scheduled_at: daqui(-2),
  enderecos: [
    { id: 'a', rua: 'Av. Brasil', numero: '100', bairro: 'Centro', cidade: 'Porto Alegre', referencia: 'em frente à praça', atual: false },
    { id: 'b', rua: 'Rua das Flores', numero: '55', bairro: 'Sul', cidade: 'Canoas', referencia: 'ao lado do posto', atual: false },
    { id: 'c', rua: 'Av. Nova', numero: '999', bairro: 'Bela Vista', cidade: 'Gravataí', referencia: 'prédio azul', atual: true },
  ],
}

const params = new URLSearchParams(location.search)
const form = params.get('form') // '' | 'novo' | 'cheio'

// O Sheet é um overlay fixo na tela toda; aqui ele precisa entrar no fluxo da
// coluna de 390px para caber no print inteiro
if (form) {
  const st = document.createElement('style')
  st.textContent = `.fixed{position:static!important}.max-w-lg{max-width:390px!important}
    body{background:#0A0A0A}`
  document.head.appendChild(st)
}

function App() {
  return (
    <AuthContext.Provider value={{ user, profile, loading: false }}>
      <div style={{ background: '#0A0A0A', minHeight: '100vh', padding: '16px' }}>
        <div style={{ width: '390px', margin: '0 auto', background: '#0F0F0F', border: '1px solid #222', borderRadius: '16px', padding: '14px' }}>
          {!form && casos.map(([titulo, c]) => (
            <div key={titulo} style={{ marginBottom: '18px', paddingBottom: '14px', borderBottom: '1px dashed #222' }}>
              <p style={{ color: '#C9A84C', fontSize: '11px', fontWeight: 700, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {titulo}
              </p>
              <RemarcarBlock client={c} nomeRemarcador="Gabrielle" onRemarcar={() => {}} />
            </div>
          ))}
          {form && (
            <RemarcarForm
              client={form === 'cheio' ? clienteCheio : { ...base, matricula_stage: 'cancelado', visit_scheduled_at: daqui(-2) }}
              vendedores={vendedores}
              onClose={() => {}}
              onSaved={() => {}}
            />
          )}
        </div>
      </div>
    </AuthContext.Provider>
  )
}

createRoot(document.getElementById('root')).render(<App />)

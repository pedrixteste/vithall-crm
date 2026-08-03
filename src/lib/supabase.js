import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Toda chamada ao Supabase desiste depois deste tempo.
//
// Sem isso, a conexão que o Android congelou quando a pessoa trocou de app
// volta "viva" mas muda: o fetch nunca responde e nunca dá erro, então a tela
// que esperava por ele fica no spinner PARA SEMPRE — era o caso em que só
// matar o app nos 3 riscos resolvia. Com prazo, a consulta falha, o app
// continua de pé e a tela pode tentar de novo.
//
// 12s: as telas fazem consultas em série, então o prazo se soma — com 20s a
// abertura no escuro passava de um minuto, tempo de sobra para a pessoa achar
// que travou e matar o app. Ainda é folgado para a consulta mais pesada
// (Relatórios) numa internet ruim.
const REQUEST_TIMEOUT_MS = 12000

// Modo desconfiado: depois de uma consulta que estourou o prazo, as próximas
// esperam pouco. As telas consultam em SÉRIE, então sem isto uma abertura no
// escuro somava 12s + 12s + 12s... e passava de um minuto — tempo de sobra
// para a pessoa achar que travou e matar o app. Qualquer resposta que chegue
// (a rede voltou) desliga o modo na hora.
const TIMEOUT_DESCONFIADO_MS = 4000
const DESCONFIA_POR_MS = 30000
let ultimaFalhaEm = 0

const prazoAtual = () =>
  Date.now() - ultimaFalhaEm < DESCONFIA_POR_MS ? TIMEOUT_DESCONFIADO_MS : REQUEST_TIMEOUT_MS

function fetchComTimeout(input, init = {}) {
  const ctrl = new AbortController()
  let estourou = false
  const timer = setTimeout(() => { estourou = true; ctrl.abort() }, prazoAtual())

  // Preserva o cancelamento de quem chamou (o auth-js aborta os refreshes dele)
  const sinalDeFora = init.signal
  if (sinalDeFora) {
    if (sinalDeFora.aborted) ctrl.abort()
    else sinalDeFora.addEventListener('abort', () => ctrl.abort(), { once: true })
  }

  return fetch(input, { ...init, signal: ctrl.signal })
    .then(res => { ultimaFalhaEm = 0; return res })          // respondeu: rede de pé
    .catch(err => { if (estourou) ultimaFalhaEm = Date.now(); throw err })
    .finally(() => clearTimeout(timer))
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { fetch: fetchComTimeout },
})

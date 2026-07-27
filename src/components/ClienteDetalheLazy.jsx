import { lazy, Suspense } from 'react'

// A ficha do cliente é de longe a maior tela do app (leva junto o formulário
// de edição e a estrela). Como ela só aparece quando alguém TOCA num cliente,
// não faz sentido baixá-la junto com a lista: em celular fraco isso atrasava
// a abertura de todas as telas.
//
// Aqui ela é carregada sob demanda — e pré-carregada assim que o app fica
// ocioso, para que tocar num cliente continue abrindo na hora.
const carregar = () => import('./ClienteDetalhe')
const ClienteDetalhe = lazy(carregar)

// Pré-carrega em segundo plano, sem disputar com a tela que está aparecendo.
// Roda uma vez só, quando alguma lista que abre fichas é carregada.
if (typeof window !== 'undefined') {
  const agendar = window.requestIdleCallback || (fn => setTimeout(fn, 2000))
  agendar(() => { carregar() })
}

function Carregando() {
  return (
    <div className="flex items-center justify-center" style={{ minHeight: '60vh' }}>
      <div className="w-7 h-7 rounded-full border-2 animate-spin"
        style={{ borderColor: '#C9A84C', borderTopColor: 'transparent' }} />
    </div>
  )
}

export default function ClienteDetalheLazy(props) {
  return (
    <Suspense fallback={<Carregando />}>
      <ClienteDetalhe {...props} />
    </Suspense>
  )
}

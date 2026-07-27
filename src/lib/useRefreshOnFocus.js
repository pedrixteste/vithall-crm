import { useEffect, useRef } from 'react'

// Recarrega os dados quando o app volta para o primeiro plano.
//
// Sem isso, a tela aberta continuava mostrando o que foi buscado ANTES de a
// pessoa bloquear o celular ou trocar de app: se um colega mudasse o estágio,
// confirmasse a visita ou preenchesse a estrela nesse meio tempo, a ficha
// seguia desatualizada até fechar/reabrir o app (que força recarregar) ou
// puxar a tela para atualizar.
//
// Só escuta `visibilitychange` (app volta a aparecer) — não `focus`, que no
// celular dispara também ao abrir o teclado e recarregaria por nada.
const MIN_INTERVALO_MS = 10000

export function useRefreshOnFocus(refresh) {
  // Guarda a função mais recente sem reassinar o listener a cada render
  const refreshRef = useRef(refresh)
  refreshRef.current = refresh

  // Não recarrega se acabou de recarregar: quem fica alternando entre o app e
  // o WhatsApp não dispara uma consulta a cada troca (importante em celular
  // fraco e internet ruim).
  const ultimoRef = useRef(Date.now())

  useEffect(() => {
    function aoVoltar() {
      if (document.visibilityState !== 'visible') return
      const agora = Date.now()
      if (agora - ultimoRef.current < MIN_INTERVALO_MS) return
      ultimoRef.current = agora
      refreshRef.current?.()
    }
    document.addEventListener('visibilitychange', aoVoltar)
    return () => document.removeEventListener('visibilitychange', aoVoltar)
  }, [])
}

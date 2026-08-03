import { lazy } from 'react'

// Carrega uma tela (import dinâmico) sem deixar o app preso.
//
// Duas coisas quebram o carregamento de um pedaço da tela:
//   1. Deploy novo — os arquivos ganham nome novo e os antigos somem. Quem
//      estava com o app aberto pede um arquivo que não existe mais (404) e
//      fica no spinner para sempre.
//   2. Internet ruim na hora exata em que a pessoa trocou de aba.
//
// Em ambos: tenta de novo uma vez e, se falhar, recarrega a página (que traz
// o índice novo). A marca no sessionStorage impede laço de recarga quando a
// causa é a rede — a segunda falha sobe como erro de verdade.
export function lazyWithRetry(carregar, chave) {
  return lazy(async () => {
    try {
      return await carregar()
    } catch (e) {
      try {
        return await carregar()
      } catch (e2) {
        const marca = 'recarga-' + chave
        if (!sessionStorage.getItem(marca)) {
          sessionStorage.setItem(marca, '1')
          window.location.reload()
          return new Promise(() => {}) // segura enquanto a página recarrega
        }
        throw e2
      }
    }
  })
}

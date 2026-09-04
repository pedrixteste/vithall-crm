// ── Endereços do cliente ────────────────────────────────────────────
// Um cliente pode ter até 3 endereços ATIVOS. O app inteiro (link do Google
// Maps, ficha no Google Agenda, CSV, PDF, backup da planilha) continua lendo
// as colunas de sempre — address_street/number/neighborhood/reference e city.
// Elas são o endereço ATUAL; a coluna `enderecos` é a lista ao lado.
//
// Excluir NUNCA apaga: marca `excluido_em`. A planilha-espelho é um retrato
// do estado atual, então o que sai do dado sumiria do backup na noite
// seguinte — e o pedido era justamente poder recuperar depois.

export const MAX_ENDERECOS = 3

const novoId = () =>
  (globalThis.crypto?.randomUUID?.() || `end_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`)

/** Lista completa (ativos + excluídos). Cliente antigo, sem a coluna nova,
 *  ganha o item "principal" montado a partir das colunas de sempre. */
export function enderecosDoCliente(c) {
  const lista = Array.isArray(c?.enderecos) ? c.enderecos : []
  if (lista.length) return lista
  if (!c?.address_street && !c?.city) return []
  return [{
    id:         'principal',
    rua:        c.address_street || '',
    numero:     c.address_number || '',
    bairro:     c.address_neighborhood || '',
    cidade:     c.city || '',
    referencia: c.address_reference || '',
    atual:      true,
    criado_em:  c.created_at || null,
    criado_por: c.created_by || null,
    excluido_em: null,
    excluido_por: null,
  }]
}

export const enderecosAtivos = (c) => enderecosDoCliente(c).filter(e => !e.excluido_em)
export const enderecosExcluidos = (c) => enderecosDoCliente(c).filter(e => e.excluido_em)

/** O endereço que vale hoje — o marcado `atual`, ou o primeiro ativo. */
export const enderecoAtual = (c) => {
  const ativos = enderecosAtivos(c)
  return ativos.find(e => e.atual) || ativos[0] || null
}

export const enderecoTexto = (e) =>
  e ? [e.rua, e.numero, e.bairro, e.cidade].filter(Boolean).join(', ') : ''

/** As colunas de sempre a partir de um item da lista (o espelho do atual). */
export const colunasDoEndereco = (e) => ({
  address_street:       e?.rua || null,
  address_number:       e?.numero || null,
  address_neighborhood: e?.bairro || null,
  address_reference:    e?.referencia || null,
  city:                 e?.cidade || null,
})

const chave = (e) => [e?.rua, e?.numero, e?.bairro, e?.cidade]
  .map(s => (s || '').trim().toLowerCase().replace(/\s+/g, ' '))
  .join('|')

/** Mesmo endereço? Compara rua/número/bairro/cidade ignorando maiúsculas e
 *  espaço sobrando — "Av. Brasil 100" digitado de novo não vira um 2º item. */
export const mesmoEndereco = (a, b) => !!a && !!b && chave(a) === chave(b)

/** Já bateu no teto de 3 ativos? A tela usa isto para pedir qual sai. */
export const noLimite = (c) => enderecosAtivos(c).length >= MAX_ENDERECOS

/**
 * Adiciona um endereço e o torna o atual. Devolve o payload pronto para o
 * update do cliente (lista + colunas espelhadas), ou { erro } quando estoura
 * o limite — a tela resolve o limite ANTES, escolhendo qual excluir.
 * `substituirId` exclui um item na mesma tacada (é o "qual você quer tirar?").
 */
export function adicionarEndereco(c, dados, userId, substituirId = null) {
  const agora = new Date().toISOString()
  let lista = enderecosDoCliente(c).map(e => ({ ...e }))

  if (substituirId) {
    lista = lista.map(e => e.id === substituirId && !e.excluido_em
      ? { ...e, excluido_em: agora, excluido_por: userId || null, atual: false }
      : e)
  }

  const ativos = lista.filter(e => !e.excluido_em)

  // Endereço repetido: só volta a ser o atual, não vira item novo
  const igual = ativos.find(e => mesmoEndereco(e, dados))
  if (igual) {
    lista = lista.map(e => ({ ...e, atual: e.id === igual.id }))
    const atual = lista.find(e => e.id === igual.id)
    return { enderecos: lista, ...colunasDoEndereco(atual), repetido: true }
  }

  if (ativos.length >= MAX_ENDERECOS) {
    return { erro: `Este cliente já tem ${MAX_ENDERECOS} endereços. Escolha qual excluir para adicionar outro.` }
  }

  const novo = {
    id:         novoId(),
    rua:        (dados.rua || '').trim(),
    numero:     (dados.numero || '').trim(),
    bairro:     (dados.bairro || '').trim(),
    cidade:     (dados.cidade || '').trim(),
    referencia: (dados.referencia || '').trim(),
    atual:      true,
    criado_em:  agora,
    criado_por: userId || null,
    excluido_em: null,
    excluido_por: null,
  }
  lista = [...lista.map(e => ({ ...e, atual: false })), novo]
  return { enderecos: lista, ...colunasDoEndereco(novo) }
}

/**
 * Exclui (marca como excluído) um endereço. Se era o atual, o mais recente
 * dos que sobraram assume — e as colunas de sempre acompanham, senão o mapa
 * do cliente continuaria apontando para um endereço que ninguém usa mais.
 */
export function excluirEndereco(c, id, userId, motivo = null) {
  const agora = new Date().toISOString()
  const lista = enderecosDoCliente(c).map(e => ({ ...e }))
  const alvo  = lista.find(e => e.id === id && !e.excluido_em)
  if (!alvo) return { erro: 'Endereço não encontrado.' }
  if (lista.filter(e => !e.excluido_em).length <= 1) {
    return { erro: 'Este é o único endereço do cliente — cadastre outro antes de excluir este.' }
  }

  alvo.excluido_em = agora
  alvo.excluido_por = userId || null
  if (motivo) alvo.excluido_motivo = motivo

  if (alvo.atual) {
    alvo.atual = false
    const restantes = lista.filter(e => !e.excluido_em)
    const proximo = restantes[restantes.length - 1]
    if (proximo) proximo.atual = true
    return { enderecos: lista, ...colunasDoEndereco(proximo) }
  }
  return { enderecos: lista }
}

/** Torna um endereço já cadastrado o atual (sem criar item novo). */
export function tornarAtual(c, id) {
  const lista = enderecosDoCliente(c).map(e => ({ ...e, atual: e.id === id }))
  const atual = lista.find(e => e.id === id)
  if (!atual || atual.excluido_em) return { erro: 'Endereço não disponível.' }
  return { enderecos: lista, ...colunasDoEndereco(atual) }
}

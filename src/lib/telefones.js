// ── Telefones do cliente ────────────────────────────────────────────
// O principal fica em `clients.phone`/`phone_type`; os outros na lista
// `clients.phones` como { n: número, t: pessoal|empresa, d: de quem é }.
// `d` é novo (04/09/26): texto curto dizendo de quem é aquele número — da
// esposa, do sócio, da recepção. Número antigo sem `d` continua funcionando.
// Com extensão: assim este módulo também carrega direto no Node, que é o que
// permite testar as regras sem subir o app (scripts/teste-remarcacao.mjs)
import { allPhones, phoneDigits, MAX_PHONES } from './utils.js'

// Teto de caracteres do "de quem é". Curto de propósito: a ficha mostra isso
// numa linha só, e texto comprido vira poluição na tela do celular.
export const MAX_DONO = 24

/** "(51) 99999-9999 · da esposa" — o rótulo de um número na ficha. */
export const telefoneTexto = (p) =>
  p ? `${p.n}${p.d ? ` · ${p.d}` : ''}` : ''

/** Já tem o número máximo? A tela usa isto para pedir qual sai. */
export const telefonesNoLimite = (c) => allPhones(c).length >= MAX_PHONES

/**
 * O cliente trocou de número: o novo vira o PRINCIPAL e o antigo desce para a
 * lista, guardando de quem ele era. Devolve o payload pronto para o update
 * (phone, phone_type, phones) ou { erro } quando estoura o limite.
 *
 * `substituirN` é o número (como está na ficha) que sai para o novo entrar —
 * a tela só pergunta isso quando já está no teto.
 *
 * `phone2` (coluna antiga, de antes da lista) é absorvido e zerado aqui: ele
 * já entra em allPhones, então deixá-lo preenchido duplicaria o número.
 */
export function trocarTelefone(client, { numero, tipo = 'pessoal', dono = '' }, substituirN = null) {
  const novo = (numero || '').trim()
  if (!novo) return { erro: 'Informe o número novo.' }

  const chave = phoneDigits(novo)
  if (chave.length < 8) return { erro: 'Número muito curto — confira antes de salvar.' }

  let atuais = allPhones(client)

  // Já é um número deste cliente: só sobe para principal, não duplica
  const jaExiste = atuais.find(p => phoneDigits(p.n) === chave)

  if (substituirN) {
    const chaveSai = phoneDigits(substituirN)
    atuais = atuais.filter(p => phoneDigits(p.n) !== chaveSai)
  }

  if (!jaExiste && atuais.length >= MAX_PHONES) {
    return { erro: `Este cliente já tem ${MAX_PHONES} números. Escolha qual sai para entrar o novo.` }
  }

  // O novo assume o principal; todo o resto (inclusive o principal antigo)
  // desce para a lista, na ordem em que estava. A descrição ANDA JUNTO com o
  // número: a do principal mora em `phone_desc` (coluna solta), a dos outros
  // no campo `d` de cada item — sem isso o "de quem é" que a pessoa acabou de
  // digitar era jogado fora na hora de salvar.
  const resto = atuais.filter(p => phoneDigits(p.n) !== chave)
  const desc = (dono || '').trim().slice(0, MAX_DONO)
  return {
    phone:       novo,
    phone_type:  tipo,
    phone_desc:  desc || (jaExiste ? jaExiste.d : null) || null,
    phone2:      null,
    phones:      resto.map(p => ({ n: p.n, t: p.t || 'pessoal', ...(p.d ? { d: p.d } : {}) })),
    ...(jaExiste ? { repetido: true } : {}),
  }
}

/**
 * Muda só o "de quem é" de um número já cadastrado (o lápis da ficha).
 * Devolve o payload do update ou { erro }.
 */
export function definirDono(client, numeroAlvo, dono) {
  const chave = phoneDigits(numeroAlvo)
  const d = (dono || '').trim().slice(0, MAX_DONO)
  const atuais = allPhones(client)
  if (!atuais.some(p => phoneDigits(p.n) === chave)) return { erro: 'Número não encontrado.' }

  // O principal não tem onde guardar a descrição (é coluna solta), então ele
  // entra na lista junto com os outros, sem sair de principal
  const [principal, ...extras] = atuais
  if (phoneDigits(principal.n) === chave) {
    return { erro: 'O número principal não tem descrição — ela é dos números adicionais.' }
  }
  return {
    phone2: null,
    phones: extras.map(p => ({
      n: p.n,
      t: p.t || 'pessoal',
      ...((phoneDigits(p.n) === chave ? d : p.d) ? { d: phoneDigits(p.n) === chave ? d : p.d } : {}),
    })),
  }
}

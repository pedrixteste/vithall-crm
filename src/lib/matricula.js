// Situação da matrícula de um cliente matriculado:
//   'efetivada' (padrão, coluna nula) · 'pendente' · 'cancelada'
// Só a EFETIVADA conta nos números — pendente ainda não é matrícula, e a
// cancelada (desistência com/sem reembolso) sai retroativamente de todo mundo:
// vendedor, quem marcou e participantes. Os créditos de comissão ficam no
// banco (congelados), então reativar devolve tudo sem perder rastro.
export const matriculaStatus = (c) => c?.matricula_status || 'efetivada'

export const matriculaConta = (c) =>
  c?.matricula_stage === 'matriculado' && matriculaStatus(c) === 'efetivada'

// Crédito de comissão vale só se a matrícula do cliente está efetivada.
// Cliente não carregado (fora da carteira) → mantém, pra não sumir por engano.
export const creditoConta = (client) => !client || matriculaStatus(client) === 'efetivada'

export const REEMBOLSO_LABEL = {
  sim:     'Reembolso integral',
  parcial: 'Reembolso parcial',
  nao:     'Sem reembolso',
}

export function reembolsoTexto(c) {
  const r = c?.matricula_reembolso
  if (!r) return null
  const base = REEMBOLSO_LABEL[r] || r
  return r === 'parcial' && c.matricula_reembolso_valor ? `${base} (R$ ${c.matricula_reembolso_valor})` : base
}

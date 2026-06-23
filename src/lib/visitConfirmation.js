import { supabase } from './supabase'

// Faixa do dia de hoje (local) + label amigável. Usado pela aba "Hoje"
// e pelo pop-up, garantindo a mesma lista nos dois.
export function getTodayRange() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return {
    start: `${y}-${m}-${d}T00:00:00`,
    end:   `${y}-${m}-${d}T23:59:59`,
    label: now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }),
  }
}

// Visitas agendadas para HOJE (a agenda do dia). Só faz sentido para quem
// FAZ visita: vendedor (as atribuídas a ele) e gerente (todas).
// Pré-vendas não tem agenda de visitas → retorna [].
export async function fetchTodayVisits(role, userId) {
  if (role !== 'vendedor' && role !== 'gerente') return []
  const { start, end } = getTodayRange()
  let q = supabase
    .from('clients')
    .select('*')
    .not('visit_scheduled_at', 'is', null)
    .gte('visit_scheduled_at', start)
    .lte('visit_scheduled_at', end)
    .order('visit_scheduled_at', { ascending: true })
  if (role === 'vendedor') q = q.eq('assigned_to', userId)
  // gerente: vê todas
  const { data } = await q
  return data || []
}

// Visitas que o usuário MARCOU (created_by) e ainda não confirmou,
// agendadas para HOJE ou AMANHÃ. Mesma fonte usada pelo pop-up (Dashboard)
// e pela aba "Hoje" — assim os dois mostram sempre o mesmo conteúdo.
export async function fetchVisitsToConfirm(userId) {
  if (!userId) return []

  const start = new Date()
  start.setHours(0, 0, 0, 0) // hoje 00:00
  const end = new Date()
  end.setDate(end.getDate() + 1)
  end.setHours(23, 59, 59, 999) // amanhã 23:59

  const { data } = await supabase
    .from('clients')
    .select('id, contact_name, company_name, city, visit_scheduled_at, visit_confirmation')
    .eq('created_by', userId)
    .not('visit_scheduled_at', 'is', null)
    .is('visit_confirmation', null)
    .gte('visit_scheduled_at', start.toISOString())
    .lte('visit_scheduled_at', end.toISOString())
    .order('visit_scheduled_at', { ascending: true })

  return data || []
}

import { supabase } from './supabase'

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

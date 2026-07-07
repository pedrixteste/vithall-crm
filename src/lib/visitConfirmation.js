import { supabase } from './supabase'

// Faixa de um dia (local) + label amigável. offset 0 = hoje, 1 = amanhã, etc.
export function getDayRange(offset = 0) {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return {
    start: `${y}-${m}-${day}T00:00:00`,
    end:   `${y}-${m}-${day}T23:59:59`,
    label: d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }),
  }
}

export const getTodayRange = () => getDayRange(0)

// Visitas agendadas para um dia (offset). Só para quem FAZ visita:
// vendedor (atribuídas a ele) e gerente (todas). Pré-vendas → [].
export async function fetchVisitsForDay(role, userId, offset = 0) {
  if (role !== 'vendedor' && role !== 'gerente') return []
  const { start, end } = getDayRange(offset)
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

// Atalho usado pelo Dashboard (agenda de hoje)
export const fetchTodayVisits = (role, userId) => fetchVisitsForDay(role, userId, 0)

// Ligações a fazer num dia (offset): clientes em "pediu_ligar" cujo call_back_at
// cai nesse dia. Filtrado por dono: pré-vendas (created_by), vendedor (assigned_to),
// gerente (todas).
export async function fetchCallbacksForDay(role, userId, offset = 0) {
  const { start, end } = getDayRange(offset)
  let q = supabase
    .from('clients')
    .select('*')
    .eq('matricula_stage', 'pediu_ligar')
    .not('call_back_at', 'is', null)
    .gte('call_back_at', start)
    .lte('call_back_at', end)
    .order('call_back_at', { ascending: true })
  if (role === 'vendedor')        q = q.eq('assigned_to', userId)
  else if (role === 'pre_vendas') q = q.eq('created_by', userId)
  // gerente: vê todas
  const { data } = await q
  return data || []
}

// Uma visita está "avaliada" (estrela completa) — mesma regra que o app usa
// para deixar a visita "verde" no painel de avaliação.
export function isVisitRated(v) {
  const hasTraining = Array.isArray(v.outcome_training)
    ? v.outcome_training.length > 0
    : !!v.outcome_training
  return !!(
    v.rating && v.visit_outcome && v.visit_notes?.trim() &&
    (v.visit_possibilities || []).length > 0 &&
    (v.visit_outcome !== 'matriculada' || hasTraining)
  )
}

// Data (UTC) no formato YYYY-MM-DD — mesmo formato que a tabela visits usa
// (visit_date é criado via toISOString().split('T')[0]).
const utcDateStr = (d = new Date()) => new Date(d).toISOString().split('T')[0]

// Visitas REALIZADAS (de ontem para trás) que ainda não foram avaliadas por
// completo, dos clientes atribuídos ao usuário. Enquanto houver alguma, a aba
// "Hoje" fica bloqueada para vendedor/gerente. Retorna a lista de clientes
// pendentes (mais antigos primeiro), cada um com pendingCount e oldestDate.
export async function fetchPendingRatings(userId) {
  if (!userId) return []
  const todayStr = utcDateStr()

  const { data: clients } = await supabase
    .from('clients')
    .select('id, contact_name, company_name, city, visit_scheduled_at, assigned_to')
    .eq('assigned_to', userId)
  if (!clients || clients.length === 0) return []

  const ids = clients.map(c => c.id)
  const { data: visits } = await supabase.from('visits').select('*').in('client_id', ids)

  const byClient = {}
  for (const v of visits || []) (byClient[v.client_id] ||= []).push(v)

  const pending = []
  for (const c of clients) {
    const cv = byClient[c.id] || []
    // registros de visita passados com estrela incompleta
    const incompletePast = cv.filter(v => v.visit_date && v.visit_date < todayStr && !isVisitRated(v))
    // visita agendada que já passou e ainda nem tem registro (nunca foi aberta)
    let missingScheduled = false
    let schedDate = null
    if (c.visit_scheduled_at) {
      schedDate = utcDateStr(c.visit_scheduled_at)
      if (schedDate < todayStr && !cv.some(v => v.visit_date === schedDate)) missingScheduled = true
    }
    if (incompletePast.length > 0 || missingScheduled) {
      const dates = incompletePast.map(v => v.visit_date)
      if (missingScheduled) dates.push(schedDate)
      dates.sort()
      pending.push({ ...c, pendingCount: incompletePast.length + (missingScheduled ? 1 : 0), oldestDate: dates[0] })
    }
  }
  pending.sort((a, b) => (a.oldestDate || '').localeCompare(b.oldestDate || ''))
  return pending
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

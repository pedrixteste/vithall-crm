import { supabase } from './supabase'
import { localDateStr, reminderDates } from './utils'

// Faixa de um dia (local) + label amigável. offset 0 = hoje, 1 = amanhã, etc.
export function getDayRange(offset = 0) {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  // Limites do dia LOCAL convertidos p/ ISO (UTC) — o Postgres compara
  // timestamptz em UTC, então mandar string sem fuso deslocava a janela em 3h
  const start = new Date(d); start.setHours(0, 0, 0, 0)
  const end   = new Date(d); end.setHours(23, 59, 59, 999)
  return {
    start: start.toISOString(),
    end:   end.toISOString(),
    label: d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }),
  }
}

export const getTodayRange = () => getDayRange(0)

// Quantos dias à frente o "amanhã útil" alcança. Ninguém trabalha no fim de
// semana, então na SEXTA a janela vai até segunda (3 dias); sábado → 2; resto → 1.
// Usado nas confirmações de visita e nos lembretes da aba Hoje.
export function daysAheadWindow(d = new Date()) {
  const dow = d.getDay() // 0=dom, 5=sex, 6=sáb
  if (dow === 5) return 3
  if (dow === 6) return 2
  return 1
}

// Visita "tratada" por quem marcou: confirmada ou tentativa. Sem resposta
// (null) ou nao_confirmada → NÃO aparece na agenda do vendedor/gerente.
export const isVisitTreated = (c) =>
  c.visit_confirmation === 'confirmada' || c.visit_confirmation === 'tentativa'

// Visitas agendadas para um dia (offset). Só para quem FAZ visita:
// vendedor (atribuídas a ele) e gerente (todas). Pré-vendas → [].
// Só retorna visitas TRATADAS (confirmada/tentativa) — ver isVisitTreated.
export async function fetchVisitsForDay(role, userId, offset = 0) {
  if (role !== 'vendedor' && role !== 'gerente') return []
  const { start, end } = getDayRange(offset)
  let q = supabase
    .from('clients')
    .select('*')
    .not('visit_scheduled_at', 'is', null)
    .in('visit_confirmation', ['confirmada', 'tentativa'])
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

// Data LOCAL YYYY-MM-DD — mesma convenção usada ao gravar visits.visit_date
// (desde 15/07/2026; antes usava dia UTC, que virava "amanhã" a partir das 21h)
const utcDateStr = (d = new Date()) => localDateStr(d)

// Visitas REALIZADAS (de ontem para trás) que ainda não foram avaliadas por
// completo, dos clientes atribuídos ao usuário. Enquanto houver alguma, a aba
// "Hoje" fica bloqueada para vendedor/gerente. Retorna a lista de clientes
// pendentes (mais antigos primeiro), cada um com pendingCount e oldestDate.
export async function fetchPendingRatings(userId) {
  if (!userId) return []
  const todayStr = utcDateStr()

  const { data: clients } = await supabase
    .from('clients')
    .select('id, contact_name, company_name, city, visit_scheduled_at, visit_confirmation, assigned_to')
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
    // visita agendada que já passou e ainda nem tem registro (nunca foi aberta).
    // Só cobra visitas TRATADAS (confirmada/tentativa) — sem resposta ou
    // "não confirmada" a visita nem apareceu na agenda, então não cobra.
    let missingScheduled = false
    let schedDate = null
    if (c.visit_scheduled_at && isVisitTreated(c)) {
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

// Próxima data em que um lembrete (reminder_config) vai disparar + dias até lá.
// daily → hoje (0); weekly → próximo dia da semana marcado; specific_date → a data.
const WEEKDAY_MAP = { dom: 0, seg: 1, ter: 2, qua: 3, qui: 4, sex: 5, sab: 6 }
function nextReminderInfo(cfg) {
  if (!cfg) return null
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const daysBetween = (d) => Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - today) / 86400000)

  if (cfg.type === 'specific_date') {
    // Várias datas possíveis — pega a PRÓXIMA que ainda não passou
    const upcoming = reminderDates(cfg)
      .map(s => ({ d: new Date(s + 'T12:00:00'), s }))
      .map(x => ({ ...x, days: daysBetween(x.d) }))
      .filter(x => x.days >= 0)
      .sort((a, b) => a.days - b.days)
    if (!upcoming.length) return null
    return { date: upcoming[0].d.toISOString(), daysUntil: upcoming[0].days }
  }
  if (cfg.type === 'daily') {
    return { date: today.toISOString(), daysUntil: 0 }
  }
  if (cfg.type === 'weekly') {
    const targets = (cfg.days || []).map((d) => WEEKDAY_MAP[d]).filter((n) => n !== undefined)
    if (!targets.length) return null
    for (let i = 0; i <= 6; i++) {
      if (targets.includes((now.getDay() + i) % 7)) {
        const d = new Date(today); d.setDate(d.getDate() + i)
        return { date: d.toISOString(), daysUntil: i }
      }
    }
  }
  return null
}

// Clientes que o usuário marcou p/ ser lembrado (reminder_config) e cujo próximo
// lembrete está chegando (0..withinDays). Aparece na aba "Hoje".
export async function fetchUpcomingReminders(userId, withinDays = 3) {
  if (!userId) return []
  const { data } = await supabase
    .from('clients')
    .select('id, contact_name, company_name, city, phone, reminder_config')
    .eq('created_by', userId)
    .not('reminder_config', 'is', null)
  const out = []
  for (const c of data || []) {
    const info = nextReminderInfo(c.reminder_config)
    if (info && info.daysUntil >= 0 && info.daysUntil <= withinDays) {
      out.push({ ...c, reminderDate: info.date, daysUntil: info.daysUntil, reminderType: c.reminder_config.type })
    }
  }
  out.sort((a, b) => a.daysUntil - b.daysUntil)
  return out
}

// Filtro "quem marcou a visita atual": visit_scheduled_by; registros antigos
// (coluna nula) caem no fallback created_by — quem cadastrou foi quem marcou.
const scheduledByMe = (userId) =>
  `visit_scheduled_by.eq.${userId},and(visit_scheduled_by.is.null,created_by.eq.${userId})`

// Visitas de um dia que o usuário MARCOU e JÁ respondeu
// (visit_confirmation preenchido). Usado para o pré-vendas ver, na aba Hoje,
// as visitas do dia que ele já tratou no pop-up — coloridas pelo status.
export async function fetchAnsweredVisitsForDay(userId, offset = 0) {
  if (!userId) return []
  const { start, end } = getDayRange(offset)
  const { data } = await supabase
    .from('clients')
    .select('id, contact_name, company_name, city, visit_scheduled_at, visit_confirmation, visit_confirmation_note')
    .or(scheduledByMe(userId))
    .not('visit_scheduled_at', 'is', null)
    .not('visit_confirmation', 'is', null)
    .gte('visit_scheduled_at', start)
    .lte('visit_scheduled_at', end)
    .order('visit_scheduled_at', { ascending: true })
  return data || []
}

// "Pediu para ligar depois" (tabela callbacks, separada dos clientes) que caem
// HOJE: daily sempre; weekly no dia da semana; specific_date a partir da data.
// Só os do próprio usuário e não concluídos. Aparecem na aba Hoje.
const DOW_KEYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab']
export async function fetchTodayCallbacks(userId) {
  if (!userId) return []
  const { data } = await supabase
    .from('callbacks')
    .select('*')
    .eq('created_by', userId)
    .eq('done', false)
    .order('created_at', { ascending: true })
  const dowKey = DOW_KEYS[new Date().getDay()]
  const todayStr = localDateStr()
  return (data || []).filter(c => {
    const cfg = c.reminder_config
    if (!cfg) return false
    if (cfg.type === 'daily')  return true
    if (cfg.type === 'weekly') return (cfg.days || []).includes(dowKey)
    if (cfg.type === 'specific_date') {
      const ds = reminderDates(cfg)
      if (ds.includes(todayStr)) return true          // é um dos dias marcados
      const past = ds.filter(d => d < todayStr)
      const upcoming = ds.filter(d => d >= todayStr)
      return past.length > 0 && upcoming.length === 0 // já passou de todas e não deu ok → fica pendente
    }
    return false
  })
}

// Tarefas em aberto do usuário (follow-ups criados na estrela + manuais) que
// já venceram, não têm prazo, ou vencem até o próximo dia útil. Aparecem na
// aba Hoje ("A fazer") — a página global de Tarefas foi removida.
export async function fetchOpenTasks(userId) {
  if (!userId) return []
  const cutoff = localDateStr(new Date(Date.now() + daysAheadWindow() * 86400000))
  const { data } = await supabase
    .from('tasks')
    .select('*, clients(contact_name, company_name, city)')
    .eq('seller_id', userId)
    .eq('completed', false)
    .order('due_date', { ascending: true })
  return (data || []).filter(t => !t.due_date || t.due_date <= cutoff)
}

// Quantas coisas estão esperando a pessoa HOJE — o mesmo conjunto que a aba
// "Hoje" lista, então o card do Dashboard e a aba nunca divergem:
// visitas a confirmar (hoje até o próximo dia útil — confirmar a de amanhã já
// é tarefa de hoje), lembretes chegando, "ligar depois" (callbacks e clientes
// em pediu_ligar com retorno hoje), "a fazer" e as visitas do dia.
// Feedbacks de visita ficam de fora: são aviso, não pendência.
export async function fetchPendingCount(role, userId) {
  if (!userId) return 0
  const lists = await Promise.all([
    fetchVisitsToConfirm(userId),
    fetchUpcomingReminders(userId, daysAheadWindow()),
    fetchTodayCallbacks(userId),
    fetchOpenTasks(userId),
    fetchCallbacksForDay(role, userId, 0),
    fetchVisitsForDay(role, userId, 0),
  ])
  return lists.reduce((total, l) => total + l.length, 0)
}

// Estrelas preenchidas HOJE (rated_at) de clientes que o usuário marcou —
// aviso na aba Hoje do pré-vendas p/ ele conferir o feedback da visita.
export async function fetchTodayFeedbacks(userId) {
  if (!userId) return []
  const { start, end } = getDayRange(0)
  const { data } = await supabase
    .from('visits')
    .select('*, clients!inner(*)')
    .gte('rated_at', start)
    .lte('rated_at', end)
    .or(scheduledByMe(userId), { referencedTable: 'clients' })
    .order('rated_at', { ascending: false })
  return data || []
}

// Visitas que o usuário MARCOU (visit_scheduled_by, fallback created_by)
// e ainda não confirmou, agendadas para HOJE até o próximo dia ÚTIL
// (na sexta inclui sábado, domingo e segunda — confirmação de segunda é na
// sexta, ninguém trabalha no fim de semana). Mesma fonte usada pelo pop-up
// (Dashboard) e pela aba "Hoje" — os dois mostram o mesmo.
export async function fetchVisitsToConfirm(userId) {
  if (!userId) return []

  const start = new Date()
  start.setHours(0, 0, 0, 0) // hoje 00:00
  const end = new Date()
  end.setDate(end.getDate() + daysAheadWindow())
  end.setHours(23, 59, 59, 999) // fim do próximo dia útil

  const { data } = await supabase
    .from('clients')
    .select('id, contact_name, company_name, city, visit_scheduled_at, visit_confirmation, google_calendar_event_id')
    .or(scheduledByMe(userId))
    .not('visit_scheduled_at', 'is', null)
    .is('visit_confirmation', null)
    .gte('visit_scheduled_at', start.toISOString())
    .lte('visit_scheduled_at', end.toISOString())
    .order('visit_scheduled_at', { ascending: true })

  return data || []
}

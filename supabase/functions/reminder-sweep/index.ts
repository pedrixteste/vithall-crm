import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const ONESIGNAL_API_KEY    = Deno.env.get('ONESIGNAL_REST_API_KEY')!
const ONESIGNAL_APP_ID     = Deno.env.get('ONESIGNAL_APP_ID')!
const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const BRIEFING_SECRET      = Deno.env.get('BRIEFING_SECRET')!

// A chave "legacy" do OneSignal autentica com Basic; a nova (os_v2_app_...)
// com Key. Esquema errado devolve 401 mesmo com a chave certa.
const OS_AUTH = ONESIGNAL_API_KEY?.startsWith('os_v2_')
  ? `Key ${ONESIGNAL_API_KEY}`
  : `Basic ${ONESIGNAL_API_KEY}`

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })

// ── Horário de Brasília ─────────────────────────────────────────────
const BRT = -3 * 60 * 60 * 1000
const nowBrt = () => new Date(Date.now() + BRT)
const dateStr = (d: Date) => d.toISOString().slice(0, 10)
const hhmm = (d: Date) => d.toISOString().slice(11, 16)

const DOW = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab']

function reminderDates(cfg: any): string[] {
  if (!cfg) return []
  if (Array.isArray(cfg.dates)) return cfg.dates
  return cfg.date ? [cfg.date] : []
}

/** O retorno cai hoje? Mesma regra do fetchTodayCallbacks do app. */
function callbackDueToday(cfg: any, hoje: Date) {
  if (!cfg) return false
  if (cfg.type === 'daily') return true
  if (cfg.type === 'weekly') return (cfg.days || []).includes(DOW[hoje.getUTCDay()])
  if (cfg.type === 'specific_date') return reminderDates(cfg).includes(dateStr(hoje))
  return false
}

async function push(playerId: string, heading: string, content: string, url: string) {
  const r = await fetch('https://onesignal.com/api/v1/notifications', {
    method: 'POST',
    headers: { Authorization: OS_AUTH, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      app_id: ONESIGNAL_APP_ID,
      include_player_ids: [playerId],
      headings: { pt: heading, en: heading },
      contents: { pt: content, en: content },
      url,
    }),
  })
  // A resposta é sempre lida: o OneSignal devolve 200 com erro no corpo, e
  // ignorar isso já custou meses de push que ninguém recebia.
  return { status: r.status, ...(await r.json().catch(() => ({}))) }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const body = await req.json().catch(() => ({}))
    if (body.secret !== BRIEFING_SECRET) return json({ error: 'nao autorizado' }, 401)
    const dryRun = !!body.dryRun

    const agora = nowBrt()
    const hoje  = dateStr(agora)
    const dow   = agora.getUTCDay()
    const hora  = agora.getUTCHours()
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    const [profRes, cbRes, cliRes, logRes, taskRes] = await Promise.all([
      sb.from('profiles').select('id, name, role, onesignal_player_id').not('onesignal_player_id', 'is', null),
      sb.from('callbacks').select('id, created_by, contact_name, company_name, phone, reminder_config, done').eq('done', false),
      sb.from('clients').select('id, contact_name, company_name, created_by, assigned_to, matricula_stage, call_back_at, visit_scheduled_at, visit_confirmation'),
      sb.from('push_log').select('user_id, kind, ref, sent_at'),
      sb.from('tasks').select('id, seller_id, title, due_date, due_time, reminder_config, completed').eq('completed', false).not('due_time', 'is', null),
    ])
    const profiles = profRes.data || []
    const byId: Record<string, any> = {}
    for (const p of profiles) byId[p.id] = p
    const logs = logRes.data || []
    const jaMandou = (userId: string, kind: string, ref: string) =>
      logs.some(l => l.user_id === userId && l.kind === kind && l.ref === ref)

    const enviados: any[] = []
    const registrar = async (userId: string, kind: string, ref: string) => {
      if (dryRun) return
      await sb.from('push_log').upsert({ user_id: userId, kind, ref }, { onConflict: 'user_id,kind,ref' })
    }

    // ── A) Ligação chegando (vale para qualquer papel: quem registrou, recebe)
    // Janela: o que vence nos próximos 5 minutos. O texto diz os minutos reais,
    // porque um retorno às 11:28 é pego na rodada das 11:25 — "em 3 min".
    const limite = new Date(agora.getTime() + 5 * 60 * 1000)

    const avisarLigacao = async (userId: string, nome: string, sub: string, quando: Date, ref: string) => {
      const p = byId[userId]
      if (!p || jaMandou(userId, 'callback', ref)) return
      const min = Math.max(1, Math.round((quando.getTime() - agora.getTime()) / 60000))
      const heading = `⏰ Ligar em ${min} min`
      const content = `${nome}${sub ? ` — ${sub}` : ''} (${hhmm(quando)})`
      const res = dryRun ? null : await push(p.onesignal_player_id, heading, content, 'https://vithall-crm.vercel.app/agenda')
      enviados.push({ user: p.name, tipo: 'ligacao', heading, content, res })
      await registrar(userId, 'callback', ref)
    }

    for (const c of (cbRes.data || [])) {
      const cfg = c.reminder_config
      if (!cfg?.time || !callbackDueToday(cfg, agora)) continue
      const [h, m] = String(cfg.time).split(':').map(Number)
      const quando = new Date(agora); quando.setUTCHours(h, m, 0, 0)
      if (quando <= agora || quando > limite) continue
      await avisarLigacao(c.created_by, c.contact_name, c.company_name || '', quando, `${c.id}:${hoje}`)
    }

    // Clientes em "pediu para ligar" com hora marcada — o retorno é do dono
    for (const c of (cliRes.data || [])) {
      if (c.matricula_stage !== 'pediu_ligar' || !c.call_back_at) continue
      const quando = new Date(new Date(c.call_back_at).getTime() + BRT)
      if (quando <= agora || quando > limite) continue
      const dono = c.created_by || c.assigned_to
      await avisarLigacao(dono, c.contact_name, c.company_name || '', quando, `cli:${c.id}:${hoje}`)
    }

    // ── A2) Tarefa chegando — tasks soltas do Dashboard com dia+hora marcados
    const avisarTarefa = async (userId: string, titulo: string, quando: Date, ref: string) => {
      const p = byId[userId]
      if (!p || jaMandou(userId, 'task', ref)) return
      const min = Math.max(1, Math.round((quando.getTime() - agora.getTime()) / 60000))
      const heading = `✅ Tarefa em ${min} min`
      const res = dryRun ? null : await push(p.onesignal_player_id, heading, titulo, 'https://vithall-crm.vercel.app/')
      enviados.push({ user: p.name, tipo: 'tarefa', heading, content: titulo, res })
      await registrar(userId, 'task', ref)
    }

    for (const t of (taskRes.data || [])) {
      if (!t.due_time) continue
      const cfg = t.reminder_config
      const repete = cfg?.type === 'daily' || cfg?.type === 'weekly'
      if (repete) {
        // Mesma regra de dia dos callbacks (daily sempre; weekly no dia marcado)
        if (!callbackDueToday(cfg, agora)) continue
        if (cfg.last_done === hoje) continue // já marcou como feita hoje
      } else if (t.due_date !== hoje) continue
      const [h, m] = String(t.due_time).slice(0, 5).split(':').map(Number)
      const quando = new Date(agora); quando.setUTCHours(h, m, 0, 0)
      if (quando <= agora || quando > limite) continue
      await avisarTarefa(t.seller_id, t.title, quando, `task:${t.id}:${hoje}`)
    }

    // ── B) Preencher as estrelas — SÓ vendedor e gerente ────────────
    // Pré-vendas não faz visita, então não tem estrela para preencher.
    // Fim de semana não dispara, e nada depois das 22h: notificação de
    // madrugada não faz ninguém preencher, faz desligar o push do app.
    const fimDeSemana = dow === 0 || dow === 6
    if (!fimDeSemana && hora < 22) {
      const visitantes = profiles.filter(p => p.role === 'vendedor' || p.role === 'gerente')

      for (const p of visitantes) {
        // Visitas de hoje que são dele e foram tratadas (confirmada/tentativa)
        const doDia = (cliRes.data || []).filter(c =>
          c.visit_scheduled_at && c.assigned_to === p.id &&
          ['confirmada', 'tentativa'].includes(c.visit_confirmation) &&
          dateStr(new Date(new Date(c.visit_scheduled_at).getTime() + BRT)) === hoje)
        if (!doDia.length) continue

        // Só cobra 2h depois da ÚLTIMA visita: no meio da correria entre uma
        // visita e outra, a pessoa preencheria de qualquer jeito.
        const ultima = doDia
          .map(c => new Date(new Date(c.visit_scheduled_at).getTime() + BRT).getTime())
          .sort((a, b) => b - a)[0]
        if (agora.getTime() < ultima + 2 * 60 * 60 * 1000) continue

        const ids = doDia.map(c => c.id)
        const { data: visitas } = await sb.from('visits')
          .select('client_id, rating, visit_outcome, visit_notes, visit_possibilities, outcome_training')
          .in('client_id', ids).eq('visit_date', hoje)
        const completa = (v: any) => {
          const temTrein = Array.isArray(v.outcome_training) ? v.outcome_training.length > 0 : !!v.outcome_training
          return !!(v.rating && v.visit_outcome && v.visit_notes?.trim() &&
            (v.visit_possibilities || []).length > 0 &&
            (v.visit_outcome !== 'matriculada' || temTrein))
        }
        const avaliados = new Set((visitas || []).filter(completa).map(v => v.client_id))
        const faltam = ids.filter(id => !avaliados.has(id)).length
        if (!faltam) continue

        // Máximo 5 avisos por dia, de 30 em 30 minutos
        const meus = logs.filter(l => l.user_id === p.id && l.kind === 'visit_rating' && l.ref.startsWith(hoje))
        if (meus.length >= 5) continue
        const ultimoEnvio = meus.map(l => new Date(l.sent_at).getTime()).sort((a, b) => b - a)[0]
        if (ultimoEnvio && Date.now() - ultimoEnvio < 30 * 60 * 1000) continue

        const heading = '⭐ Preencha as informações das suas visitas de hoje!'
        const content = `${faltam} ${faltam === 1 ? 'visita ainda sem avaliação' : 'visitas ainda sem avaliação'}.`
        const res = dryRun ? null : await push(p.onesignal_player_id, heading, content,
          'https://vithall-crm.vercel.app/agenda?view=produzido')
        enviados.push({ user: p.name, tipo: 'estrela', heading, content, faltam, res })
        await registrar(p.id, 'visit_rating', `${hoje}#${meus.length + 1}`)
      }
    }

    // ── C) 7h da manhã: sobrou estrela de ontem → avisa da trava ────
    if (!fimDeSemana && hhmm(agora) >= '07:00' && hhmm(agora) < '07:05') {
      const visitantes = profiles.filter(p => p.role === 'vendedor' || p.role === 'gerente')
      for (const p of visitantes) {
        if (jaMandou(p.id, 'visit_rating_trava', hoje)) continue
        const { data: pend } = await sb.from('visits')
          .select('client_id, rating, visit_outcome, visit_notes, visit_possibilities, clients!inner(assigned_to)')
          .lt('visit_date', hoje)
          .eq('clients.assigned_to', p.id)
        const incompletas = (pend || []).filter(v =>
          !(v.rating && v.visit_outcome && v.visit_notes?.trim() && (v.visit_possibilities || []).length > 0))
        if (!incompletas.length) continue
        const heading = '🔒 Avaliações pendentes'
        const content = `${incompletas.length} ${incompletas.length === 1 ? 'visita' : 'visitas'} sem avaliação travam o app até você preencher.`
        const res = dryRun ? null : await push(p.onesignal_player_id, heading, content,
          'https://vithall-crm.vercel.app/agenda')
        enviados.push({ user: p.name, tipo: 'trava', heading, content, res })
        await registrar(p.id, 'visit_rating_trava', hoje)
      }
    }

    return json({ ok: true, hora: hhmm(agora), enviados: enviados.length, detalhe: enviados })
  } catch (e) {
    return json({ error: (e as Error).message }, 500)
  }
})

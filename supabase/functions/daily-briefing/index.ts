import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const ONESIGNAL_API_KEY    = Deno.env.get('ONESIGNAL_REST_API_KEY')!

// A chave "legacy" do OneSignal autentica com Basic; a nova (os_v2_app_...)
// com Key. Mandar o esquema errado devolve 401 "Access denied" mesmo com a
// chave certa — e a resposta vinha sendo ignorada, entao o push falhava calado.
const OS_AUTH = ONESIGNAL_API_KEY?.startsWith(`os_v2_`)
  ? `Key ${ONESIGNAL_API_KEY}`
  : `Basic ${ONESIGNAL_API_KEY}`
const ONESIGNAL_APP_ID     = Deno.env.get('ONESIGNAL_APP_ID')!
const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const BRIEFING_SECRET      = Deno.env.get('BRIEFING_SECRET')!

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ── Datas em horário de Brasília ────────────────────────────────────
// O Deno roda em UTC; o negócio é BRT (-3). Sem esse deslocamento, entre
// 21h e 00h o "hoje" do robô viraria o "amanhã" da equipe.
const BRT = -3 * 60 * 60 * 1000
const nowBrt = () => new Date(Date.now() + BRT)
const dateStr = (d: Date) => d.toISOString().slice(0, 10)

/** Quantos dias à frente o "amanhã útil" alcança (sexta alcança segunda). */
function daysAheadWindow(d: Date) {
  const dow = d.getUTCDay()
  if (dow === 5) return 3
  if (dow === 6) return 2
  return 1
}

/** Último dia útil antes de hoje: segunda olha para sexta. */
function lastBusinessDay(d: Date) {
  const dow = d.getUTCDay()
  const back = dow === 1 ? 3 : dow === 0 ? 2 : 1
  const r = new Date(d)
  r.setUTCDate(r.getUTCDate() - back)
  return r
}

/** Dias úteis entre duas datas (inclusive) — mede se o período já tem
 *  história suficiente para um "recorde" significar alguma coisa. */
function businessDaysBetween(fromStr: string, toStr: string) {
  let n = 0
  const d = new Date(`${fromStr}T00:00:00Z`)
  const end = new Date(`${toStr}T00:00:00Z`)
  while (d <= end) {
    const w = d.getUTCDay()
    if (w !== 0 && w !== 6) n++
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return n
}

const WEEKDAY_MAP: Record<string, number> = { dom: 0, seg: 1, ter: 2, qua: 3, qui: 4, sex: 5, sab: 6 }

/** Datas de um reminder_config de specific_date (compat com o campo antigo). */
function reminderDates(cfg: any): string[] {
  if (!cfg) return []
  if (Array.isArray(cfg.dates)) return cfg.dates
  return cfg.date ? [cfg.date] : []
}

/** Um lembrete cai dentro da janela de hoje..+withinDays? */
function reminderDueWithin(cfg: any, today: Date, withinDays: number) {
  if (!cfg) return false
  if (cfg.type === 'daily') return true
  if (cfg.type === 'weekly') {
    const targets = (cfg.days || []).map((k: string) => WEEKDAY_MAP[k])
    for (let i = 0; i <= withinDays; i++) {
      if (targets.includes((today.getUTCDay() + i) % 7)) return true
    }
    return false
  }
  if (cfg.type === 'specific_date') {
    const limit = new Date(today); limit.setUTCDate(limit.getUTCDate() + withinDays)
    const t = dateStr(today), l = dateStr(limit)
    return reminderDates(cfg).some(s => s >= t && s <= l)
  }
  return false
}

/** Um callback cai hoje? Mesma regra do fetchTodayCallbacks do app. */
function callbackDueToday(cfg: any, today: Date) {
  if (!cfg) return false
  if (cfg.type === 'daily') return true
  if (cfg.type === 'weekly') {
    const key = ['dom','seg','ter','qua','qui','sex','sab'][today.getUTCDay()]
    return (cfg.days || []).includes(key)
  }
  if (cfg.type === 'specific_date') {
    const ds = reminderDates(cfg), t = dateStr(today)
    if (ds.includes(t)) return true
    // Passou de todas as datas e ninguém deu baixa → continua pendente
    return ds.length > 0 && ds.every(d => d < t)
  }
  return false
}

const plural = (n: number, um: string, muitos: string) => `${n} ${n === 1 ? um : muitos}`

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const body = await req.json().catch(() => ({}))
    // O cron é público na internet — sem o segredo, qualquer um dispararia
    // notificação para a equipe inteira.
    if (body.secret !== BRIEFING_SECRET) {
      return new Response(JSON.stringify({ error: 'nao autorizado' }), { status: 401, headers: cors })
    }
    const slot: 'morning' | 'afternoon' = body.slot === 'afternoon' ? 'afternoon' : 'morning'
    const dryRun = !!body.dryRun
    const onlyUser = body.onlyUser || null // teste: dispara só para uma pessoa

    const today = nowBrt()
    // Fim de semana não recebe nada — ninguém trabalha, e notificação de
    // trabalho no sábado só ensina a equipe a desligar as notificações.
    if (!body.force && (today.getUTCDay() === 0 || today.getUTCDay() === 6)) {
      return new Response(JSON.stringify({ ok: true, skipped: 'fim de semana' }),
        { headers: { ...cors, 'Content-Type': 'application/json' } })
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    const todayStr = dateStr(today)
    const windowEnd = new Date(today)
    windowEnd.setUTCDate(windowEnd.getUTCDate() + daysAheadWindow(today))
    const windowEndStr = dateStr(windowEnd)
    const lastDay = lastBusinessDay(today)
    const lastDayStr = dateStr(lastDay)

    // Uma leitura de cada tabela; o agrupamento por pessoa é feito aqui.
    // A equipe é pequena, então isso é mais barato que N consultas por pessoa.
    const [profilesRes, clientsRes, callbacksRes, tasksRes, logsRes, creditsRes, visitsRes, sentRes] = await Promise.all([
      sb.from('profiles').select('id, name, role, onesignal_player_id').not('onesignal_player_id', 'is', null),
      sb.from('clients').select('id, created_by, assigned_to, visit_scheduled_by, visit_scheduled_at, visit_confirmation, reminder_config, matricula_stage, call_back_at, created_at'),
      sb.from('callbacks').select('created_by, reminder_config, done'),
      sb.from('tasks').select('seller_id, completed, due_date'),
      sb.from('daily_logs').select('user_id, log_date, calls, answered'),
      sb.from('matricula_credits').select('credited_to, credit_date'),
      sb.from('visits').select('client_id, visit_date'),
      sb.from('briefing_log').select('user_id, pending_count').eq('log_date', todayStr).eq('slot', 'morning'),
    ])

    const profiles  = profilesRes.data || []
    const clients   = clientsRes.data || []
    const callbacks = callbacksRes.data || []
    const tasks     = tasksRes.data || []
    const logs      = logsRes.data || []
    const credits   = creditsRes.data || []
    const visits    = visitsRes.data || []
    const morningBy: Record<string, number> = {}
    for (const r of sentRes.data || []) morningBy[r.user_id] = r.pending_count

    const clientById: Record<string, any> = {}
    for (const c of clients) clientById[c.id] = c

    const results: any[] = []
    // Recordes do dia — replicados p/ os gerentes depois do laço, para eles
    // saberem que a pessoa bateu e que ela já foi avisada.
    const recordes: { nome: string, texto: string }[] = []

    for (const p of profiles) {
      if (onlyUser && p.id !== onlyUser) continue
      const isSeller = p.role === 'vendedor' || p.role === 'gerente'
      // Quem marcou a visita atual (registros antigos caem no created_by)
      const scheduledByMe = (c: any) =>
        c.visit_scheduled_by === p.id || (!c.visit_scheduled_by && c.created_by === p.id)

      // ── Pendências de hoje (espelho do card "Pendentes" do app) ──
      const toConfirm = clients.filter(c =>
        scheduledByMe(c) && c.visit_scheduled_at && !c.visit_confirmation &&
        dateStr(new Date(c.visit_scheduled_at)) >= todayStr &&
        dateStr(new Date(c.visit_scheduled_at)) <= windowEndStr
      ).length

      const reminders = clients.filter(c =>
        c.created_by === p.id && reminderDueWithin(c.reminder_config, today, daysAheadWindow(today))
      ).length

      const callbacksToday = callbacks.filter(c =>
        c.created_by === p.id && !c.done && callbackDueToday(c.reminder_config, today)
      ).length

      const openTasks = tasks.filter(t => {
        if (t.seller_id !== p.id || t.completed) return false
        return !t.due_date || t.due_date <= windowEndStr
      }).length

      const callsToday = clients.filter(c =>
        c.matricula_stage === 'pediu_ligar' && c.call_back_at &&
        dateStr(new Date(c.call_back_at)) === todayStr &&
        (p.role === 'gerente' || (isSeller ? c.assigned_to === p.id : c.created_by === p.id))
      ).length

      const visitsToday = !isSeller ? 0 : clients.filter(c =>
        c.visit_scheduled_at && ['confirmada', 'tentativa'].includes(c.visit_confirmation) &&
        dateStr(new Date(c.visit_scheduled_at)) === todayStr &&
        (p.role === 'gerente' || c.assigned_to === p.id)
      ).length

      const pending = toConfirm + reminders + callbacksToday + openTasks + callsToday + visitsToday

      // ── Frase das pendências ──
      const partes: string[] = []
      if (visitsToday)    partes.push(plural(visitsToday, 'visita hoje', 'visitas hoje'))
      if (toConfirm)      partes.push(plural(toConfirm, 'visita p/ confirmar', 'visitas p/ confirmar'))
      if (callbacksToday + callsToday) partes.push(plural(callbacksToday + callsToday, 'ligação de retorno', 'ligações de retorno'))
      if (reminders)      partes.push(plural(reminders, 'lembrete', 'lembretes'))
      if (openTasks)      partes.push(plural(openTasks, 'a fazer', 'a fazer'))
      const pendFrase = partes.join(' · ')

      let heading = ''
      let content = ''

      if (slot === 'morning') {
        // ── Resumo do último dia útil ──
        const log = logs.find(l => l.user_id === p.id && l.log_date === lastDayStr)
        const marc = clients.filter(c =>
          c.created_by === p.id && c.visit_scheduled_at && dateStr(new Date(c.created_at)) === lastDayStr
        ).length
        const mats = credits.filter(c => c.credited_to === p.id && c.credit_date === lastDayStr).length
        const myClientIds = new Set(clients.filter(c => c.assigned_to === p.id).map(c => c.id))
        const vis = !isSeller ? 0 : visits.filter(v => v.visit_date === lastDayStr && myClientIds.has(v.client_id)).length

        const calls = log?.calls || 0
        const answered = log?.answered || 0

        const feitos: string[] = []
        if (calls)     feitos.push(plural(calls, 'ligação', 'ligações'))
        if (answered)  feitos.push(plural(answered, 'atendida', 'atendidas'))
        if (marc)      feitos.push(plural(marc, 'marcação', 'marcações'))
        if (vis)       feitos.push(plural(vis, 'visita', 'visitas'))
        if (mats)      feitos.push(plural(mats, 'matrícula', 'matrículas'))

        // ── Recorde ──
        // A métrica é o RESULTADO de cada papel, não o esforço: pré-vendas
        // bate recorde de marcações, vendedor/gerente de matrículas. Ninguém
        // comemora 60 ligações que não viraram nada.
        const metricByDay: Record<string, number> = {}
        if (isSeller) {
          for (const c of credits) {
            if (c.credited_to === p.id) metricByDay[c.credit_date] = (metricByDay[c.credit_date] || 0) + 1
          }
        } else {
          for (const c of clients) {
            if (c.created_by !== p.id || !c.visit_scheduled_at) continue
            const d = dateStr(new Date(c.created_at))
            metricByDay[d] = (metricByDay[d] || 0) + 1
          }
        }
        const valor = metricByDay[lastDayStr] || 0
        const rotulo = isSeller
          ? plural(valor, 'matrícula', 'matrículas')
          : plural(valor, 'marcação', 'marcações')

        // Dias em que a pessoa REALMENTE trabalhou (registrou ligação, marcação
        // ou matrícula). O calendário sozinho não serve de guarda: o banco pode
        // ter sido zerado, ou a pessoa ter entrado ontem — aí "julho já tem 15
        // dias úteis" convive com 1 dia de histórico, e 1 marcação viraria
        // "melhor dia do ano".
        const diasAtivos = new Set<string>(Object.keys(metricByDay))
        for (const l of logs) {
          if (l.user_id === p.id && (l.calls || 0) > 0) diasAtivos.add(l.log_date)
        }

        const mesRef = lastDayStr.slice(0, 7)
        const anoRef = lastDayStr.slice(0, 4)
        const ehJaneiro = lastDayStr.slice(5, 7) === '01'
        const ativosNo = (escopo: string) =>
          [...diasAtivos].filter(d => d.startsWith(escopo) && d !== lastDayStr).length

        // Guardas do usuário: nada de "melhor do mês" com o mês recém-começado,
        // nada de "melhor do ano" em janeiro. Exige as duas coisas — período
        // decorrido E histórico acumulado.
        const mesMaduro = businessDaysBetween(`${mesRef}-01`, lastDayStr) >= 5 && ativosNo(mesRef) >= 5
        const anoMaduro = !ehJaneiro
          && businessDaysBetween(`${anoRef}-01-01`, lastDayStr) >= 20 && ativosNo(anoRef) >= 20

        const bateu = (escopo: string) => Object.entries(metricByDay)
          .every(([d, v]) => d === lastDayStr || !d.startsWith(escopo) || v < valor)

        // O recorde vira uma notificação PRÓPRIA (enviada depois do laço) —
        // grudado no "Bom dia" ele se perdia no meio das pendências.
        let escopoRecorde = ''
        if (valor > 0) {
          if (anoMaduro && bateu(anoRef))      escopoRecorde = 'do ano'
          else if (mesMaduro && bateu(mesRef)) escopoRecorde = 'do mês'
        }
        if (escopoRecorde) {
          recordes.push({
            playerId: p.onesignal_player_id,
            nome: p.name || '—',
            rotulo,
            escopo: escopoRecorde,
          })
        }

        const primeiro = (p.name || '').split(' ')[0] || ''
        heading = `🌅 Bom dia${primeiro ? `, ${primeiro}` : ''}`

        // Dia zerado não vira cobrança disfarçada de bom dia: some o resumo.
        const recap = feitos.length
          ? `${lastDay.getUTCDay() === 5 && today.getUTCDay() === 1 ? 'Na sexta' : 'Ontem'}: ${feitos.join(', ')}.`
          : ''
        content = [recap, pendFrase ? `Hoje: ${pendFrase}` : ''].filter(Boolean).join(' ')
        if (!content) continue // nada a dizer: não notifica
      } else {
        const tinhaDeManha = (morningBy[p.id] || 0) > 0
        if (pending > 0) {
          heading = '☀️ Ainda pendente'
          content = `Faltam: ${pendFrase}`
        } else if (tinhaDeManha) {
          heading = '✅ Tudo em dia!'
          content = 'Nada pendente por aqui.'
        } else {
          continue // nunca teve nada hoje: não inventa notificação
        }
      }

      results.push({ user: p.name, heading, content, pending })

      if (!dryRun) {
        const push = await fetch('https://onesignal.com/api/v1/notifications', {
          method: 'POST',
          headers: { 'Authorization': OS_AUTH, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            app_id: ONESIGNAL_APP_ID,
            include_player_ids: [p.onesignal_player_id],
            headings: { pt: heading, en: heading },
            contents: { pt: content, en: content },
            url: 'https://vithall-crm.vercel.app/agenda',
          }),
        })
        // O OneSignal responde 200 mesmo quando não entrega (inscrição morta,
        // por exemplo) — o motivo vem no corpo, então ele precisa ser lido.
        const resp = await push.json().catch(() => ({}))
        results[results.length - 1].onesignal = { status: push.status, ...resp }
        await sb.from('briefing_log').upsert({
          user_id: p.id, log_date: todayStr, slot, pending_count: pending,
        }, { onConflict: 'user_id,log_date,slot' })
      }
    }

    // ── Recordes ──
    // Notificação separada do "Bom dia": o parabéns some se vier no meio das
    // pendências. A pessoa recebe o dela; cada gerente recebe UMA POR RECORDE
    // (o usuário preferiu volume a agrupamento) — menos sobre si mesmo, que já
    // chegou como parabéns pessoal.
    // ⚠️ Com muitos gerentes isso vira N×M notificações; revisar se a equipe crescer.
    if (slot === 'morning' && recordes.length) {
      const enviar = async (playerId: string, heading: string, content: string, quem: string) => {
        if (dryRun) { results.push({ user: quem, heading, content, recorde: true }); return }
        const push = await fetch('https://onesignal.com/api/v1/notifications', {
          method: 'POST',
          headers: { 'Authorization': OS_AUTH, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            app_id: ONESIGNAL_APP_ID,
            include_player_ids: [playerId],
            headings: { pt: heading, en: heading },
            contents: { pt: content, en: content },
            url: 'https://vithall-crm.vercel.app/relatorios',
          }),
        })
        results.push({ user: quem, heading, content, recorde: true,
          onesignal: { status: push.status, ...(await push.json().catch(() => ({}))) } })
      }

      const gerentes = profiles.filter(x => x.role === 'gerente')
      for (const r of recordes) {
        const quando = lastDay.getUTCDay() === 5 && today.getUTCDay() === 1 ? 'Na sexta' : 'Ontem'
        await enviar(r.playerId, `🏆 Recorde ${r.escopo}!`,
          `${quando} você fez ${r.rotulo} — seu melhor dia ${r.escopo}. Parabéns!`, r.nome)

        for (const g of gerentes) {
          if (g.name === r.nome) continue // já recebeu o parabéns pessoal
          await enviar(g.onesignal_player_id, '🏆 Recorde na equipe',
            `${r.nome} fez ${r.rotulo} — melhor dia ${r.escopo}. Já foi avisado(a).`, `${g.name} (sobre ${r.nome})`)
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, slot, enviados: results.length, recordes, results }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})

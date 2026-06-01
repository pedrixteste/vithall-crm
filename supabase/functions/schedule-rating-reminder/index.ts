import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const ONESIGNAL_API_KEY    = Deno.env.get('ONESIGNAL_REST_API_KEY')!
const ONESIGNAL_APP_ID     = Deno.env.get('ONESIGNAL_APP_ID')!
const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Timezone Brasil = UTC-3
const BRAZIL_OFFSET_MS = -3 * 60 * 60 * 1000
const AFTER_1630_MIN   = 16 * 60 + 30  // 990 min desde meia-noite
const START_18H_MIN    = 18 * 60        // 1080
const CUTOFF_MIN       = 23 * 60        // 1380 — última notificação às 23h

/**
 * Monta o array de horários UTC para envio das notificações.
 *
 * Regras (horário de Brasília):
 *   - Visita registrada APÓS 16:30 → 1ª notificação 1h45 depois, depois de 30 em 30.
 *   - Visita registrada ANTES de 16:30 → 1ª notificação às 18:00, depois de 30 em 30.
 *   - Última notificação no máximo às 23:00.
 */
function buildSchedule(now: Date): Date[] {
  const brazilNow       = new Date(now.getTime() + BRAZIL_OFFSET_MS)
  const currentTotalMin = brazilNow.getUTCHours() * 60 + brazilNow.getUTCMinutes()

  const firstMin = currentTotalMin >= AFTER_1630_MIN
    ? currentTotalMin + 105  // 1h45 a partir de agora
    : START_18H_MIN          // às 18h em ponto

  const times: Date[] = []
  for (let t = firstMin; t <= CUTOFF_MIN; t += 30) {
    // Constrói o horário no calendário Brasil e converte para UTC
    const d = new Date(brazilNow)
    d.setUTCHours(Math.floor(t / 60), t % 60, 0, 0)
    const utcTime = new Date(d.getTime() - BRAZIL_OFFSET_MS)
    if (utcTime > now) times.push(utcTime)
  }
  return times
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const { visitId, clientName, userId } = await req.json()

    if (!visitId || !clientName || !userId) {
      return new Response(JSON.stringify({ error: 'Parametros faltando' }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    const { data: profile } = await supabase
      .from('profiles')
      .select('onesignal_player_id, role')
      .eq('id', userId)
      .single()

    // Não agenda para pre_vendas ou quem não tem push ativo
    if (!profile?.onesignal_player_id || profile.role === 'pre_vendas') {
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const now      = new Date()
    const schedule = buildSchedule(now)

    if (schedule.length === 0) {
      // Visita registrada depois das 23h — nada a agendar hoje
      return new Response(JSON.stringify({ ok: true, scheduled: 0, reason: 'fora_da_janela' }), {
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const notifIds: string[] = []

    for (const sendAt of schedule) {
      const res = await fetch('https://onesignal.com/api/v1/notifications', {
        method: 'POST',
        headers: {
          'Authorization': `Key ${ONESIGNAL_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          app_id: ONESIGNAL_APP_ID,
          include_subscription_uids: [profile.onesignal_player_id],
          headings: { pt: '⭐ Avaliação da visita pendente' },
          contents: { pt: clientName + ' — preencha como foi a visita!' },
          send_after: sendAt.toISOString(),
          url: 'https://vithall-crm.vercel.app/clientes',
        }),
      })

      if (res.ok) {
        const data = await res.json()
        if (data.id) notifIds.push(data.id)
      }
    }

    if (notifIds.length > 0) {
      await supabase.from('visit_rating_notif_ids').insert(
        notifIds.map(onesignal_id => ({ visit_id: visitId, onesignal_id }))
      )
    }

    return new Response(JSON.stringify({ ok: true, scheduled: notifIds.length }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})

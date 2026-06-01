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

// Atrasos em minutos: 1h45, depois meia em meia hora por mais 5 horas e meia
const DELAY_MINUTES = [105, 135, 165, 195, 225, 255, 285, 315, 345, 375, 405, 435]

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

    // Busca player_id e role do usuario
    const { data: profile } = await supabase
      .from('profiles')
      .select('onesignal_player_id, role')
      .eq('id', userId)
      .single()

    // Nao agenda para pre_vendas ou quem nao tem player_id
    if (!profile?.onesignal_player_id || profile.role === 'pre_vendas') {
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const now = new Date()
    const notifIds: string[] = []

    for (const delayMin of DELAY_MINUTES) {
      const sendAt = new Date(now.getTime() + delayMin * 60 * 1000)

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
          contents: { pt: `${clientName} — preencha como foi a visita!` },
          send_after: sendAt.toISOString(),
          url: 'https://vithall-crm.vercel.app/clientes',
        }),
      })

      if (res.ok) {
        const data = await res.json()
        if (data.id) notifIds.push(data.id)
      }
    }

    // Salva os IDs para poder cancelar depois
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

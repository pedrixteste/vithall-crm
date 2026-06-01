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

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const { visitId } = await req.json()

    if (!visitId) {
      return new Response(JSON.stringify({ error: 'visitId faltando' }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    // Busca todos os IDs de notificacao agendados para essa visita
    const { data: rows } = await supabase
      .from('visit_rating_notif_ids')
      .select('onesignal_id')
      .eq('visit_id', visitId)

    if (!rows?.length) {
      return new Response(JSON.stringify({ ok: true, cancelled: 0 }), {
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    // Cancela cada notificacao no OneSignal (so funciona para as ainda nao enviadas)
    let cancelled = 0
    for (const row of rows) {
      const res = await fetch(
        `https://onesignal.com/api/v1/notifications/${row.onesignal_id}?app_id=${ONESIGNAL_APP_ID}`,
        {
          method: 'DELETE',
          headers: { 'Authorization': `Key ${ONESIGNAL_API_KEY}` },
        }
      )
      if (res.ok) cancelled++
    }

    // Remove os registros do banco independente do resultado do cancelamento
    await supabase.from('visit_rating_notif_ids').delete().eq('visit_id', visitId)

    return new Response(JSON.stringify({ ok: true, cancelled }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})

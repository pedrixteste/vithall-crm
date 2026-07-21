import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const ONESIGNAL_API_KEY  = Deno.env.get('ONESIGNAL_REST_API_KEY')!

// A chave "legacy" do OneSignal autentica com Basic; a nova (os_v2_app_...)
// com Key. Mandar o esquema errado devolve 401 "Access denied" mesmo com a
// chave certa — e a resposta vinha sendo ignorada, entao o push falhava calado.
const OS_AUTH = ONESIGNAL_API_KEY?.startsWith(`os_v2_`)
  ? `Key ${ONESIGNAL_API_KEY}`
  : `Basic ${ONESIGNAL_API_KEY}`
const ONESIGNAL_APP_ID   = Deno.env.get('ONESIGNAL_APP_ID')!
const SUPABASE_URL        = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function fmtDate(d: Date) {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const { assignedToId, clientName, companyName, visitDateTime, city, notes } = await req.json()

    // Busca o onesignal_player_id do responsavel
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    const { data: profile } = await supabase
      .from('profiles')
      .select('name, onesignal_player_id')
      .eq('id', assignedToId)
      .single()

    if (!profile?.onesignal_player_id) {
      return new Response(
        JSON.stringify({ ok: false, reason: 'Responsavel sem player_id registrado' }),
        { headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    // Monta URL do Google Agenda
    const dt    = new Date(visitDateTime)
    const dtEnd = new Date(dt.getTime() + 60 * 60 * 1000) // +1 hora
    const title = companyName ? `Visita - ${clientName} (${companyName})` : `Visita - ${clientName}`
    const calUrl =
      `https://calendar.google.com/calendar/render?action=TEMPLATE` +
      `&text=${encodeURIComponent(title)}` +
      `&dates=${fmtDate(dt)}/${fmtDate(dtEnd)}` +
      (city  ? `&location=${encodeURIComponent(city)}`  : '') +
      (notes ? `&details=${encodeURIComponent(notes)}` : '')

    // Formata data para o corpo da notificacao
    const dateLabel = dt.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })
    const timeLabel = dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

    // Envia push via OneSignal
    const res = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Authorization': OS_AUTH,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        app_id: ONESIGNAL_APP_ID,
        include_player_ids: [profile.onesignal_player_id],
        headings: { pt: '📅 Nova visita agendada', en: 'New visit scheduled' },
        contents: {
          pt: `${clientName} — ${dateLabel} às ${timeLabel}. Toque para adicionar à agenda.`,
          en: `${clientName} — ${dateLabel} at ${timeLabel}`,
        },
        url: calUrl,
      }),
    })

    return new Response(JSON.stringify({ ok: res.ok }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})

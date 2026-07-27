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

// ── Sino do app + canal externo ─────────────────────────────────────
// Bloco IDÊNTICO nas outras functions que disparam push (daily-briefing,
// reminder-sweep, notify-visit). Está duplicado de propósito: cada function
// é colada sozinha no painel do Supabase, então precisa se bastar.
//
// Motivo: o OneSignal pode despachar e o aparelho não exibir (Android
// agressivo com bateria engole o push do PWA — caso da Amanda em 27/jul).
// O sino do app é a fonte da verdade; o ntfy é espelho pra quem tem
// celular problemático, via secret NTFY_TOPICS = { "<user_id>": "<topico>" }.
const sbNotif = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
const APP = 'https://vithall-crm.vercel.app'
const NTFY_TOPICS: Record<string, string> = (() => {
  try { return JSON.parse(Deno.env.get('NTFY_TOPICS') || '{}') } catch { return {} }
})()

async function registrarNoSino(userId: string, title: string, body: string, rota: string, kind: string) {
  try {
    await sbNotif.from('notifications').insert({ user_id: userId, title, body, url: rota, kind })
  } catch { /* o sino falhar não pode derrubar o push */ }

  const topic = NTFY_TOPICS[userId]
  if (!topic) return
  try {
    // ⚠️ Tópico do ntfy.sh é PÚBLICO — a mensagem externa NÃO leva nome de
    // cliente, telefone nem o nome da pessoa. Só avisa que existe algo.
    await fetch('https://ntfy.sh', {
      method: 'POST',
      body: JSON.stringify({
        topic, title: 'Vithall CRM', message: 'Uma visita foi avaliada.',
        click: APP + rota, priority: 4,
      }),
    })
  } catch { /* canal extra é bônus */ }
}

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const OUTCOME_LABELS: Record<string, string> = {
  matriculada:          'Matriculada 🎉',
  grandes_chances:      'Grandes chances',
  chance_futura:        'Chance futura',
  sem_chance:           'Sem chance',
  retorno_pessoalmente: 'Retorno pessoalmente',
  retorno_ligacao:      'Retorno por ligação',
  remarcar:             'Remarcar',
}

// Avisa quem marcou a visita que o vendedor preencheu a estrela (feedback)
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const { recipientId, clientName, outcome, raterName } = await req.json()
    if (!recipientId) {
      return new Response(JSON.stringify({ error: 'recipientId obrigatório' }), { status: 400, headers: cors })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    const { data: profile } = await supabase
      .from('profiles')
      .select('onesignal_player_id')
      .eq('id', recipientId)
      .single()

    if (!profile?.onesignal_player_id) {
      return new Response(
        JSON.stringify({ ok: false, reason: 'Destinatário sem player_id registrado' }),
        { headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    const outcomeLabel = outcome ? (OUTCOME_LABELS[outcome] || outcome) : null
    const body = outcomeLabel
      ? `${clientName}: ${outcomeLabel}${raterName ? ` — por ${raterName}` : ''}. Toque para ver o feedback.`
      : `${clientName}${raterName ? ` — por ${raterName}` : ''}. Toque para ver o feedback.`

    await registrarNoSino(recipientId, '⭐ Visita avaliada', body, '/agenda', 'estrela')

    const res = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Authorization': OS_AUTH,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        app_id: ONESIGNAL_APP_ID,
        include_player_ids: [profile.onesignal_player_id],
        headings: { pt: '⭐ Visita avaliada', en: 'Visit rated' },
        contents: { pt: body, en: body },
        url: 'https://vithall-crm.vercel.app/agenda',
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

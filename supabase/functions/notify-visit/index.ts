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
// reminder-sweep, notify-star). Está duplicado de propósito: cada function
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

const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') || ''
const escaparHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// Telegram: chega na hora (FCM nativo acorda o aparelho) e nunca é
// descartado, ao contrário do push do PWA. Conversa privada, então leva o
// conteúdo completo. Só recebe quem conectou pelo Perfil.
async function enviarTelegram(userId: string, title: string, body: string, rota: string) {
  if (!TELEGRAM_BOT_TOKEN) return
  const { data } = await sbNotif.from('profiles').select('telegram_chat_id').eq('id', userId).single()
  if (!data?.telegram_chat_id) return
  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: data.telegram_chat_id,
      text: `<b>${escaparHtml(title)}</b>\n${escaparHtml(body)}`,
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: [[{ text: 'Abrir no app', url: APP + rota }]] },
    }),
  })
}

async function registrarNoSino(userId: string, title: string, body: string, rota: string, kind: string) {
  try {
    await sbNotif.from('notifications').insert({ user_id: userId, title, body, url: rota, kind })
  } catch { /* o sino falhar não pode derrubar o push */ }

  try { await enviarTelegram(userId, title, body, rota) } catch { /* canal extra é bônus */ }

  const topic = NTFY_TOPICS[userId]
  if (!topic) return
  try {
    // ⚠️ Tópico do ntfy.sh é PÚBLICO — a mensagem externa NÃO leva nome de
    // cliente, telefone nem o nome da pessoa. Só avisa que existe algo.
    await fetch('https://ntfy.sh', {
      method: 'POST',
      body: JSON.stringify({
        topic, title: 'Vithall CRM', message: 'Novidade em uma visita.',
        click: APP + rota, priority: 4,
      }),
    })
  } catch { /* canal extra é bônus */ }
}

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

    // O push leva pro Google Agenda; o sino leva pra aba Hoje, que é onde a
    // visita aparece de fato dentro do app.
    await registrarNoSino(assignedToId, '📅 Nova visita agendada',
      `${clientName} — ${dateLabel} às ${timeLabel}.`, '/agenda', 'visita')

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

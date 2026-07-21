import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const GOOGLE_CLIENT_ID     = Deno.env.get('GOOGLE_CLIENT_ID')!
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET')!

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

// Cores de evento do Google Agenda. O evento fica na agenda do vendedor, então
// a cor é o que diz QUEM marcou — cada pessoa sempre na mesma.
const CORES: Record<string, string> = {
  '1': 'Lavanda', '2': 'Sálvia', '3': 'Uva', '4': 'Flamingo', '5': 'Banana', '6': 'Tangerina',
  '7': 'Pavão', '8': 'Grafite', '9': 'Mirtilo', '10': 'Manjericão', '11': 'Tomate',
}
// A cor vem de `profiles.calendar_color`, definida pelo gerente. Sortear a cor
// a partir do id NÃO funciona: com 6 pessoas e 10 cores, duas colidem fácil —
// e na primeira tentativa Mafê e Amanda caíram exatamente na mesma.

/**
 * Token válido do DONO DA AGENDA.
 *
 * Roda no servidor de propósito: o navegador de quem ocupa o horário não pode
 * ler o token do vendedor (RLS de `google_tokens` é own-row, e isso é uma
 * correção de segurança deliberada). Como o evento precisa nascer na agenda do
 * vendedor — para o horário contar como ocupado de verdade —, é aqui, com
 * service role, que ele é criado.
 */
async function ownerAccessToken(sb: any, ownerId: string, quem: string) {
  const { data: tok } = await sb
    .from('google_tokens')
    .select('access_token, refresh_token, token_expiry')
    .eq('id', ownerId)
    .maybeSingle()

  if (!tok?.refresh_token) return { error: `${quem} não tem o Google Agenda conectado.` }
  if (tok.access_token && tok.token_expiry > Date.now() + 300_000) return { token: tok.access_token }

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: tok.refresh_token,
      grant_type:    'refresh_token',
    }),
  })
  const data = await res.json()
  // A resposta do Google é lida SEMPRE: um refresh recusado devolve 400 com o
  // motivo, e engolir isso faria a reserva falhar em silêncio.
  if (!res.ok || !data.access_token) {
    return { error: `Não foi possível renovar o acesso ao Google do vendedor (${data.error || res.status}). Ele precisa reconectar no Perfil.` }
  }

  await sb.from('google_tokens').update({
    access_token: data.access_token,
    token_expiry: Date.now() + data.expires_in * 1000,
  }).eq('id', ownerId)

  return { token: data.access_token }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const { slotId, action } = await req.json()
    if (!slotId) return json({ error: 'slotId obrigatório' }, 400)

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    const { data: slot } = await sb
      .from('agenda_slots')
      .select('id, seller_id, booked_by, slot_at, booked_note, status, google_calendar_event_id')
      .eq('id', slotId)
      .maybeSingle()
    if (!slot) return json({ error: 'Horário não encontrado' }, 404)

    // O evento nasce na agenda de QUEM OCUPOU.
    //
    // Tentamos antes criar na agenda do vendedor e distinguir as pessoas pela
    // cor do evento: não funciona. O Google só respeita a cor do evento para o
    // DONO da agenda; quem enxerga por compartilhamento vê tudo na cor que
    // escolheu para aquela agenda — então todas as marcações saíam iguais.
    // Com o evento na agenda de cada pessoa, cada uma vira uma agenda distinta
    // e o Google já as colore diferente sozinho, do jeito que cada um prefere.
    //
    // Na remoção isso ainda vale: o app chama esta função ANTES de limpar
    // `booked_by`, senão o evento ficaria sem ninguém para apagá-lo.
    if (!slot.booked_by) return json({ ok: false, reason: 'Horário sem responsável — ocupe antes de reservar.' })
    const auth = await ownerAccessToken(sb, slot.booked_by, 'Quem ocupou o horário')
    if (auth.error) return json({ ok: false, reason: auth.error })

    // ── Liberar o horário: some o evento junto ──
    if (action === 'delete') {
      if (!slot.google_calendar_event_id) return json({ ok: true, skipped: 'sem evento' })
      const del = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${slot.google_calendar_event_id}`,
        { method: 'DELETE', headers: { Authorization: `Bearer ${auth.token}` } },
      )
      // 204 removido agora · 404 nunca existiu · 410 já tinha sido removido
      // (alguém apagou direto no Google). Nos três o resultado desejado é o
      // mesmo: não há evento na agenda. Tratar 410 como erro gerava alarme
      // falso — "remova manualmente" um evento que já não existe.
      if (![204, 404, 410].includes(del.status)) {
        const err = await del.json().catch(() => ({}))
        return json({ ok: false, reason: err?.error?.message || `Erro ${del.status} ao remover do Google Agenda.` })
      }
      await sb.from('agenda_slots').update({ google_calendar_event_id: null }).eq('id', slot.id)
      return json({ ok: true, deleted: true })
    }

    // ── Ocupar: reserva 1h ──
    // O evento fica na agenda de quem marcou, então o nome do VENDEDOR precisa
    // aparecer: senão a pessoa olha a própria agenda e não sabe de quem é a
    // visita que ela reservou.
    const [{ data: marcou }, { data: vendedor }] = await Promise.all([
      sb.from('profiles').select('name, calendar_color').eq('id', slot.booked_by).maybeSingle(),
      sb.from('profiles').select('name').eq('id', slot.seller_id).maybeSingle(),
    ])
    const quemMarcou = marcou?.name || ''
    const cor        = marcou?.calendar_color || null
    const nomeVend   = (vendedor?.name || '').split(' ')[0]

    const start = new Date(slot.slot_at)
    const end   = new Date(start.getTime() + 60 * 60 * 1000)
    const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: { Authorization: `Bearer ${auth.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        summary: `Reservado - ${slot.booked_note || 'horário ocupado'}${nomeVend ? ` (${nomeVend})` : ''}`,
        description: `Horário reservado pela agenda do CRM Vithall${quemMarcou ? ` por ${quemMarcou}` : ''}`
          + `${nomeVend ? `, na agenda de ${nomeVend}` : ''}.`,
        colorId: cor || undefined,
        start: { dateTime: start.toISOString(), timeZone: 'America/Sao_Paulo' },
        end:   { dateTime: end.toISOString(),   timeZone: 'America/Sao_Paulo' },
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      return json({ ok: false, reason: data?.error?.message || `Erro ${res.status} ao criar no Google Agenda.` })
    }

    await sb.from('agenda_slots').update({ google_calendar_event_id: data.id }).eq('id', slot.id)
    return json({ ok: true, eventId: data.id, quemMarcou, cor, corNome: cor ? CORES[cor] : null })
  } catch (e) {
    return json({ error: (e as Error).message }, 500)
  }
})

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

const ORIGIN_LABELS: Record<string, string> = {
  'frias contatinhos': 'Frias contatinhos', 'frias listas': 'Frias listas',
  'lead campanha': 'Lead campanha', 'lead organico': 'Lead orgânico',
  'feiras': 'Eventos', 'indicacao': 'Indicacao',
}
const fmtDate = (v: string | null) => v ? new Date(v).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : ''
const fmtTime = (v: string | null) => v ? new Date(v).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }) : ''

function enderecoDe(c: any) {
  const rua   = [c.address_street, c.address_number].filter(Boolean).join(', ')
  const local = [c.address_neighborhood, c.city].filter(Boolean).join(', ')
  const base  = [rua, local].filter(Boolean).join(' — ')
  return c.address_reference ? `${base}${base ? ' ' : ''}(Ref.: ${c.address_reference})` : base
}

function telefonesDe(c: any) {
  const lista = [c.phone, ...((Array.isArray(c.phones) ? c.phones : []).map((p: any) => p?.n))]
  if (c.phone2 && !lista.includes(c.phone2)) lista.push(c.phone2)
  return lista.filter(Boolean).join(' / ')
}

/** Ficha do cliente no corpo do evento — a mesma que o app já monta quando
 *  adiciona uma visita ao Google Agenda, repetida aqui porque este caminho
 *  roda no servidor (é ele que sabe convidar o vendedor). */
function fichaDoCliente(c: any, visitIso: string) {
  const origem = ORIGIN_LABELS[c.origin] || c.origin || ''
  const linhas: [string, string][] = [
    ['Nome',              c.contact_name || ''],
    ['Empresa',           c.company_name || ''],
    ['Cargo',             c.contact_role || ''],
    ['Telefone',          telefonesDe(c)],
    ['Como surgiu',       c.origin === 'indicacao' && c.indicado_por ? `${origem} (por ${c.indicado_por})` : origem],
    ['Data da marcação',  fmtDate(c.visit_booked_at || c.created_at)],
    ['Data da visita',    fmtDate(visitIso)],
    ['Horário da visita', fmtTime(visitIso)],
    ['Endereço',          enderecoDe(c)],
    ['Onde na lista',     c.list_location || ''],
    ['Observações',       c.notes || ''],
  ]
  return linhas.map(([k, v]) => `${k}: ${v || '—'}`).join('\n')
}

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

/** E-mail para convidar o vendedor.
 *
 *  O caminho natural seria ler o id da agenda `primary` dele (que é o próprio
 *  endereço), mas o app pede só o escopo `calendar.events` — dá para criar e
 *  editar eventos, não para ler dados da agenda. Ampliar o escopo obrigaria
 *  todo mundo a reconectar o Google, então usamos o e-mail de login.
 *
 *  Se esse e-mail não for a conta Google da pessoa, o convite vira um convidado
 *  externo e o evento não chega na agenda dela — o aceite automático falha e o
 *  app avisa, em vez de fingir que deu certo. */
async function emailDoUsuario(sb: any, userId: string) {
  const { data, error } = await sb.auth.admin.getUserById(userId)
  if (error) return null
  return data?.user?.email || null
}

/** Aceita o convite em nome do vendedor.
 *  Ele não deveria ter trabalho nenhum: o horário já foi combinado no CRM, o
 *  convite é só o reflexo disso na agenda. Como o servidor tem o token dele,
 *  a resposta é dada por ele mesmo — sem e-mail e sem pendência na tela. */
async function aceitarConvite(token: string, eventId: string, email: string) {
  // Aceite feito com o token do ORGANIZADOR (quem marcou), não do convidado.
  //
  // Pelo convidado não funciona: contas Gmail pessoais costumam estar em "só
  // adicionar à agenda quando eu responder", então o evento nem existe na
  // agenda dele para ser aceito — a leitura devolve 404. O organizador, por
  // outro lado, é dono do evento e pode definir a resposta de quem convidou.
  const get = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  if (!get.ok) return { ok: false, reason: `evento não encontrado (${get.status})` }
  const ev = await get.json()

  // Reenvia a lista inteira de convidados alterando só a resposta dele —
  // mandar só a própria entrada apagaria os demais participantes.
  const attendees = (ev.attendees || []).map((a: any) =>
    a.email?.toLowerCase() === email.toLowerCase() ? { ...a, responseStatus: 'accepted' } : a)

  const patch = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}?sendUpdates=none`,
    {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ attendees }),
    },
  )
  if (!patch.ok) {
    const err = await patch.json().catch(() => ({}))
    return { ok: false, reason: err?.error?.message || `erro ${patch.status} ao aceitar` }
  }
  return { ok: true }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    // `clientId` chega quando a reserva provisória vira a visita de verdade:
    // o evento passa de "Reservado - nota" para a ficha completa do cliente,
    // sem perder o convite ao vendedor (que é o motivo de isto rodar aqui).
    // `visitIso` permite marcar a visita num horário levemente diferente do
    // horário reservado — 16:30 reservado, visita às 16:45.
    const { slotId, action, clientId, visitIso, organizerId } = await req.json()
    if (!slotId && !clientId) return json({ error: 'slotId ou clientId obrigatório' }, 400)

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    let cliente: any = null
    if (clientId) {
      const { data } = await sb.from('clients').select('*').eq('id', clientId).maybeSingle()
      cliente = data || null
      if (!cliente) return json({ error: 'Cliente não encontrado' }, 404)
    }

    // Sem `slotId` é um evento AVULSO: a pessoa recusou substituir a reserva,
    // mas a visita precisa ir para o Google do mesmo jeito — com o vendedor
    // convidado, senão ele não recebe a ficha do cliente. O horário reservado
    // fica intocado, exatamente como ela pediu.
    let slot: any
    if (slotId) {
      const { data } = await sb
        .from('agenda_slots')
        .select('id, seller_id, booked_by, slot_at, booked_note, status, google_calendar_event_id')
        .eq('id', slotId)
        .maybeSingle()
      if (!data) return json({ error: 'Horário não encontrado' }, 404)
      slot = data
    } else {
      slot = {
        id: null,
        seller_id: cliente.assigned_to,
        booked_by: organizerId || cliente.created_by,
        slot_at: visitIso || cliente.visit_scheduled_at,
        booked_note: null,
        google_calendar_event_id: cliente.google_calendar_event_id,
      }
      if (!slot.booked_by) return json({ error: 'Sem organizador para o evento' }, 400)
    }

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
      if (slot.id) await sb.from('agenda_slots').update({ google_calendar_event_id: null }).eq('id', slot.id)
      else if (cliente) await sb.from('clients').update({ google_calendar_event_id: null }).eq('id', cliente.id)
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
    const nomeMarcou = quemMarcou.split(' ')[0]

    // O vendedor entra como CONVIDADO. É o que faz o evento chegar só a ele
    // (marcando para dois vendedores, cada um recebe o seu) e o que mantém o
    // horário realmente ocupado na agenda dele — sendo que o organizador
    // continua quem marcou, então o e-mail e a cor são os dela.
    let emailVend: string | null = null
    let aviso = ''
    if (slot.seller_id !== slot.booked_by) {
      const vendAuth = await ownerAccessToken(sb, slot.seller_id, 'O vendedor')
      if (vendAuth.error) aviso = vendAuth.error
      else emailVend = await emailDoUsuario(sb, slot.seller_id)
      if (!emailVend && !aviso) aviso = 'Não achei o e-mail do vendedor para convidar.'
      var vendToken = vendAuth.token
    }

    // Com cliente, o horário da visita manda (pode ser 16:45 numa reserva de
    // 16:30); sem cliente, vale o horário reservado.
    const start = new Date(cliente && visitIso ? visitIso : slot.slot_at)
    const end   = new Date(start.getTime() + 60 * 60 * 1000)

    // Quem marcou vem PRIMEIRO no título: é a parte que sobrevive ao corte na
    // visão de mês e no celular, e a cor não consegue dizer isso (o Google só
    // respeita a cor do evento para o dono da agenda).
    const titulo = cliente
      ? `${nomeMarcou ? `${nomeMarcou} → ` : ''}${cliente.contact_name || cliente.company_name || 'Cliente'}`
        + `${cliente.city ? ` · ${cliente.city}` : ''}`
      : `${nomeMarcou ? `${nomeMarcou} → ` : ''}${slot.booked_note || 'Horário ocupado'}`

    const res = await fetch(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=none',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${auth.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          summary: titulo,
          description: cliente
            ? fichaDoCliente(cliente, start.toISOString())
            : `Horário reservado pela agenda do CRM Vithall${quemMarcou ? ` por ${quemMarcou}` : ''}`
              + `${nomeVend ? `, para ${nomeVend}` : ''}.`,
          location: cliente ? (enderecoDe(cliente) || undefined) : undefined,
          colorId: cor || undefined,
          start: { dateTime: start.toISOString(), timeZone: 'America/Sao_Paulo' },
          end:   { dateTime: end.toISOString(),   timeZone: 'America/Sao_Paulo' },
          ...(emailVend ? { attendees: [{ email: emailVend }] } : {}),
        }),
      })
    const data = await res.json()
    if (!res.ok) {
      return json({ ok: false, reason: data?.error?.message || `Erro ${res.status} ao criar no Google Agenda.` })
    }

    // Aceite automático — o vendedor não deve precisar mexer em nada
    let aceite: any = null
    if (emailVend) {
      aceite = await aceitarConvite(auth.token!, data.id, emailVend)
      if (!aceite.ok) aviso = `Evento criado, mas ficou pendente na agenda do vendedor (${aceite.reason}).`
    }

    // Evento avulso não tem horário para carimbar — o id vai direto no cliente
    if (slot.id) {
      await sb.from('agenda_slots').update({
        google_calendar_event_id: data.id,
        ...(cliente ? { client_id: cliente.id } : {}),
      }).eq('id', slot.id)
    }
    if (cliente) {
      await sb.from('clients').update({ google_calendar_event_id: data.id }).eq('id', cliente.id)
    }
    return json({
      ok: true, eventId: data.id, quemMarcou, cor, corNome: cor ? CORES[cor] : null,
      convidado: emailVend, aceite, cliente: cliente?.contact_name || null, aviso: aviso || undefined,
    })
  } catch (e) {
    return json({ error: (e as Error).message }, 500)
  }
})

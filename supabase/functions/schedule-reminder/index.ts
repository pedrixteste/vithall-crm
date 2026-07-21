import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const ONESIGNAL_API_KEY = Deno.env.get('ONESIGNAL_REST_API_KEY')!

// A chave "legacy" do OneSignal autentica com Basic; a nova (os_v2_app_...)
// com Key. Mandar o esquema errado devolve 401 "Access denied" mesmo com a
// chave certa — e a resposta vinha sendo ignorada, entao o push falhava calado.
const OS_AUTH = ONESIGNAL_API_KEY?.startsWith(`os_v2_`)
  ? `Key ${ONESIGNAL_API_KEY}`
  : `Basic ${ONESIGNAL_API_KEY}`
const ONESIGNAL_APP_ID = Deno.env.get('ONESIGNAL_APP_ID')!

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const DAYS_MAP: Record<string, number> = {
  dom: 0, seg: 1, ter: 2, qua: 3, qui: 4, sex: 5, sab: 6,
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const { clientName, reminderConfig, playerId } = await req.json()

    const hasTimes = reminderConfig?.times?.length
    const hasDate  = reminderConfig?.type === 'specific_date' &&
      (reminderConfig?.date || (Array.isArray(reminderConfig?.dates) && reminderConfig.dates.length))
    if (!playerId || (!hasTimes && !hasDate)) {
      return new Response(JSON.stringify({ error: 'Dados insuficientes' }), { status: 400, headers: cors })
    }

    const notifications = buildSchedule(clientName, reminderConfig, playerId)

    let sent = 0
    for (const notif of notifications) {
      const res = await fetch('https://onesignal.com/api/v1/notifications', {
        method: 'POST',
        headers: {
          'Authorization': OS_AUTH,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(notif),
      })
      if (res.ok) sent++
    }

    return new Response(JSON.stringify({ ok: true, agendados: sent }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: cors })
  }
})

function buildSchedule(clientName: string, config: any, playerId: string) {
  const now = new Date()
  const notifications: any[] = []

  const notif = (sendAt: Date) => ({
    app_id: ONESIGNAL_APP_ID,
    include_player_ids: [playerId],
    headings: { pt: `Lembrete: ${clientName}`, en: `Reminder: ${clientName}` },
    contents: { pt: 'Hora de entrar em contato!', en: 'Time to get in touch!' },
    send_after: sendAt.toISOString(),
  })

  const addTimes = (date: Date) => {
    for (const time of config.times) {
      const [h, m] = (time as string).split(':').map(Number)
      const sendAt = new Date(date)
      sendAt.setHours(h, m, 0, 0)
      if (sendAt > now) notifications.push(notif(sendAt))
    }
  }

  if (config.type === 'specific_date') {
    // Uma ou várias datas (formato novo `dates: []`, ou antigo `date`)
    const dates: string[] = Array.isArray(config.dates)
      ? config.dates
      : (config.date ? [config.date] : [])
    const [h, m] = (config.time ? String(config.time).split(':').map(Number) : [9, 0])
    for (const ds of dates) {
      const sendAt = /^\d{4}-\d{2}-\d{2}$/.test(ds) ? new Date(`${ds}T00:00:00`) : new Date(ds)
      if (config.time || /^\d{4}-\d{2}-\d{2}$/.test(ds)) sendAt.setHours(h, m, 0, 0)
      if (sendAt > now) notifications.push(notif(sendAt))
    }

  } else if (config.type === 'in_days') {
    const target = new Date(now)
    target.setDate(target.getDate() + (config.in_days || 7))
    addTimes(target)

  } else if (config.type === 'daily') {
    for (let d = 0; d < 60; d++) {
      const date = new Date(now)
      date.setDate(date.getDate() + d)
      addTimes(date)
    }

  } else if (config.type === 'weekly') {
    const targetDays = (config.days || []).map((d: string) => DAYS_MAP[d])
    for (let d = 0; d < 60; d++) {
      const date = new Date(now)
      date.setDate(date.getDate() + d)
      if (targetDays.includes(date.getDay())) addTimes(date)
    }
  }

  return notifications.slice(0, 100)
}

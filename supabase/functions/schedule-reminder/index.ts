import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const ONESIGNAL_API_KEY = Deno.env.get('ONESIGNAL_REST_API_KEY')!
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

    if (!playerId || !reminderConfig?.times?.length) {
      return new Response(JSON.stringify({ error: 'Dados insuficientes' }), { status: 400, headers: cors })
    }

    const notifications = buildSchedule(clientName, reminderConfig, playerId)

    let sent = 0
    for (const notif of notifications) {
      const res = await fetch('https://onesignal.com/api/v1/notifications', {
        method: 'POST',
        headers: {
          'Authorization': `Key ${ONESIGNAL_API_KEY}`,
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
    include_subscription_uids: [playerId],
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

  if (config.type === 'in_days') {
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

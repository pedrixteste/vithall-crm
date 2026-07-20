import { reminderDates, localDateStr } from './utils'

const DAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab']

export async function requestNotificationPermission() {
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  const result = await Notification.requestPermission()
  return result === 'granted'
}

export function scheduleTodayReminders(clients) {
  if (!('Notification' in window)) return
  if (Notification.permission !== 'granted') return

  const now = new Date()
  const todayKey = DAYS[now.getDay()]

  for (const client of clients) {
    const cfg = client.reminder_config
    if (!cfg) continue

    // Data específica — dispara se HOJE for uma das datas marcadas
    if (cfg.type === 'specific_date') {
      if (reminderDates(cfg).includes(localDateStr(now))) {
        // no horário marcado (se houver), senão agora
        const target = new Date(now)
        if (cfg.time) { const [h, m] = cfg.time.split(':').map(Number); target.setHours(h, m, 0, 0) }
        const delay = Math.max(0, target - now)
        setTimeout(() => {
          new Notification(`Lembrete: ${client.contact_name || client.company_name}`, {
            body: 'Hora de entrar em contato!',
            icon: '/logo.png',
            tag: `client-${client.id}-date`,
            renotify: true,
          })
        }, delay)
      }
      continue
    }

    if (!cfg.times?.length) continue

    let shouldRemindToday = false

    if (cfg.type === 'daily') {
      shouldRemindToday = true
    } else if (cfg.type === 'weekly') {
      shouldRemindToday = (cfg.days || []).includes(todayKey)
    } else if (cfg.type === 'in_days' && cfg.in_days) {
      const created = new Date(client.created_at)
      const target = new Date(created)
      target.setDate(target.getDate() + cfg.in_days)
      shouldRemindToday = target.toDateString() === now.toDateString()
    }

    if (!shouldRemindToday) continue

    for (const time of cfg.times) {
      const [h, m] = time.split(':').map(Number)
      const reminderTime = new Date(now)
      reminderTime.setHours(h, m, 0, 0)

      const delay = reminderTime - now
      if (delay < 0) continue

      setTimeout(() => {
        new Notification(`Lembrete: ${client.contact_name || client.company_name}`, {
          body: 'Hora de entrar em contato!',
          icon: '/logo.png',
          tag: `client-${client.id}-${time}`,
          renotify: true,
        })
      }, delay)
    }
  }
}

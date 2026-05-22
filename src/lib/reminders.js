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
    if (!cfg || !cfg.times?.length) continue

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

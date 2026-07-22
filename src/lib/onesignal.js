import { supabase } from './supabase'

let initialized = false

async function saveSubId(id) {
  if (!id) return
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await supabase.from('profiles').update({ onesignal_player_id: id }).eq('id', user.id)
}

// Espera o OneSignal expor um id de inscrição ATIVO (optedIn), até `ms`.
// Depois de (re)inscrever, o id demora um instante para aparecer; ler cedo
// demais devolvia null ou o id ANTIGO (morto), que era o bug da Amanda.
function waitForActiveSubId(OneSignal, ms = 6000) {
  return new Promise((resolve) => {
    const ps = OneSignal.User.PushSubscription
    if (ps.optedIn && ps.id) { resolve(ps.id); return }
    const onChange = (e) => {
      if (e?.current?.optedIn && e.current.id) finish(e.current.id)
    }
    const finish = (id) => {
      try { ps.removeEventListener('change', onChange) } catch { /* ok */ }
      clearTimeout(timer)
      resolve(id || null)
    }
    ps.addEventListener('change', onChange)
    const timer = setTimeout(() => finish(ps.optedIn ? ps.id : null), ms)
  })
}

// Chama no load do app (silencioso). Além de iniciar, resolve o caso do
// player_id MORTO: se a pessoa bloqueou e depois desbloqueou as notificações,
// a permissão volta mas a assinatura de push é destruída e recriada com um id
// NOVO — que o app precisa capturar, senão segue mandando para o id velho.
export function initOneSignal() {
  if (initialized || !import.meta.env.VITE_ONESIGNAL_APP_ID) return
  initialized = true

  window.OneSignalDeferred = window.OneSignalDeferred || []
  window.OneSignalDeferred.push(async (OneSignal) => {
    await OneSignal.init({
      appId: import.meta.env.VITE_ONESIGNAL_APP_ID,
      notifyButton: { enable: false },
      allowLocalhostAsSecureOrigin: true,
    })

    // Toda vez que a inscrição muda, salva o id atual. É a rede de segurança
    // que captura uma assinatura recriada após um bloquear→desbloquear.
    OneSignal.User.PushSubscription.addEventListener('change', (e) => {
      if (e?.current?.optedIn && e.current.id) saveSubId(e.current.id)
    })

    // Já tem permissão mas a assinatura não está ativa → recria e salva o novo.
    if (OneSignal.Notifications.permission) {
      if (!OneSignal.User.PushSubscription.optedIn) {
        try { await OneSignal.User.PushSubscription.optIn() } catch { /* ok */ }
      }
      const id = await waitForActiveSubId(OneSignal, 6000)
      if (id) saveSubId(id)
    }
  })
}

// Pede permissão e salva a assinatura ATIVA no perfil.
async function requestAndSaveSubscription() {
  return new Promise((resolve) => {
    window.OneSignalDeferred = window.OneSignalDeferred || []
    window.OneSignalDeferred.push(async (OneSignal) => {
      const granted = await OneSignal.Notifications.requestPermission()
      if (!granted) { resolve(null); return }
      // Força a (re)inscrição: depois de desbloquear, a permissão volta mas a
      // assinatura não é recriada sozinha.
      try { await OneSignal.User.PushSubscription.optIn() } catch { /* ok */ }
      const id = await waitForActiveSubId(OneSignal, 6000)
      if (id) { await saveSubId(id); resolve(id) } else resolve(null)
    })
  })
}

// Botão "Ativar notificações" (Perfil).
export async function enablePushNotifications() {
  return requestAndSaveSubscription()
}

// Reinscrição FORÇADA — para quem a permissão já está concedida mas parou de
// receber (o player_id salvo apontava para uma assinatura morta). optOut +
// optIn garante uma assinatura nova, com id novo.
export async function reactivatePush() {
  return new Promise((resolve) => {
    window.OneSignalDeferred = window.OneSignalDeferred || []
    window.OneSignalDeferred.push(async (OneSignal) => {
      try {
        if (!OneSignal.Notifications.permission) {
          const granted = await OneSignal.Notifications.requestPermission()
          if (!granted) { resolve(null); return }
        }
        try { await OneSignal.User.PushSubscription.optOut() } catch { /* ok */ }
        try { await OneSignal.User.PushSubscription.optIn() } catch { /* ok */ }
        const id = await waitForActiveSubId(OneSignal, 8000)
        if (id) { await saveSubId(id); resolve(id) } else resolve(null)
      } catch { resolve(null) }
    })
  })
}

// Silencioso, no load: se já permitido e a assinatura está ativa, garante o
// id atual salvo. (O grosso do trabalho é do initOneSignal.)
export async function syncPushIfGranted() {
  if (!import.meta.env.VITE_ONESIGNAL_APP_ID) return
  window.OneSignalDeferred = window.OneSignalDeferred || []
  window.OneSignalDeferred.push(async (OneSignal) => {
    try {
      if (OneSignal.Notifications.permission && OneSignal.User.PushSubscription.optedIn) {
        const id = OneSignal.User.PushSubscription.id
        if (id) await saveSubId(id)
      }
    } catch { /* ignora */ }
  })
}

// Estado da permissão de notificação p/ a UI: 'granted' | 'denied' | 'default'
export function getNotificationPermission() {
  if (typeof Notification === 'undefined') return 'unsupported'
  return Notification.permission
}

// Chamado ao salvar um cliente com lembrete configurado
export async function scheduleClientReminder({ clientName, clientId, reminderConfig }) {
  const hasTimes = reminderConfig?.times?.length
  const hasDate  = reminderConfig?.type === 'specific_date' && reminderConfig?.date
  if (!hasTimes && !hasDate) return

  // Pega o player_id salvo do usuario
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { data: profile } = await supabase
    .from('profiles')
    .select('onesignal_player_id')
    .eq('id', user.id)
    .single()

  let playerId = profile?.onesignal_player_id

  // Se ainda nao tem, pede permissao agora
  if (!playerId) {
    playerId = await requestAndSaveSubscription()
  }

  if (!playerId) return

  // Manda para a Edge Function agendar no OneSignal
  await supabase.functions.invoke('schedule-reminder', {
    body: { clientName, clientId, reminderConfig, playerId },
  })
}

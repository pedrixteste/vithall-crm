import { supabase } from './supabase'

let initialized = false

// Chama no load do app (silencioso, sem pedir permissao ainda)
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
  })
}

// Pede permissao e salva o ID de assinatura no perfil do usuario
async function requestAndSaveSubscription() {
  return new Promise((resolve) => {
    window.OneSignalDeferred = window.OneSignalDeferred || []
    window.OneSignalDeferred.push(async (OneSignal) => {
      const granted = await OneSignal.Notifications.requestPermission()
      if (!granted) { resolve(null); return }

      // Tenta pegar o ID imediatamente
      let subId = OneSignal.User?.PushSubscription?.id
      if (!subId) {
        // Aguarda ate 5s pela assinatura
        await new Promise(r => {
          const handler = () => { r(); OneSignal.User.PushSubscription.removeEventListener('change', handler) }
          OneSignal.User.PushSubscription.addEventListener('change', handler)
          setTimeout(r, 5000)
        })
        subId = OneSignal.User?.PushSubscription?.id
      }

      if (subId) {
        await saveSubId(subId)
        resolve(subId)
      } else {
        resolve(null)
      }
    })
  })
}

async function saveSubId(id) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await supabase.from('profiles').update({ onesignal_player_id: id }).eq('id', user.id)
}

// Botão "Ativar notificações" (Perfil): pede permissão e salva a assinatura.
// Retorna o id da assinatura, ou null se a pessoa recusou.
export async function enablePushNotifications() {
  return requestAndSaveSubscription()
}

// Silencioso, no load do app: se a permissão JÁ foi concedida antes, garante
// que o player_id atual esteja salvo no perfil (sem mostrar nenhum prompt).
export async function syncPushIfGranted() {
  if (!import.meta.env.VITE_ONESIGNAL_APP_ID) return
  window.OneSignalDeferred = window.OneSignalDeferred || []
  window.OneSignalDeferred.push(async (OneSignal) => {
    try {
      if (!OneSignal.Notifications.permission) return // ainda não permitiu
      const subId = OneSignal.User?.PushSubscription?.id
      if (subId) await saveSubId(subId)
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

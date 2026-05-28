// Helpers para Google Calendar API
import { supabase } from './supabase'

export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID
const SCOPES = 'https://www.googleapis.com/auth/calendar.events'

/** Gera a URL de autenticação OAuth do Google */
export function getGoogleAuthUrl() {
  const redirectUri = `${window.location.origin}/auth/google/callback`
  const params = new URLSearchParams({
    client_id:     GOOGLE_CLIENT_ID,
    redirect_uri:  redirectUri,
    response_type: 'code',
    scope:         SCOPES,
    access_type:   'offline',
    prompt:        'consent',
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`
}

/**
 * Retorna um access_token válido para o usuário.
 * Renova automaticamente se expirado.
 * @param {object} profile — registro da tabela profiles
 * @returns {string|null} access_token ou null se não conectado
 */
export async function getValidToken(profile) {
  if (!profile?.google_refresh_token) return null

  const now = Date.now()
  // Token ainda válido (com 5 min de margem)
  if (profile.google_access_token && profile.google_token_expiry > now + 300_000) {
    return profile.google_access_token
  }

  // Renovar via Edge Function (secret fica seguro no servidor)
  const { data, error } = await supabase.functions.invoke('google-auth', {
    body: { action: 'refresh', refresh_token: profile.google_refresh_token },
  })
  if (error || !data?.access_token) return null

  const expiry = Date.now() + data.expires_in * 1000
  await supabase.from('profiles').update({
    google_access_token:  data.access_token,
    google_token_expiry:  expiry,
  }).eq('id', profile.id)

  return data.access_token
}

/**
 * Cria evento no Google Calendar primário do usuário.
 * @returns {string} id do evento criado
 */
export async function createCalendarEvent(accessToken, { clientName, visitDateTime }) {
  const start = new Date(visitDateTime)
  const end   = new Date(start.getTime() + 60 * 60 * 1000) // 1h de duração padrão

  const res = await fetch(
    'https://www.googleapis.com/calendar/v3/calendars/primary/events',
    {
      method: 'POST',
      headers: {
        Authorization:  `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        summary:     `Visita Vithall — ${clientName}`,
        description: 'Visita comercial agendada pelo CRM Vithall',
        start: { dateTime: start.toISOString(), timeZone: 'America/Sao_Paulo' },
        end:   { dateTime: end.toISOString(),   timeZone: 'America/Sao_Paulo' },
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'popup', minutes: 60 },
            { method: 'popup', minutes: 15 },
          ],
        },
      }),
    }
  )

  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error?.message || 'Falha ao criar evento no Google Agenda')
  }

  const data = await res.json()
  return data.id // ID do evento — salvar no banco
}

/**
 * Deleta um evento do Google Calendar.
 * Retorna true em caso de sucesso (204) ou evento já inexistente (404).
 */
export async function deleteCalendarEvent(accessToken, eventId) {
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
    {
      method:  'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  )
  return res.status === 204 || res.status === 404
}

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

// Tokens do Google ficam em `google_tokens` (RLS: cada um só lê o próprio),
// nunca em `profiles` — assim um colega não consegue ler o token de outro.
// Helpers de leitura/escrita/remoção usados pelas telas de Google Agenda.
export async function fetchGoogleTokens(userId) {
  if (!userId) return null
  const { data } = await supabase
    .from('google_tokens')
    .select('access_token, refresh_token, token_expiry')
    .eq('id', userId)
    .maybeSingle()
  return data || null
}

export async function saveGoogleTokens(userId, { access_token, refresh_token, token_expiry }) {
  await supabase.from('google_tokens').upsert({
    id: userId, access_token, refresh_token, token_expiry,
  }, { onConflict: 'id' })
  await supabase.from('profiles').update({ google_connected: true }).eq('id', userId)
}

export async function clearGoogleTokens(userId) {
  await supabase.from('google_tokens').delete().eq('id', userId)
  await supabase.from('profiles').update({ google_connected: false }).eq('id', userId)
}

/**
 * Retorna um access_token válido para o usuário (renova se expirado).
 * @param {string} userId — id do usuário (dono do token)
 * @returns {string|null} access_token ou null se não conectado
 */
export async function getValidToken(userId) {
  const tok = await fetchGoogleTokens(userId)
  if (!tok?.refresh_token) return null

  const now = Date.now()
  // Token ainda válido (com 5 min de margem)
  if (tok.access_token && tok.token_expiry > now + 300_000) {
    return tok.access_token
  }

  // Renovar via Edge Function (secret fica seguro no servidor)
  const { data, error } = await supabase.functions.invoke('google-auth', {
    body: { action: 'refresh', refresh_token: tok.refresh_token },
  })
  if (error || !data?.access_token) return null

  const expiry = Date.now() + data.expires_in * 1000
  await supabase.from('google_tokens').update({
    access_token: data.access_token,
    token_expiry: expiry,
  }).eq('id', userId)

  return data.access_token
}

const ORIGIN_LABELS = {
  'frias contatinhos': 'Frias contatinhos',
  'frias listas':      'Frias listas',
  'lead campanha':     'Lead campanha',
  'lead organico':     'Lead orgânico',
  'feiras':            'Eventos',
  'indicacao':         'Indicacao',
}

const fmtDate = (v) => {
  if (!v) return ''
  const d = new Date(v)
  return isNaN(d) ? '' : d.toLocaleDateString('pt-BR')
}

const fmtTime = (v) => {
  if (!v) return ''
  const d = new Date(v)
  return isNaN(d) ? '' : d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

/** "Rua X, 123 — Bairro, Cidade (Ref.: perto do posto)" */
function formatAddress(c) {
  const rua    = [c.address_street, c.address_number].filter(Boolean).join(', ')
  const local  = [c.address_neighborhood, c.city].filter(Boolean).join(', ')
  const base   = [rua, local].filter(Boolean).join(' — ')
  return c.address_reference ? `${base}${base ? ' ' : ''}(Ref.: ${c.address_reference})` : base
}

function formatOrigin(c) {
  const label = ORIGIN_LABELS[c.origin] || c.origin || ''
  return c.origin === 'indicacao' && c.indicado_por ? `${label} (por ${c.indicado_por})` : label
}

/** Título do evento: "Nome do cliente - Cidade" */
export function buildEventSummary(c) {
  const nome = c.contact_name || c.company_name || 'Cliente'
  return c.city ? `${nome} - ${c.city}` : nome
}

/**
 * Descrição do evento com a ficha da marcação — todos os dados que
 * quem marcou já preencheu, para o vendedor ver direto na agenda.
 */
export function buildEventDescription(c, visitDateTime) {
  const linhas = [
    ['Nome',              c.contact_name || ''],
    ['Empresa',           c.company_name || ''],
    ['Cargo',             c.contact_role || ''],
    ['Telefone',          [c.phone, c.phone2].filter(Boolean).join(' / ')],
    ['Como surgiu',       formatOrigin(c)],
    ['Data da marcação',  fmtDate(c.created_at)],
    ['Data da visita',    fmtDate(visitDateTime)],
    ['Horário da visita', fmtTime(visitDateTime)],
    ['Endereço',          formatAddress(c)],
    ['Observações',       c.notes || ''],
  ]
  return linhas.map(([label, valor]) => `${label}: ${valor || '—'}`).join('\n')
}

/**
 * Cria evento no Google Calendar primário do usuário.
 * Passe `clientId` (busca a ficha completa) ou `client` (row já carregada);
 * `clientName` segue aceito como fallback mínimo.
 * @returns {string} id do evento criado
 */
export async function createCalendarEvent(accessToken, { clientId, client, clientName, visitDateTime }) {
  const start = new Date(visitDateTime)
  const end   = new Date(start.getTime() + 60 * 60 * 1000) // 1h de duração padrão

  let c = client || null
  if (!c && clientId) {
    const { data } = await supabase.from('clients').select('*').eq('id', clientId).maybeSingle()
    c = data || null
  }
  if (!c) c = { contact_name: clientName || 'Cliente' }

  const res = await fetch(
    'https://www.googleapis.com/calendar/v3/calendars/primary/events',
    {
      method: 'POST',
      headers: {
        Authorization:  `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        summary:     buildEventSummary(c),
        description: buildEventDescription(c, visitDateTime),
        location:    formatAddress(c) || undefined,
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

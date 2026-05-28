-- ── Migração: Integração Google Calendar ──────────────────────────
-- Rodar no Supabase SQL Editor

-- Tokens OAuth do Google por usuário
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS google_access_token  text,
  ADD COLUMN IF NOT EXISTS google_refresh_token text,
  ADD COLUMN IF NOT EXISTS google_token_expiry  bigint;

-- ID do evento no Google Calendar vinculado à visita agendada
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS google_calendar_event_id text;

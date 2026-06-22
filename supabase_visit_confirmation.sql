-- ── Migração: Confirmação de visitas agendadas ────────────────────
-- Rodar no Supabase SQL Editor

-- Status da confirmação da visita agendada, preenchido por quem marcou (created_by)
--   null            = ainda não respondido
--   'confirmada'    = cliente confirmou a visita (verde)
--   'nao_confirmada'= visita não foi confirmada (vermelho) + motivo
--   'tentativa'     = houve tentativas de confirmar sem sucesso (roxo) + descrição
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS visit_confirmation      text,
  ADD COLUMN IF NOT EXISTS visit_confirmation_note text;

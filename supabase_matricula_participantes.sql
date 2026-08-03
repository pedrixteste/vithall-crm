-- Participantes da matrícula (03/ago/2026)
--
-- Antes: 1 crédito por cliente (client_id UNIQUE) — a matrícula só podia contar
-- para UMA pessoa, quem marcou a visita. Agora, na estrela, quem preenche pode
-- marcar mais gente que participou da matrícula (cada uma com o motivo), e cada
-- participante recebe essa matrícula na conta dele.
--
-- ⚠️ Ordem: rodar ISTO e fazer o deploy do app em seguida. O código ANTIGO faz
-- upsert com on_conflict=client_id, que deixa de existir aqui.

alter table matricula_credits drop constraint if exists matricula_credits_client_id_key;

-- motivo da participação (obrigatório na tela para quem não marcou a visita)
alter table matricula_credits add column if not exists note text;
-- false = quem marcou a visita | true = participante escolhido na estrela
alter table matricula_credits add column if not exists is_participant boolean not null default false;

-- uma pessoa não pode ter 2 créditos do mesmo cliente
create unique index if not exists matricula_credits_client_person_key
  on matricula_credits (client_id, credited_to);

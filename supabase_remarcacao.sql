-- ─────────────────────────────────────────────────────────────────────────
-- REMARCAÇÃO DE VISITA — 04/09/2026
--
-- Botão "Remarcar" na ficha: libera quando a visita foi cancelada, o cliente
-- não apareceu, ou a data passou sem ninguém registrar nada. Pede motivo,
-- vendedor, data nova e pergunta se o endereço mudou.
--
-- O que JÁ existia e continua valendo (não duplicar!):
--   visit_reschedule_count  — quantas vezes remarcou
--   visit_first_booked_at   — quando foi a PRIMEIRA marcação
--   visit_booked_at         — quando foi a marcação atual
--   client_history 'visit_scheduled' {from,to} — o rastro de cada marcação
-- Esta migração acrescenta só o que faltava: QUEM remarcou, QUEM marcou na
-- origem (comissão dividida) e a lista de endereços.
--
-- ⚠️ RODAR ANTES DE SUBIR O CÓDIGO: sem a trava nova, toda remarcação volta
-- erro 400 e o usuário só vê "não foi possível salvar".
-- ─────────────────────────────────────────────────────────────────────────

-- 1. Estágio novo "remarcado" ────────────────────────────────────────────
-- Ninguém escolhe na mão: só acontece quando uma visita é remarcada de
-- verdade. Continua podendo ser trocado para outro depois.
alter table public.clients drop constraint if exists clients_matricula_stage_check;

alter table public.clients add constraint clients_matricula_stage_check
  check (matricula_stage = any (array[
    'nao_marcou'::text,
    'pediu_ligar'::text,
    'marcacao_futura'::text,
    'marcado'::text,
    'remarcado'::text,
    'nao_visitado'::text,
    'nao_apareceu'::text,
    'cancelado'::text,
    'recebeu_visita'::text,
    'matriculado'::text
  ]));

-- 2. Quem remarcou e quem marcou na origem ───────────────────────────────
-- `visit_scheduled_by` já guarda quem marcou a visita ATUAL (na remarcação,
-- passa a ser quem remarcou). Faltava o outro lado: quem marcou na PRIMEIRA
-- vez — sem ele a comissão da pessoa que marcou some na primeira remarcação
-- (o caso Mafe/Amanda).
--
-- SEM BACKFILL de propósito: nenhuma linha de cliente existente é tocada.
-- Para os clientes antigos o app deduz a origem do histórico
-- (primeiro evento 'visit_scheduled'), com created_by como último recurso.
alter table public.clients
  add column if not exists visit_first_booked_by uuid references public.profiles(id),
  add column if not exists remarcado_por         uuid references public.profiles(id),
  add column if not exists remarcado_em          timestamptz,
  add column if not exists remarcacao_motivo     text;

comment on column public.clients.visit_first_booked_by is
  'Quem fez a PRIMEIRA marcação da visita. Nunca muda. Divide a comissão com visit_scheduled_by (quem remarcou por último).';
comment on column public.clients.remarcado_por is
  'Última pessoa que remarcou. O rastro completo (todas as remarcações) vive em client_history, evento visit_scheduled.';

-- 3. Endereços do cliente (até 3) ────────────────────────────────────────
-- As 4 colunas antigas (address_street/number/neighborhood/reference + city)
-- CONTINUAM sendo o endereço ATUAL — é o que o Google Maps, a ficha do Google
-- Agenda, o CSV, o PDF e o backup leem. Esta lista é o histórico ao lado.
--
-- Formato de cada item:
--   { id, rua, numero, bairro, cidade, referencia,
--     criado_em, criado_por, atual: bool,
--     excluido_em: null|iso, excluido_por: null|uuid, excluido_motivo }
--
-- Excluir NÃO apaga: marca excluido_em. É por isso que o endereço excluído
-- sobrevive na planilha-espelho — ela é um retrato do estado atual, então o
-- que sai do dado some do backup na noite seguinte.
--
-- Fica NULL nos clientes antigos: o app monta o item "principal" a partir das
-- colunas antigas quando a lista está vazia. Nenhuma linha existente é tocada.
alter table public.clients
  add column if not exists enderecos jsonb;

comment on column public.clients.enderecos is
  'Até 3 endereços ativos + os excluídos (excluido_em preenchido). O endereço marcado atual:true é espelhado nas colunas address_* do próprio cliente.';

-- 4. Comissão: o papel de cada crédito ───────────────────────────────────
-- A tabela já aceitava várias pessoas por cliente (participantes da estrela).
-- Agora cada linha diz POR QUE aquela pessoa recebeu — é isso que o relatório
-- usa para separar "marcou" de "remarcou" sem ter que adivinhar depois.
alter table public.matricula_credits
  add column if not exists role text;

comment on column public.matricula_credits.role is
  'marcou | remarcou | participante. Linhas antigas ficam NULL: o app trata NULL como "marcou" quando não é participante.';

-- 5. De quem é o número PRINCIPAL ────────────────────────────────────
-- Os números adicionais guardam isso no campo `d` de cada item de `phones`.
-- O principal mora em colunas soltas (phone/phone_type) e não tinha onde
-- guardar — resultado: o "de quem é" digitado ao trocar de número era jogado
-- fora na hora de salvar, porque o número novo vira o principal.
alter table public.clients add column if not exists phone_desc text;

comment on column public.clients.phone_desc is
  'De quem é o número principal (da esposa, do sócio). Os adicionais guardam no campo d de phones.';

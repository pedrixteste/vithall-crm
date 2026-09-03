-- ─────────────────────────────────────────────────────────────────────────
-- CARTEIRA (dono do contato) — 03/09/2026
--
-- Problema: `clients.created_by` fazia duas coisas ao mesmo tempo:
--   1. quem ENXERGA o contato (pré-vendas só vê os que cadastrou);
--   2. quem MARCOU a visita (o número do relatório).
-- Com isso, passar a carteira de alguém que sai da equipe roubava o crédito
-- das marcações antigas: os números de julho/agosto trocavam de dono.
--
-- Solução: `carteira_de` diz quem TRABALHA o contato hoje (normalmente
-- vazio = quem cadastrou). `dono_id` é calculado pelo banco e é o que o app
-- usa para mostrar/esconder. `created_by` fica intocado — o relatório
-- continua contando a marcação para quem marcou de verdade.
-- ─────────────────────────────────────────────────────────────────────────

alter table clients add column if not exists carteira_de uuid references profiles(id);

-- Calculada pelo banco: ninguém precisa manter isso na mão (e não dá pra
-- escrever nela). Se a carteira está vazia, o dono é quem cadastrou.
alter table clients add column if not exists dono_id uuid generated always as (coalesce(carteira_de, created_by)) stored;

create index if not exists clients_dono_id_idx on clients (dono_id);

comment on column clients.carteira_de is 'Quem trabalha o contato hoje (transferencia de carteira). Vazio = quem cadastrou.';
comment on column clients.dono_id is 'Calculada: coalesce(carteira_de, created_by). E a coluna que o app usa para mostrar o contato ao dono. NAO usar em metrica: quem marcou a visita e created_by.';

-- ─────────────────────────────────────────────────────────────────────────
-- TRANSFERÊNCIA DE CARTEIRA — roteiro para o dia em que alguém sair.
-- NÃO RODA NADA AQUI: está comentado de propósito. Trocar os dois ids e
-- rodar bloco por bloco, conferindo a contagem antes.
--
--   :sai   = quem está saindo        :fica = quem assume
--
-- Regra: passa o TRABALHO (contatos, lembretes, tarefas, visitas futuras).
-- NÃO passa o HISTÓRICO (ligações do dia, comissões, histórico do cliente,
-- quem marcou cada visita) — senão os relatórios do passado mudam.
-- ─────────────────────────────────────────────────────────────────────────
--
-- -- 1. contatos: só os que ainda estão em aberto (fechado/perdido fica onde está)
-- update clients set carteira_de = ':fica'
--  where coalesce(carteira_de, created_by) = ':sai'
--    and matricula_stage not in ('matriculado', 'cancelado');
--
-- -- 2. "ligar depois" pendentes (os concluídos ficam no histórico dela)
-- update callbacks set created_by = ':fica' where created_by = ':sai' and done = false;
--
-- -- 3. tarefas pendentes
-- update tasks set seller_id = ':fica' where seller_id = ':sai' and done = false;
--
-- -- 4. confirmação das visitas que ainda vão acontecer (quem recebe o pop-up)
-- update clients set visit_scheduled_by = ':fica'
--  where visit_scheduled_by = ':sai' and visit_scheduled_at > now();
--
-- -- 5. horários reservados na agenda daqui pra frente
-- update agenda_slots set booked_by = ':fica' where booked_by = ':sai' and slot_date >= current_date;
--
-- -- NÃO MEXER: daily_logs (ligações dela), matricula_credits (comissões),
-- -- client_history (registro do que aconteceu), created_by dos clientes.
-- -- A conta da pessoa TAMBÉM não se apaga: as chaves são NO ACTION e o banco
-- -- recusaria; e apagar levaria notificações e o token do Google com ela.
-- -- Para voltar atrás: update clients set carteira_de = null where carteira_de = ':fica';
--
-- Google Agenda: os eventos criados por quem saiu continuam na agenda DELA.
-- O CRM não consegue mexer nisso (o acesso é por pessoa) — as visitas
-- futuras precisam ser recriadas na agenda de quem assumiu.

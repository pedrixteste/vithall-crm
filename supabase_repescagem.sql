-- ─────────────────────────────────────────────────────────────────────────
-- REPESCAGEM — 03/09/2026
--
-- "Religar para esse cliente no futuro": o vendedor achou a visita boa e viu
-- potencial, ou o pré-vendas quer voltar nesse contato mais pra frente. Quem
-- marca escreve o MOTIVO (obrigatório) e escolhe quando quer ser lembrado
-- (todo dia / dias da semana / todo mês / datas específicas), com hora.
--
-- Só UMA pessoa por cliente pode ter repescagem ao mesmo tempo — daí os
-- campos morarem na própria linha do cliente em vez de uma tabela de muitos:
-- a exclusividade fica garantida pelo banco (a coluna só guarda um dono) e o
-- app trava a marcação com `update ... where repescagem_by is null`, que é
-- atômico. Duas pessoas apertando no mesmo segundo: a segunda não grava.
--
-- Bônus: a planilha-espelho copia a linha inteira de `clients` (to_jsonb),
-- então a repescagem entra no backup noturno sem mexer em nada.
--
-- ⚠️ RODAR ANTES DO DEPLOY — o app já lê/escreve estas colunas.
-- ─────────────────────────────────────────────────────────────────────────

alter table public.clients
  add column if not exists repescagem_by     uuid references public.profiles(id),
  add column if not exists repescagem_reason text,
  add column if not exists repescagem_config jsonb,
  add column if not exists repescagem_at     timestamptz;

-- A aba "Hoje" busca "as repescagens que são minhas" em cada carregamento
create index if not exists clients_repescagem_by_idx
  on public.clients (repescagem_by) where repescagem_by is not null;

comment on column public.clients.repescagem_by is
  'Quem marcou a repescagem. Enquanto estiver preenchido, mais ninguém pode marcar neste cliente — e só essa pessoa recebe o lembrete e pode desmarcar.';
comment on column public.clients.repescagem_reason is
  'Motivo da repescagem (obrigatório na tela). Aparece no lembrete da aba Hoje e na notificação.';
comment on column public.clients.repescagem_config is
  'Quando lembrar: { type: daily | weekly | monthly | specific_date, days: [seg..dom], day: 1-31, dates: [YYYY-MM-DD], time: HH:MM }. Mesmo formato do reminder_config, com "monthly" e "day" a mais.';
comment on column public.clients.repescagem_at is
  'Quando a repescagem foi marcada (não é a data do lembrete).';

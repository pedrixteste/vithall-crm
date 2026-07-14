-- Crédito de matrícula para comissão: quando um cliente vira "matriculado",
-- registra 1 crédito para quem marcou a visita ATUAL (visit_scheduled_by,
-- fallback created_by) — se a visita foi remarcada, o crédito vai para quem
-- remarcou. Uma matrícula por cliente (unique); sai do estágio → crédito some.

create table if not exists matricula_credits (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references clients(id) unique,
  credited_to uuid not null references profiles(id),
  enrolled_by uuid references profiles(id),
  credit_date date not null,
  created_at  timestamptz default now()
);

alter table matricula_credits enable row level security;

create policy "Authenticated users can manage matricula credits"
  on matricula_credits for all
  using (auth.role() = 'authenticated');

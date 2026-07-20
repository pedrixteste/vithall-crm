-- "Cliente pediu para ligar depois" — lembrete leve de ligação, SEPARADO da
-- lista de clientes. Só nome e telefone obrigatórios; aparece na aba Hoje nos
-- dias marcados (reminder_config: daily | weekly | specific_date).
create table if not exists callbacks (
  id              uuid primary key default gen_random_uuid(),
  created_by      uuid references profiles(id),
  contact_name    text not null,
  phone           text not null,
  company_name    text,
  contact_role    text,
  reminder_config jsonb,           -- { type:'daily' } | { type:'weekly', days:[] } | { type:'specific_date', date:'YYYY-MM-DD' }
  done            boolean default false,
  created_at      timestamptz default now()
);
alter table callbacks enable row level security;
drop policy if exists callbacks_auth on callbacks;
create policy callbacks_auth on callbacks
  for all using (auth.role() = 'authenticated');

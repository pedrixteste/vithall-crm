-- ============================================================
-- Endurecimento de segurança (16/07/2026) — rodar UMA vez, DEPOIS do deploy
-- do código que usa google_tokens/google_connected.
-- ============================================================

-- #2 — Bloquear auto-promoção de papel: só um GERENTE pode alterar `role`.
--     (a pessoa não consegue mais se tornar gerente sozinha)
create or replace function guard_profile_role()
returns trigger as $$
begin
  if new.role is distinct from old.role
     and coalesce((select role from profiles where id = auth.uid()), '') <> 'gerente' then
    raise exception 'Somente gerentes podem alterar papeis';
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_guard_profile_role on profiles;
create trigger trg_guard_profile_role
  before update on profiles
  for each row execute function guard_profile_role();

-- #3 — Tokens do Google numa tabela separada onde cada um só lê o PRÓPRIO.
create table if not exists google_tokens (
  id            uuid primary key references profiles(id) on delete cascade,
  access_token  text,
  refresh_token text,
  token_expiry  bigint,
  updated_at    timestamptz default now()
);
alter table google_tokens enable row level security;
drop policy if exists google_tokens_own on google_tokens;
create policy google_tokens_own on google_tokens
  for all using (auth.uid() = id) with check (auth.uid() = id);

-- Flag pública "conectado ao Google?" (essa é segura de ler entre colegas)
alter table profiles add column if not exists google_connected boolean default false;

-- Migra tokens já existentes de profiles -> google_tokens
insert into google_tokens (id, access_token, refresh_token, token_expiry)
select id, google_access_token, google_refresh_token, google_token_expiry
from profiles
where google_refresh_token is not null
on conflict (id) do update set
  access_token  = excluded.access_token,
  refresh_token = excluded.refresh_token,
  token_expiry  = excluded.token_expiry;

update profiles set google_connected = true where google_refresh_token is not null;

-- Remove as colunas de token de profiles (fim da exposição entre colegas)
alter table profiles
  drop column if exists google_access_token,
  drop column if exists google_refresh_token,
  drop column if exists google_token_expiry;

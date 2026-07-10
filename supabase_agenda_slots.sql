-- Agenda de disponibilidade dos vendedores/gerente.
-- Cada linha = um horário que o vendedor abriu para visitas.
-- status: 'livre' | 'ocupado' (ocupação manual, sem vínculo com clients).

create table if not exists agenda_slots (
  id          uuid primary key default gen_random_uuid(),
  seller_id   uuid not null references profiles(id),
  slot_at     timestamptz not null,
  status      text not null default 'livre',
  booked_by   uuid references profiles(id),
  booked_note text,
  created_at  timestamptz default now(),
  unique (seller_id, slot_at)
);

alter table agenda_slots enable row level security;

create policy "Authenticated users can manage agenda slots"
  on agenda_slots for all
  using (auth.role() = 'authenticated');

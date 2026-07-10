-- Quem agendou a visita ATUAL (visit_scheduled_at) — é essa pessoa que
-- confirma a visita no pop-up (não necessariamente quem cadastrou o cliente).
-- Ex: vendedor marca retorno pela estrela → ele mesmo confirma o retorno.

alter table clients add column if not exists visit_scheduled_by uuid references profiles(id);

-- Registros existentes: assume que quem cadastrou foi quem marcou
update clients
set visit_scheduled_by = created_by
where visit_scheduled_by is null
  and visit_scheduled_at is not null;

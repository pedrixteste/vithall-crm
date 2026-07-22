-- Tarefas soltas criadas pelo Dashboard: hora do lembrete + urgência (0-10)
alter table public.tasks add column if not exists due_time time;
alter table public.tasks add column if not exists urgency integer;
alter table public.tasks add constraint tasks_urgency_range check (urgency is null or (urgency between 0 and 10));

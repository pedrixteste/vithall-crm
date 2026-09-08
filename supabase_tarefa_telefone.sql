-- Telefone opcional na tarefa solta (08/09/2026)
--   npx supabase db query --linked -f supabase_tarefa_telefone.sql
-- Aditiva. Roda ANTES do deploy: o formulário de tarefa passa a gravar aqui e
-- a aba Hoje / Dashboard mostram o número clicável (tel:).
alter table public.tasks add column if not exists phone text;

select column_name, data_type from information_schema.columns
 where table_schema = 'public' and table_name = 'tasks' and column_name = 'phone';

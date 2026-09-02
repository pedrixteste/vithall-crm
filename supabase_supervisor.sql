-- Conta supervisora: enxerga os outros gerentes nos relatórios
alter table public.profiles add column if not exists supervisor boolean not null default false;
update public.profiles set supervisor = true where id = '3cefeeae-0736-4f90-8740-92bb7c2685a4'; -- pedro

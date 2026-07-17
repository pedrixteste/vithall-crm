-- Dias úteis em que o cliente está livre para receber visita (Seg–Sex, opcional)
alter table clients add column if not exists dias_livres text[] default '{}';

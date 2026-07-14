-- Ligações atendidas no registro diário (aba Ligações)
alter table daily_logs add column if not exists answered integer not null default 0;

-- Segundo telefone do cliente: phone_type diz o tipo do NÚMERO PRINCIPAL
-- ('pessoal' | 'empresa'); phone2 é o número do outro tipo (opcional).
alter table clients add column if not exists phone_type text default 'pessoal';
alter table clients add column if not exists phone2 text;

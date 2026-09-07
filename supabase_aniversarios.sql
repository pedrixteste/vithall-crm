-- Aniversários do cliente (06-07/09/2026)
--   npx supabase db query --linked -f supabase_aniversarios.sql
--
-- Aditiva: só colunas novas em clients, todas opcionais. Roda ANTES do deploy
-- do app (o cadastro e a ficha passam a gravar aqui).
--
--   aniversario_dia / aniversario_mes  — aniversário de idade (o ano é
--                                        opcional: nem sempre a pessoa sabe)
--   nascimento_ano                     — quando souber, o app mostra a idade
--   aniversario_vithall                — data da PRIMEIRA matrícula/treinamento,
--                                        preenchida à mão por quem vendeu;
--                                        todo ano vira "faz X anos de Vithall"
--   turma                              — número/nome da turma do treinamento
--                                        (texto livre, só na ficha; a busca
--                                        da aba Clientes acha por ele)
--
-- A planilha-espelho copia a linha inteira (to_jsonb), então as colunas novas
-- entram no backup sozinhas. A trava por dono (RLS) não muda: quem vê o
-- cliente pode editar essas datas.

alter table public.clients
  add column if not exists aniversario_dia     smallint,
  add column if not exists aniversario_mes     smallint,
  add column if not exists nascimento_ano      smallint,
  add column if not exists aniversario_vithall date,
  add column if not exists turma               text;

-- Dia e mês andam juntos: ou os dois preenchidos, ou nenhum.
alter table public.clients drop constraint if exists clients_aniversario_check;
alter table public.clients add constraint clients_aniversario_check check (
  (aniversario_dia is null) = (aniversario_mes is null)
  and (aniversario_mes is null or aniversario_mes between 1 and 12)
  and (aniversario_dia is null or aniversario_dia between 1 and 31)
  and (nascimento_ano is null or nascimento_ano between 1900 and 2100)
);

-- O robô das 08:10 e a aba Hoje perguntam "quem faz aniversário neste mês".
create index if not exists clients_aniversario_mes_idx on public.clients (aniversario_mes)
  where aniversario_mes is not null;
create index if not exists clients_aniversario_vithall_idx on public.clients (aniversario_vithall)
  where aniversario_vithall is not null;

select column_name, data_type
  from information_schema.columns
 where table_schema = 'public' and table_name = 'clients'
   and column_name in ('aniversario_dia', 'aniversario_mes', 'nascimento_ano', 'aniversario_vithall', 'turma')
 order by column_name;

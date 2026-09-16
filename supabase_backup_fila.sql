-- ⚠️ O REPOSITÓRIO É PÚBLICO: a URL do Apps Script e o segredo foram trocados
-- por marcadores. Os valores reais estão só no banco (função sheet_backup_processar).

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- BACKUP DA PLANILHA EM FILA â€” um pedaÃ§o por vez, a cada 5 minutos
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- Por que: sheet_backup_partes tinha pg_sleep(4) entre os pedaÃ§os, mas o
-- pg_net sÃ³ libera os pedidos quando a TRANSAÃ‡ÃƒO termina â€” entÃ£o todos
-- saÃ­am no mesmo segundo e o Google recusava parte deles (16/09: 16
-- pedaÃ§os Ã s 07:09:29, 4 com 404 e 5 com pÃ¡gina de erro "200").
--
-- Como funciona agora:
--   bk-fila-montar  (00:00 BRT) â†’ sheet_backup_enfileirar() lista os pedaÃ§os
--   bk-fila-enviar  (a cada 5 min) â†’ sheet_backup_processar():
--       1. confere a resposta do pedaÃ§o anterior (sÃ³ vale 200 + "ok")
--       2. falhou â†’ volta para a fila (atÃ© 4 tentativas)
--       3. manda o prÃ³ximo â€” sempre UM no ar por vez
--
-- Desfazer: reativar os jobs antigos (6,10-17,20,21) e desagendar os dois
-- novos. As funÃ§Ãµes antigas continuam no banco, intactas.

create table if not exists public.sheet_backup_fila (
  id          bigserial primary key,
  lote        timestamptz not null,
  tipo        text        not null,             -- 'full' (aba Clientes) | 'tabela'
  tabela      text,
  aba         text        not null,
  ordem       text,
  desloc      int         not null default 0,
  qtd         int         not null default 0,
  status      text        not null default 'pendente', -- pendente|enviado|ok|falhou
  tentativas  int         not null default 0,
  request_id  bigint,
  enviado_em  timestamptz,
  resposta    text
);
alter table public.sheet_backup_fila enable row level security;  -- sem policy: sÃ³ o banco
revoke all on public.sheet_backup_fila from anon, authenticated;


create or replace function public.sheet_backup_enfileirar(p_bytes int default 40000)
returns text
language plpgsql
set search_path = public, pg_temp
as $$
declare
  -- tabela, aba, coluna de ordem â€” as mesmas do backup antigo
  alvos constant text[][] := array[
    ['visits',            'Visitas',     'created_at'],
    ['client_history',    'Historico',   'created_at'],
    ['callbacks',         'LigarDepois', 'created_at'],
    ['tasks',             'Tarefas',     'created_at'],
    ['matricula_credits', 'Comissoes',   'credit_date'],
    ['daily_logs',        'Ligacoes',    'log_date'],
    ['agenda_slots',      'Agenda',      'created_at'],
    ['profiles',          'Equipe',      'name'],
    ['clients',           'ClientesCru', 'created_at'],
    ['notifications',     'Avisos',      'created_at']
  ];
  agora     timestamptz := now();
  k         int;
  i         int;
  total     bigint;
  tamanho   bigint;
  por_parte int;
  n_partes  int;
  n         int := 0;
begin
  -- Cada rodada recomeÃ§a do zero (o que sobrou da anterior Ã© descartado)
  delete from public.sheet_backup_fila;

  -- âš ï¸ A aba "Clientes" (formatada) NÃƒO entra aqui. A regravaÃ§Ã£o inteira
  -- (modo 'full', ~140 KB) nunca chega a executar no Apps Script â€” nem o cron
  -- antigo das 03:00 aparecia no registro de execuÃ§Ãµes (conferido em 16/09).
  -- Essa aba Ã© mantida pelo espelho em tempo real (gatilho clients_sheet_mirror)
  -- e o backup completo dos clientes Ã© a ClientesCru, que vai em pedaÃ§os.

  for k in 1 .. array_length(alvos, 1) loop
    execute format(
      'select count(*), coalesce(length(jsonb_agg(to_jsonb(t))::text), 2) from public.%I t',
      alvos[k][1]
    ) into total, tamanho;

    -- Tabela vazia: um pedaÃ§o vazio, sÃ³ para a aba existir e ficar limpa
    if total = 0 then
      insert into public.sheet_backup_fila (lote, tipo, tabela, aba, ordem, desloc, qtd)
      values (agora, 'tabela', alvos[k][1], alvos[k][2], alvos[k][3], 0, 0);
      n := n + 1;
      continue;
    end if;

    -- Mesma conta do backup antigo: quantas linhas cabem em p_bytes
    por_parte := greatest(1, floor(total::numeric * p_bytes / greatest(tamanho, 1))::int);
    n_partes  := ceil(total::numeric / por_parte)::int;

    for i in 0 .. n_partes - 1 loop
      insert into public.sheet_backup_fila (lote, tipo, tabela, aba, ordem, desloc, qtd)
      values (agora, 'tabela', alvos[k][1],
              -- um pedaÃ§o sÃ³ = nome de sempre; vÃ¡rios = "Aba 1", "Aba 2"â€¦
              case when n_partes = 1 then alvos[k][2] else alvos[k][2] || ' ' || (i + 1) end,
              alvos[k][3], i * por_parte, por_parte);
      n := n + 1;
    end loop;
  end loop;

  return format('%s pedaÃ§os na fila', n);
end;
$$;


create or replace function public.sheet_backup_processar()
returns text
language plpgsql
set search_path = public, pg_temp
as $$
declare
  alvo    constant text := '<URL_DO_APPS_SCRIPT>';
  segredo constant text := '<SEGREDO_DA_PLANILHA>';
  f       public.sheet_backup_fila;
  r       record;
  dados   jsonb;
  corpo   jsonb;
  rid     bigint;
begin
  -- â”€â”€ 1. O pedaÃ§o que estÃ¡ no ar: chegou? â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  select * into f from public.sheet_backup_fila
   where status = 'enviado' order by enviado_em limit 1;

  if found then
    select status_code, content, error_msg into r
      from net._http_response where id = f.request_id;

    if not found then
      -- Ainda sem resposta: espera, para nunca ter dois no ar
      if f.enviado_em > now() - interval '10 minutes' then
        return format('aguardando o pedaÃ§o %s (%s)', f.id, f.aba);
      end if;
      update public.sheet_backup_fila
         set status = case when tentativas >= 4 then 'falhou' else 'pendente' end,
             resposta = 'sem resposta em 10 min'
       where id = f.id;

    -- SÃ³ vale como entregue: 200 E o script respondeu "ok". O Google Ã s vezes
    -- devolve 200 com uma pÃ¡gina de erro em HTML â€” isso NÃƒO Ã© sucesso.
    elsif r.status_code = 200 and ltrim(coalesce(r.content, '')) like 'ok%' then
      update public.sheet_backup_fila
         set status = 'ok', resposta = left(r.content, 40)
       where id = f.id;

    else
      update public.sheet_backup_fila
         set status = case when tentativas >= 4 then 'falhou' else 'pendente' end,
             resposta = left(coalesce(r.status_code::text, 'sem status') || ' '
                             || coalesce(r.error_msg, r.content, ''), 120)
       where id = f.id;
    end if;
  end if;

  -- â”€â”€ 2. O prÃ³ximo (novos antes das novas tentativas) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  select * into f from public.sheet_backup_fila
   where status = 'pendente' order by tentativas, id limit 1;
  if not found then
    return 'fila vazia';
  end if;

  if f.tipo = 'full' then
    corpo := jsonb_build_object('secret', segredo, 'mode', 'full',
      'rows', coalesce((select jsonb_agg(public.sheet_client_row(c) order by c.created_at)
                          from public.clients c), '[]'::jsonb));
  else
    if f.qtd = 0 then
      dados := '[]'::jsonb;
    else
      execute format(
        'select coalesce(jsonb_agg(to_jsonb(t)), ''[]''::jsonb) from (select * from public.%I order by %I offset %s limit %s) t',
        f.tabela, f.ordem, f.desloc, f.qtd
      ) into dados;
    end if;
    corpo := jsonb_build_object('secret', segredo, 'mode', 'tabela', 'aba', f.aba, 'rows', dados);
  end if;

  -- 5 min de espera: a aba Clientes (formatada, tudo de uma vez) passa de 60s
  -- no Apps Script; o Google corta a execuÃ§Ã£o em 6 min.
  rid := net.http_post(url := alvo, body := corpo, timeout_milliseconds := 300000);

  update public.sheet_backup_fila
     set status = 'enviado', tentativas = tentativas + 1,
         request_id = rid, enviado_em = now()
   where id = f.id;

  return format('enviado o pedaÃ§o %s (%s), tentativa %s', f.id, f.aba, f.tentativas + 1);
end;
$$;

-- NinguÃ©m de fora chama (funÃ§Ãµes nascem executÃ¡veis por PUBLIC)
revoke execute on function public.sheet_backup_enfileirar(int) from public, anon, authenticated;
revoke execute on function public.sheet_backup_processar()     from public, anon, authenticated;

-- â”€â”€ Troca dos robÃ´s: desliga os antigos (sem apagar), liga os novos â”€â”€
select cron.alter_job(job_id := j, active := false)
  from unnest(array[6,10,11,12,13,14,15,16,17,20,21]) as j;

select cron.schedule('bk-fila-montar', '0 3 * * *',   'select public.sheet_backup_enfileirar()');
select cron.schedule('bk-fila-enviar', '*/5 * * * *', 'select public.sheet_backup_processar()');

-- â”€â”€ JÃ¡ roda uma vez agora (a planilha fica em dia hoje mesmo) â”€â”€â”€â”€â”€â”€â”€â”€
select public.sheet_backup_enfileirar();
select jsonb_build_object(
  'primeiro_envio', public.sheet_backup_processar(),
  'pedacos_na_fila', (select count(*) from public.sheet_backup_fila),
  'robos', (select jsonb_agg(jsonb_build_object('job', jobname, 'agenda', schedule, 'ativo', active) order by jobid)
              from cron.job)
) as resultado;


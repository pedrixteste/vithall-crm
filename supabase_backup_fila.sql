-- ⚠️ O REPOSITÓRIO É PÚBLICO: a URL do Apps Script e o segredo foram trocados
-- por marcadores. Os valores reais estão só no banco (função sheet_backup_processar).

-- ════════════════════════════════════════════════════════════════════
-- BACKUP DA PLANILHA EM FILA — um pedaço por vez, a cada 5 minutos
-- ════════════════════════════════════════════════════════════════════
-- Por que: sheet_backup_partes tinha pg_sleep(4) entre os pedaços, mas o
-- pg_net só libera os pedidos quando a TRANSAÇÃO termina — então todos
-- saíam no mesmo segundo. O Apps Script atende um por vez (LockService,
-- espera 30 s) e os que passavam disso voltavam como página de erro.
--
-- Como funciona:
--   bk-fila-montar  (00:00 BRT) → sheet_backup_enfileirar() lista os pedaços
--   bk-fila-enviar  (a cada 5 min) → sheet_backup_processar():
--       1. confere a resposta do pedaço anterior (só vale 200 + "ok")
--       2. falhou → volta para a fila (até 4 tentativas)
--       3. manda o próximo — sempre UM no ar por vez
--
-- Aba "Clientes" (formatada): a regravação inteira (modo 'full', ~140 KB)
-- NUNCA chegava a executar no Apps Script. Agora vai em lotes (modo 'lote',
-- grava/atualiza sem apagar) e termina com a lista dos ids vivos (modo
-- 'conferir', marca "Apagado em" em quem sumiu). Nenhuma linha sai da planilha.
--
-- Desfazer: reativar os jobs antigos (6,10-17,20,21) e desagendar os dois
-- novos. As funções antigas continuam no banco, intactas.

create table if not exists public.sheet_backup_fila (
  id          bigserial primary key,
  lote        timestamptz not null,
  tipo        text        not null,  -- 'tabela' | 'clientes_lote' | 'clientes_ids' | 'full' (legado)
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
alter table public.sheet_backup_fila enable row level security;  -- sem policy: só o banco
revoke all on public.sheet_backup_fila from anon, authenticated;


create or replace function public.sheet_backup_enfileirar(p_bytes int default 40000)
returns text
language plpgsql
set search_path = public, pg_temp
as $$
declare
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
  -- Cada rodada recomeça do zero (o que sobrou da anterior é descartado)
  delete from public.sheet_backup_fila;

  for k in 1 .. array_length(alvos, 1) loop
    execute format(
      'select count(*), coalesce(length(jsonb_agg(to_jsonb(t))::text), 2) from public.%I t',
      alvos[k][1]
    ) into total, tamanho;

    -- Tabela vazia: um pedaço vazio, só para a aba existir e ficar limpa
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
              -- um pedaço só = nome de sempre; vários = "Aba 1", "Aba 2"…
              case when n_partes = 1 then alvos[k][2] else alvos[k][2] || ' ' || (i + 1) end,
              alvos[k][3], i * por_parte, por_parte);
      n := n + 1;
    end loop;
  end loop;

  -- Aba "Clientes" (formatada): em lotes + a conferência dos apagados no fim
  select count(*), coalesce(length(jsonb_agg(public.sheet_client_row(c))::text), 2)
    into total, tamanho from public.clients c;
  if total > 0 then
    por_parte := greatest(1, floor(total::numeric * p_bytes / greatest(tamanho, 1))::int);
    n_partes  := ceil(total::numeric / por_parte)::int;
    for i in 0 .. n_partes - 1 loop
      insert into public.sheet_backup_fila (lote, tipo, tabela, aba, ordem, desloc, qtd)
      values (agora, 'clientes_lote', 'clients', 'Clientes (lote ' || (i + 1) || ')',
              'created_at', i * por_parte, por_parte);
      n := n + 1;
    end loop;
    insert into public.sheet_backup_fila (lote, tipo, aba)
    values (agora, 'clientes_ids', 'Clientes (conferir apagados)');
    n := n + 1;
  end if;

  return format('%s pedaços na fila', n);
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
  -- ── 1. O pedaço que está no ar: chegou? ───────────────────────────
  select * into f from public.sheet_backup_fila
   where status = 'enviado' order by enviado_em limit 1;

  if found then
    select status_code, content, error_msg into r
      from net._http_response where id = f.request_id;

    if not found then
      -- Ainda sem resposta: espera, para nunca ter dois no ar
      if f.enviado_em > now() - interval '10 minutes' then
        return format('aguardando o pedaço %s (%s)', f.id, f.aba);
      end if;
      update public.sheet_backup_fila
         set status = case when tentativas >= 4 then 'falhou' else 'pendente' end,
             resposta = 'sem resposta em 10 min'
       where id = f.id;

    -- Só vale como entregue: 200 E o script respondeu "ok". O Google às vezes
    -- devolve 200 com uma página de erro em HTML — isso NÃO é sucesso.
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

  -- ── 2. O próximo (novos antes das novas tentativas) ───────────────
  select * into f from public.sheet_backup_fila
   where status = 'pendente' order by tentativas, id limit 1;
  if not found then
    return 'fila vazia';
  end if;

  if f.tipo = 'clientes_lote' then
    select coalesce(jsonb_agg(public.sheet_client_row(c) order by c.created_at), '[]'::jsonb)
      into dados
      from public.clients c
     where c.id in (select id from public.clients order by created_at, id offset f.desloc limit f.qtd);
    corpo := jsonb_build_object('secret', segredo, 'mode', 'lote', 'rows', dados);

  elsif f.tipo = 'clientes_ids' then
    corpo := jsonb_build_object('secret', segredo, 'mode', 'conferir',
      'ids', coalesce((select jsonb_agg(id) from public.clients), '[]'::jsonb));

  elsif f.tipo = 'full' then   -- legado: não é mais enfileirado
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

  -- 5 min de espera: o Google corta a execução do script em 6 min
  rid := net.http_post(url := alvo, body := corpo, timeout_milliseconds := 300000);

  update public.sheet_backup_fila
     set status = 'enviado', tentativas = tentativas + 1,
         request_id = rid, enviado_em = now()
   where id = f.id;

  return format('enviado o pedaço %s (%s), tentativa %s', f.id, f.aba, f.tentativas + 1);
end;
$$;

-- Ninguém de fora chama (funções nascem executáveis por PUBLIC)
revoke execute on function public.sheet_backup_enfileirar(int) from public, anon, authenticated;
revoke execute on function public.sheet_backup_processar()     from public, anon, authenticated;

-- ── Troca dos robôs: desliga os antigos (sem apagar), liga os novos ──
select cron.alter_job(job_id := j, active := false)
  from unnest(array[6,10,11,12,13,14,15,16,17,20,21]) as j;

select cron.schedule('bk-fila-montar', '0 3 * * *',   'select public.sheet_backup_enfileirar()');
select cron.schedule('bk-fila-enviar', '*/5 * * * *', 'select public.sheet_backup_processar()');

-- ── Já roda uma vez agora (a planilha fica em dia no mesmo dia) ──────
select public.sheet_backup_enfileirar();
select jsonb_build_object(
  'primeiro_envio', public.sheet_backup_processar(),
  'pedacos_na_fila', (select count(*) from public.sheet_backup_fila),
  'robos', (select jsonb_agg(jsonb_build_object('job', jobname, 'agenda', schedule, 'ativo', active) order by jobid)
              from cron.job)
) as resultado;

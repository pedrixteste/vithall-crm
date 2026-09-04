-- ─────────────────────────────────────────────────────────────────────────
-- BACKUP DA PLANILHA EM PEDAÇOS — 04/09/2026
--
-- O QUE ESTAVA ERRADO
-- Pedido com corpo acima de ~64 kB NÃO CHEGA no Google. Medido na bancada:
--   63.672 bytes → "ok" 200        67.349 bytes → Timeout de 60s
-- E no log de execuções do Apps Script **não aparece execução nenhuma** nos
-- horários que falharam: o pedido morre no caminho, não é o script que quebra.
-- Por isso faltavam as abas Historico (166 kB) e Agenda (70 kB), e as abas
-- Visitas (100 kB) e LigarDepois (92 kB) tinham parado de atualizar. O backup
-- dos clientes (121 kB) passou às 03:00 de 04/set e falhou às 09:00 — ou seja,
-- estava na sorte.
--
-- A CORREÇÃO
-- Mandar cada tabela em PEDAÇOS abaixo do limite. Cada pedaço vai para uma aba
-- própria ("Historico 1", "Historico 2", ...) usando o modo 'tabela' que o
-- Apps Script JÁ conhece — **não precisa publicar versão nova do script**.
-- Tabela que couber num pedaço só continua indo para a aba de sempre, com o
-- nome de sempre.
--
-- O tamanho por pedaço é calculado na hora (bytes reais ÷ linhas), então a
-- conta continua certa conforme a tabela cresce.
-- ─────────────────────────────────────────────────────────────────────────

create or replace function public.sheet_backup_partes(
  p_tabela text,
  p_aba    text,
  p_ordem  text default 'created_at',
  p_bytes  int  default 40000   -- teto por pedaço, com folga sobre os 64 kB
)
returns text
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  alvo    constant text := 'https://script.google.com/macros/s/AKfycbzrKwNgP3f5rOqvw-x20W8cnCWRryRqHqe3lcLC_r3dkkbvScKRMiyh-LcQqUL1Wyu-zg/exec';
  segredo constant text := 'vithall-espelho-x9K42mQ7';
  total     bigint;
  tamanho   bigint;
  por_parte int;
  n_partes  int;
  i         int;
  dados     jsonb;
  aba_atual text;
begin
  -- Quantas linhas e quantos bytes a tabela inteira ocuparia
  execute format(
    'select count(*), coalesce(length(jsonb_agg(to_jsonb(t))::text), 2) from public.%I t',
    p_tabela
  ) into total, tamanho;

  -- Tabela vazia: manda uma vez, só para a aba existir e ficar limpa
  if total = 0 then
    perform net.http_post(
      url  := alvo,
      body := jsonb_build_object('secret', segredo, 'mode', 'tabela', 'aba', p_aba, 'rows', '[]'::jsonb),
      timeout_milliseconds := 60000);
    return p_aba || ': vazia';
  end if;

  -- Quantas linhas cabem em p_bytes, pela média real de bytes por linha
  por_parte := greatest(1, floor(total::numeric * p_bytes / greatest(tamanho, 1))::int);
  n_partes  := ceil(total::numeric / por_parte)::int;

  for i in 0 .. n_partes - 1 loop
    execute format(
      'select coalesce(jsonb_agg(to_jsonb(t)), ''[]''::jsonb) from (select * from public.%I order by %I offset %s limit %s) t',
      p_tabela, p_ordem, i * por_parte, por_parte
    ) into dados;

    -- Um pedaço só = aba com o nome de sempre (nada muda para quem já usa)
    aba_atual := case when n_partes = 1 then p_aba else p_aba || ' ' || (i + 1) end;

    perform net.http_post(
      url  := alvo,
      body := jsonb_build_object('secret', segredo, 'mode', 'tabela', 'aba', aba_atual, 'rows', dados),
      timeout_milliseconds := 60000);

    -- Respira entre os pedaços: o Google atende um de cada vez e disparar
    -- tudo junto é o caminho mais curto para tomar bloqueio de novo
    if i < n_partes - 1 then perform pg_sleep(4); end if;
  end loop;

  return format('%s: %s linhas em %s parte(s) de ~%s linhas', p_aba, total, n_partes, por_parte);
end;
$function$;

-- Todas as tabelas de uma vez (usada pelos crons novos abaixo).
-- `clients` entra CRU também: a aba "Clientes" bonita (sheet_full_sync, com a
-- coluna "Apagado em") continua existindo, mas ela é a que mais cresce e já
-- está na beira do limite — este dump é a rede embaixo dela.
create or replace function public.sheet_backup_tudo_partes()
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  perform public.sheet_backup_partes('client_history',    'Historico',   'created_at');
  perform pg_sleep(6);
  perform public.sheet_backup_partes('visits',            'Visitas',     'created_at');
  perform pg_sleep(6);
  perform public.sheet_backup_partes('callbacks',         'LigarDepois', 'created_at');
  perform pg_sleep(6);
  perform public.sheet_backup_partes('agenda_slots',      'Agenda',      'created_at');
  perform pg_sleep(6);
  perform public.sheet_backup_partes('clients',           'ClientesCru', 'created_at');
  perform pg_sleep(6);
  perform public.sheet_backup_partes('tasks',             'Tarefas',     'created_at');
  perform pg_sleep(6);
  perform public.sheet_backup_partes('matricula_credits', 'Comissoes',   'credit_date');
  perform pg_sleep(6);
  perform public.sheet_backup_partes('daily_logs',        'Ligacoes',    'log_date');
  perform pg_sleep(6);
  perform public.sheet_backup_partes('profiles',          'Equipe',      'name');
end;
$function$;

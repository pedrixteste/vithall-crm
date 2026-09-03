-- ─────────────────────────────────────────────────────────────────────────
-- BACKUP DAS OUTRAS TABELAS na planilha-espelho — 03/09/2026
--
-- Até aqui a planilha guardava só `clients` (124 linhas). Visitas/estrelas,
-- histórico, "ligar depois", tarefas, comissões, ligações do dia e a agenda
-- ficavam sem rede nenhuma — e o plano free do Supabase não tem backup
-- próprio. Cada tabela agora vira uma ABA da mesma planilha.
--
-- ⚠️ Depende de uma NOVA VERSÃO do Apps Script (modo 'tabela' +
-- função tabelaGenerica). Enquanto a versão nova não for publicada, estas
-- chamadas não fazem nada (o script ignora modo desconhecido).
--
-- Cada sincronização SUBSTITUI a aba inteira: é um espelho do estado atual,
-- não um diário. Linha apagada no banco desaparece da planilha na próxima
-- noite (a aba Clientes é a única que marca os apagados).
-- ─────────────────────────────────────────────────────────────────────────

create or replace function public.sheet_backup_tabela(p_tabela text, p_aba text, p_ordem text default 'created_at')
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  alvo    constant text := 'https://script.google.com/macros/s/AKfycbzrKwNgP3f5rOqvw-x20W8cnCWRryRqHqe3lcLC_r3dkkbvScKRMiyh-LcQqUL1Wyu-zg/exec';
  segredo constant text := 'vithall-espelho-x9K42mQ7';
  dados   jsonb;
begin
  -- to_jsonb(t) = a linha inteira, com os nomes de coluna do banco. Backup
  -- prefere fidelidade a nome bonito: nada de mapa de colunas pra manter.
  execute format(
    'select coalesce(jsonb_agg(to_jsonb(t) order by t.%I), ''[]''::jsonb) from public.%I t',
    p_ordem, p_tabela
  ) into dados;

  perform net.http_post(
    url  := alvo,
    body := jsonb_build_object('secret', segredo, 'mode', 'tabela', 'aba', p_aba, 'rows', dados),
    timeout_milliseconds := 60000  -- a resposta pode não voltar; o Google grava de todo jeito
  );
end;
$function$;

-- Uma chamada por tabela (cada uma na sua aba). São disparos assíncronos:
-- a ordem de chegada não importa, cada aba é independente.
create or replace function public.sheet_backup_tudo()
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  perform public.sheet_full_sync();                                    -- aba Clientes (formato antigo, com apagados)
  perform public.sheet_backup_tabela('visits',            'Visitas',    'created_at');
  perform public.sheet_backup_tabela('client_history',    'Historico',  'created_at');
  perform public.sheet_backup_tabela('callbacks',         'LigarDepois','created_at');
  perform public.sheet_backup_tabela('tasks',             'Tarefas',    'created_at');
  perform public.sheet_backup_tabela('matricula_credits', 'Comissoes',  'credit_date');
  perform public.sheet_backup_tabela('daily_logs',        'Ligacoes',   'log_date');
  perform public.sheet_backup_tabela('agenda_slots',      'Agenda',     'created_at');
  perform public.sheet_backup_tabela('profiles',          'Equipe',     'name');
end;
$function$;

-- O cron noturno passa a chamar o backup completo (era só sheet_full_sync).
-- 06:00 UTC = 03:00 no horário de Brasília.
select cron.unschedule('sheet-backup-noturno')
 where exists (select 1 from cron.job where jobname = 'sheet-backup-noturno');

select cron.schedule('sheet-backup-noturno', '0 6 * * *', $$select public.sheet_backup_tudo()$$);

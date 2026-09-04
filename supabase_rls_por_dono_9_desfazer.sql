-- RLS por dono — DESFAZER: recria as políticas EXATAMENTE como estavam antes da trava
-- (cópia de vithall-crm-backups/2026-09-04_antes-rls/esquema/policies_restaurar.sql).
-- Só políticas: a coluna encaminhado_para, os índices e as funções da etapa 1 ficam
-- (são inertes sem as políticas). Rodar: npx supabase db query --linked -f supabase_rls_por_dono_9_desfazer.sql
-- Políticas de RLS EXATAMENTE como estavam em 2026-09-04T21:03:20.105Z
-- Rodar inteiro: derruba o que houver e recria o estado deste backup.
do $$ declare p record; begin for p in select policyname from pg_policies where schemaname='public' and tablename='agenda_slots' loop execute format('drop policy if exists %I on public.%I', p.policyname, 'agenda_slots'); end loop; end $$;
do $$ declare p record; begin for p in select policyname from pg_policies where schemaname='public' and tablename='briefing_log' loop execute format('drop policy if exists %I on public.%I', p.policyname, 'briefing_log'); end loop; end $$;
do $$ declare p record; begin for p in select policyname from pg_policies where schemaname='public' and tablename='callbacks' loop execute format('drop policy if exists %I on public.%I', p.policyname, 'callbacks'); end loop; end $$;
do $$ declare p record; begin for p in select policyname from pg_policies where schemaname='public' and tablename='client_history' loop execute format('drop policy if exists %I on public.%I', p.policyname, 'client_history'); end loop; end $$;
do $$ declare p record; begin for p in select policyname from pg_policies where schemaname='public' and tablename='clients' loop execute format('drop policy if exists %I on public.%I', p.policyname, 'clients'); end loop; end $$;
do $$ declare p record; begin for p in select policyname from pg_policies where schemaname='public' and tablename='daily_logs' loop execute format('drop policy if exists %I on public.%I', p.policyname, 'daily_logs'); end loop; end $$;
do $$ declare p record; begin for p in select policyname from pg_policies where schemaname='public' and tablename='google_tokens' loop execute format('drop policy if exists %I on public.%I', p.policyname, 'google_tokens'); end loop; end $$;
do $$ declare p record; begin for p in select policyname from pg_policies where schemaname='public' and tablename='matricula_credits' loop execute format('drop policy if exists %I on public.%I', p.policyname, 'matricula_credits'); end loop; end $$;
do $$ declare p record; begin for p in select policyname from pg_policies where schemaname='public' and tablename='notifications' loop execute format('drop policy if exists %I on public.%I', p.policyname, 'notifications'); end loop; end $$;
do $$ declare p record; begin for p in select policyname from pg_policies where schemaname='public' and tablename='profiles' loop execute format('drop policy if exists %I on public.%I', p.policyname, 'profiles'); end loop; end $$;
do $$ declare p record; begin for p in select policyname from pg_policies where schemaname='public' and tablename='push_log' loop execute format('drop policy if exists %I on public.%I', p.policyname, 'push_log'); end loop; end $$;
do $$ declare p record; begin for p in select policyname from pg_policies where schemaname='public' and tablename='tasks' loop execute format('drop policy if exists %I on public.%I', p.policyname, 'tasks'); end loop; end $$;
do $$ declare p record; begin for p in select policyname from pg_policies where schemaname='public' and tablename='visit_rating_notif_ids' loop execute format('drop policy if exists %I on public.%I', p.policyname, 'visit_rating_notif_ids'); end loop; end $$;
do $$ declare p record; begin for p in select policyname from pg_policies where schemaname='public' and tablename='visits' loop execute format('drop policy if exists %I on public.%I', p.policyname, 'visits'); end loop; end $$;
alter table public.agenda_slots enable row level security;
alter table public.briefing_log enable row level security;
alter table public.callbacks enable row level security;
alter table public.client_history enable row level security;
alter table public.clients enable row level security;
alter table public.daily_logs enable row level security;
alter table public.google_tokens enable row level security;
alter table public.matricula_credits enable row level security;
alter table public.notifications enable row level security;
alter table public.profiles enable row level security;
alter table public.push_log enable row level security;
alter table public.tasks enable row level security;
alter table public.visit_rating_notif_ids enable row level security;
alter table public.visits enable row level security;
create policy "Authenticated users can manage agenda slots" on public.agenda_slots as permissive for all to public using ((auth.role() = 'authenticated'::text));
create policy "callbacks_auth" on public.callbacks as permissive for all to public using ((auth.role() = 'authenticated'::text));
create policy "Autenticados podem atualizar historico" on public.client_history as permissive for update to authenticated using (true) with check (true);
create policy "Autenticados podem deletar historico" on public.client_history as permissive for delete to authenticated using (true);
create policy "Autenticados podem inserir historico" on public.client_history as permissive for insert to authenticated with check (true);
create policy "Autenticados podem ler historico" on public.client_history as permissive for select to authenticated using (true);
create policy "clients_authenticated" on public.clients as permissive for all to public using ((auth.role() = 'authenticated'::text));
create policy "gerentes veem todos os logs" on public.daily_logs as permissive for select to public using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'gerente'::text)))));
create policy "usuarios atualizam seus proprios logs" on public.daily_logs as permissive for update to public using ((auth.uid() = user_id));
create policy "usuarios salvam seus proprios logs" on public.daily_logs as permissive for insert to public with check ((auth.uid() = user_id));
create policy "usuarios veem seus proprios logs" on public.daily_logs as permissive for select to public using ((auth.uid() = user_id));
create policy "google_tokens_own" on public.google_tokens as permissive for all to public using ((auth.uid() = id)) with check ((auth.uid() = id));
create policy "Authenticated users can manage matricula credits" on public.matricula_credits as permissive for all to public using ((auth.role() = 'authenticated'::text));
create policy "marca as proprias como lidas" on public.notifications as permissive for update to public using ((auth.uid() = user_id)) with check ((auth.uid() = user_id));
create policy "ve as proprias notificacoes" on public.notifications as permissive for select to public using ((auth.uid() = user_id));
create policy "Usuarios autenticados podem ver perfis" on public.profiles as permissive for select to authenticated using (true);
create policy "profiles_own" on public.profiles as permissive for all to public using ((auth.uid() = id));
create policy "tasks_authenticated" on public.tasks as permissive for all to public using ((auth.role() = 'authenticated'::text));
create policy "visits_authenticated" on public.visits as permissive for all to public using ((auth.role() = 'authenticated'::text));
-- ═══════════════════════════════════════════════════════════════════
-- 1) Fecha a tabela visit_rating_notif_ids (alerta CRITICAL do Supabase)
-- ═══════════════════════════════════════════════════════════════════
-- Ela guarda os ids das notificações agendadas de avaliação de visita.
-- Estava exposta pelo PostgREST sem RLS: qualquer um com a chave pública
-- do app conseguia ler e APAGAR — e sem essas linhas o lembrete de
-- avaliação deixa de ser cancelável quando a visita é avaliada.
--
-- Quem escreve nela são as edge functions schedule-rating-reminder e
-- cancel-rating-reminders, e as duas usam SERVICE_ROLE, que ignora RLS.
-- Por isso: liga o RLS e NÃO cria política nenhuma. O app perde um acesso
-- que nunca usou; as funções continuam iguais.
alter table public.visit_rating_notif_ids enable row level security;


-- ═══════════════════════════════════════════════════════════════════
-- 2) Caixa de notificações do app (o sininho)
-- ═══════════════════════════════════════════════════════════════════
-- Hoje a notificação é efêmera: se o Android engolir o push, a informação
-- não existe em lugar nenhum — foi o que aconteceu com a Amanda em 27/jul
-- (o OneSignal despachou, o aparelho não exibiu). Com esta tabela, o push
-- vira o "tapinha no ombro" e o app vira a fonte da verdade.
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  title      text not null,
  body       text not null,
  -- Para onde levar ao tocar na notificação (rota do app, ex: /agenda).
  url        text,
  -- 'briefing' | 'recorde' | 'visita' | 'estrela' | 'lembrete' | 'tarefa'
  kind       text,
  created_at timestamptz not null default now(),
  read_at    timestamptz
);

-- O sino sempre lê "as minhas, mais recentes primeiro".
create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

-- Cada pessoa vê e marca como lida APENAS as suas. Quem escreve é sempre
-- uma edge function (service role, ignora RLS) — por isso não existe
-- política de insert: ninguém cria notificação pelo app.
drop policy if exists "ve as proprias notificacoes"    on public.notifications;
drop policy if exists "marca as proprias como lidas"   on public.notifications;

create policy "ve as proprias notificacoes"
  on public.notifications for select
  using (auth.uid() = user_id);

create policy "marca as proprias como lidas"
  on public.notifications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- ═══════════════════════════════════════════════════════════════════
-- 3) Faxina automática
-- ═══════════════════════════════════════════════════════════════════
-- Sem isso a tabela cresce para sempre (são ~10 notificações por dia por
-- pessoa). 60 dias é bem mais do que alguém rola no sino.
create or replace function public.limpa_notificacoes_antigas()
returns void language sql security definer set search_path = public as $$
  delete from public.notifications where created_at < now() - interval '60 days';
$$;

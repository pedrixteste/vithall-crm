-- RLS por dono — ETAPA 1: coluna, índices e funções (ADITIVA: rodar com a
-- equipe usando não muda nada — nenhuma política é tocada aqui).
--
-- Duas famílias de função:
--   a) eh_gerente() / tem_credito() / cliente_visivel() — o predicado de dono,
--      usado pelas políticas da etapa 2. Ficam aqui para poderem ser testadas
--      antes (scripts/teste-rls.mjs).
--   b) contato_* — preservam o 📞ˣ (badge de repetição, aviso de número já
--      registrado, histórico do contato e sugestão no cadastro). Essas telas
--      varrem a base INTEIRA de propósito; com RLS por dono cada pessoa
--      passaria a enxergar só o próprio quintal e o aviso morreria. Como são
--      SECURITY DEFINER, elas atravessam a RLS de propósito — por isso
--      devolvem o MÍNIMO: contagem, data e quem registrou. A ficha completa
--      de registro alheio não sai daqui (exceção: contato_sugestoes, ver lá).
--
-- ⚠️ ORDEM: este arquivo → deploy do app → etapa 2 (políticas). O app novo
-- filtra por `encaminhado_para`; sem a coluna, a aba Clientes quebra para
-- pré-vendas e vendedor.

-- ── Coluna nova: quem foi chamado para cuidar do cliente ─────────────
-- A estrela ("quem vai remarcar?") e a marcação futura ("quem lembrar?")
-- mandam uma TAREFA para outra pessoa. Sem isto, a pessoa recebia a tarefa e
-- a ficha não abria. Lista, não coluna única: fica PARA SEMPRE, e todo mundo
-- que já foi chamado continua vendo (decisão do usuário, 04/09/26).
alter table public.clients
  add column if not exists encaminhado_para uuid[] not null default '{}';

comment on column public.clients.encaminhado_para is
  'Pessoas para quem o cliente foi encaminhado (remarcar / tentar marcar de novo). Nunca esvazia: cada uma passa a enxergar o cliente para sempre.';

-- ── Índices que faltavam (as políticas consultam por essas colunas) ─────
create index if not exists clients_created_by_idx           on public.clients (created_by);
create index if not exists clients_assigned_to_idx          on public.clients (assigned_to);
create index if not exists clients_visit_scheduled_by_idx   on public.clients (visit_scheduled_by);
create index if not exists clients_visit_first_booked_by_idx on public.clients (visit_first_booked_by);
create index if not exists clients_encaminhado_para_idx     on public.clients using gin (encaminhado_para);
create index if not exists tasks_client_id_idx              on public.tasks (client_id);
create index if not exists tasks_seller_id_idx              on public.tasks (seller_id);
create index if not exists visits_client_id_idx             on public.visits (client_id);
create index if not exists client_history_client_id_idx     on public.client_history (client_id);
create index if not exists client_history_user_id_idx       on public.client_history (user_id);
create index if not exists matricula_credits_credited_to_idx on public.matricula_credits (credited_to);
create index if not exists callbacks_created_by_idx         on public.callbacks (created_by);

-- ── Predicado de dono ────────────────────────────────────────────────

create or replace function public.eh_gerente()
returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'gerente')
$$;

-- Participante/creditado de uma matrícula continua vendo o cliente: o
-- relatório e o modal de matrículas mostram esse crédito, e o cliente pode
-- ser de outra carteira (caso real: Amanda e Mafê, 1 cada).
create or replace function public.tem_credito(cid uuid)
returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from matricula_credits m
     where m.client_id = cid
       and (m.credited_to = auth.uid() or m.enrolled_by = auth.uid())
  )
$$;

-- A REGRA, num lugar só. A política de `clients` (etapa 2) repete a mesma
-- lista inline (para usar índice); o teste confere que as duas batem.
--   created_by             quem cadastrou — para sempre, mesmo passando a carteira
--   dono_id                carteira de hoje (carteira_de → created_by)
--   assigned_to            vendedor responsável
--   visit_scheduled_by     quem marcou/remarcou a visita atual (aba Hoje: scheduledByMe)
--   visit_first_booked_by  quem marcou na origem (comissão dividida)
--   repescagem_by          quem está repescando
--   encaminhado_para       quem foi chamado para remarcar / tentar de novo
--   tem_credito            participação em matrícula
create or replace function public.cliente_visivel(cid uuid)
returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select public.eh_gerente() or exists (
    select 1 from clients c
     where c.id = cid
       and (c.created_by            = auth.uid()
         or c.dono_id               = auth.uid()
         or c.assigned_to           = auth.uid()
         or c.visit_scheduled_by    = auth.uid()
         or c.visit_first_booked_by = auth.uid()
         or c.repescagem_by         = auth.uid()
         or auth.uid() = any (c.encaminhado_para)
         or public.tem_credito(c.id))
  )
$$;

-- ── 📞ˣ — repetição de contato ───────────────────────────────────────

-- Dígitos de todos os telefones de um registro (principal, os de `phones` e o
-- `phone2` legado). Espelha allPhoneDigits de src/lib/utils.js, inclusive o
-- corte de 8 dígitos.
create or replace function public.telefones_digitos(p_phone text, p_phone2 text, p_phones jsonb)
returns text[]
language sql immutable set search_path = public, pg_temp as $$
  select coalesce(array_agg(distinct d) filter (where length(d) >= 8), '{}')
  from (
    select regexp_replace(coalesce(p_phone, ''), '\D', '', 'g') as d
    union all
    select regexp_replace(coalesce(p_phone2, ''), '\D', '', 'g')
    union all
    select regexp_replace(coalesce(x->>'n', ''), '\D', '', 'g')
      from jsonb_array_elements(coalesce(p_phones, '[]'::jsonb)) x
  ) t
$$;

-- Quantos registros existem de cada contato, na BASE INTEIRA, para cada
-- cliente que a pessoa enxerga. É o que alimenta o badge 📞ˣ (count − 1).
-- Devolve só id + número: nenhum dado de registro alheio sai daqui.
create or replace function public.contato_contagens()
returns table (client_id uuid, total integer)
language sql stable security definer set search_path = public, pg_temp as $$
  with todos as (
    select id, public.telefones_digitos(phone, phone2, phones) as ks
      from clients
  ), meus as (
    select * from todos where public.cliente_visivel(id)
  )
  select m.id,
         greatest(1, (select count(*)::int from todos o where o.ks && m.ks))
    from meus m
$$;

-- Quantos registros existem de um contato específico (badge da ficha e o
-- pop-up "número já registrado" ao salvar um cadastro novo).
create or replace function public.contato_contagem(p_keys text[])
returns integer
language sql stable security definer set search_path = public, pg_temp as $$
  select greatest(1, (
    select count(*)::int from clients c
     where public.telefones_digitos(c.phone, c.phone2, c.phones) && p_keys
  ))
$$;

-- Linha do tempo do contato. Só responde a quem JÁ tem um registro daquele
-- telefone (ou ao gerente) — não dá para pescar números aleatórios.
-- Registro de outra pessoa volta SEM ficha: só a data, o resultado das visitas
-- e o nome de quem registrou, que é o que a tela mostra na linha do tempo.
create or replace function public.contato_historico(p_keys text[])
returns table (registro jsonb, visitas jsonb, dono text, visivel boolean)
language sql stable security definer set search_path = public, pg_temp as $$
  with alvo as (
    select c.*, public.cliente_visivel(c.id) as vis
      from clients c
     where public.telefones_digitos(c.phone, c.phone2, c.phones) && p_keys
  )
  select case when a.vis then to_jsonb(a) - 'vis'
              else jsonb_build_object('id', a.id, 'created_at', a.created_at,
                                      'visit_scheduled_at', a.visit_scheduled_at)
         end,
         coalesce((
           select jsonb_agg(case when a.vis then to_jsonb(v)
                                 else jsonb_build_object('id', v.id, 'visit_date', v.visit_date,
                                                         'visit_outcome', v.visit_outcome) end
                            order by v.visit_date)
             from visits v where v.client_id = a.id
         ), '[]'::jsonb),
         (select p.name from profiles p where p.id = a.created_by),
         a.vis
    from alvo a
   where exists (select 1 from alvo x where x.vis)   -- só quem já tem o contato
$$;

-- Sugestão ao digitar o telefone num cadastro NOVO. Exige 8 dígitos — quem
-- digita o número quase inteiro já o tem na mão; com o mínimo antigo de 5
-- daria para varrer a base por prefixo, que é justamente o que a RLS fecha.
-- EXCEÇÃO PROPOSITAL: devolve a ficha inteira mesmo de cliente alheio, porque
-- o cadastro pré-preenche com ela (era assim antes da trava).
create or replace function public.contato_sugestoes(p_prefixo text)
returns setof jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select to_jsonb(c) || jsonb_build_object('matchPhone', (
           select n from (
             select c.phone as n
             union all select c.phone2
             union all select x->>'n' from jsonb_array_elements(coalesce(c.phones, '[]'::jsonb)) x
           ) t where regexp_replace(coalesce(n, ''), '\D', '', 'g') like p_prefixo || '%' limit 1))
    from clients c
   where length(p_prefixo) >= 8
     and exists (select 1 from unnest(public.telefones_digitos(c.phone, c.phone2, c.phones)) d
                  where d like p_prefixo || '%')
   order by c.created_at desc
   limit 5
$$;

-- Toda função nasce com EXECUTE para PUBLIC e anon/authenticated herdam de lá:
-- revogar só dos dois papéis não faz nada. Tem que tirar de public e devolver
-- a quem precisa.
revoke execute on function
  public.eh_gerente(), public.tem_credito(uuid), public.cliente_visivel(uuid),
  public.telefones_digitos(text, text, jsonb),
  public.contato_contagens(), public.contato_contagem(text[]),
  public.contato_historico(text[]), public.contato_sugestoes(text)
  from public, anon, authenticated;

grant execute on function
  public.eh_gerente(), public.tem_credito(uuid), public.cliente_visivel(uuid),
  public.telefones_digitos(text, text, jsonb),
  public.contato_contagens(), public.contato_contagem(text[]),
  public.contato_historico(text[]), public.contato_sugestoes(text)
  to authenticated;

-- ===== Cancelamento de matrícula =====
-- Rodar ANTES do deploy (o app passa a gravar estas colunas ao cancelar).

-- 1) Colunas novas no cliente
alter table public.clients
  add column if not exists matricula_reembolso        text,        -- 'sim' | 'parcial' | 'nao'
  add column if not exists matricula_reembolso_valor  text,        -- só no parcial (texto livre, igual ao valor da venda)
  add column if not exists matricula_cancelada_em     timestamptz,
  add column if not exists matricula_cancelada_por    uuid references public.profiles(id);

-- 2) Aviso no sino dos gerentes (o app não pode inserir em notifications
--    direto — RLS só deixa ler as próprias; esta função faz isso por ele)
create or replace function public.notificar_gerentes(p_title text, p_body text, p_url text default '/clientes', p_kind text default 'matricula_cancelada')
returns void
language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if auth.uid() is null then return; end if;
  insert into public.notifications (user_id, title, body, url, kind)
  select p.id, p_title, p_body, p_url, p_kind
    from public.profiles p
   where p.role = 'gerente' and p.id <> auth.uid();
end;
$$;
grant execute on function public.notificar_gerentes(text, text, text, text) to authenticated;

-- 3) Planilha-espelho: a coluna "situação da matrícula" passa a mostrar o
--    reembolso também ("cancelada — motivo — Reembolso parcial (R$ 500)")
create or replace function public.sheet_client_row(c public.clients)
returns jsonb
language sql stable
set search_path to 'public', 'pg_temp'
as $$
  select jsonb_build_object(
    'id',                 c.id,
    'criado_em',          to_char(c.created_at at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI'),
    'nome',               c.contact_name,
    'empresa',            c.company_name,
    'cargo',              c.contact_role,
    'telefones',          (select string_agg(x, ' · ')
                             from unnest(array[c.phone, c.phone2]
                                  || coalesce((select array_agg(p->>'n')
                                                 from jsonb_array_elements(coalesce(c.phones, '[]'::jsonb)) p), '{}')) x
                            where x is not null and btrim(x) <> ''),
    'email',              c.email,
    'instagram',          c.instagram,
    'cidade',             c.city,
    'endereco',           concat_ws(', ', nullif(c.address_street,''), nullif(c.address_number,''), nullif(c.address_neighborhood,'')),
    'referencia',         c.address_reference,
    'origem',             c.origin,
    'indicado_por',       c.indicado_por,
    'estagio',            c.matricula_stage,
    'situacao_matricula', concat_ws(' — ',
                            nullif(c.matricula_status,''),
                            nullif(c.matricula_status_note,''),
                            case c.matricula_reembolso
                              when 'sim'     then 'Reembolso integral'
                              when 'parcial' then 'Reembolso parcial' || coalesce(' (R$ ' || nullif(c.matricula_reembolso_valor,'') || ')', '')
                              when 'nao'     then 'Sem reembolso'
                              else null end,
                            case when c.matricula_cancelada_em is not null
                              then 'cancelada em ' || to_char(c.matricula_cancelada_em at time zone 'America/Sao_Paulo', 'DD/MM/YYYY')
                              else null end),
    'vendedor',           (select name from public.profiles where id = c.assigned_to),
    'criado_por',         (select name from public.profiles where id = c.created_by),
    'visita_em',          to_char(c.visit_scheduled_at at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI'),
    'visita_marcada_por', (select name from public.profiles where id = c.visit_scheduled_by),
    'confirmacao',        c.visit_confirmation,
    'ligar_em',           to_char(c.call_back_at at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI'),
    'treinamentos',       array_to_string(c.treinamentos_interesse, ', '),
    'onde_na_lista',      c.list_location,
    'observacoes',        c.notes,
    'atualizado_em',      to_char(c.updated_at at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI')
  );
$$;

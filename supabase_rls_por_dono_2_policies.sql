-- RLS por dono — ETAPA 2: as políticas (A TRAVA). Depende da etapa 1.
--
-- Antes: clients/visits/tasks/matricula_credits/callbacks = auth.role()='authenticated'
-- e client_history = true, ou seja, qualquer pessoa logada lia e alterava a
-- base inteira pela API (provado em 04/09/26: a Amanda enxergava 129 de 129).
-- O escopo por papel existia só nas telas.
-- Depois: cada um vê o que é dele (regra em cliente_visivel, etapa 1); gerente tudo.
--
-- Desfazer em 2 s: supabase_rls_por_dono_9_desfazer.sql (as políticas de
-- antes, exatamente como estavam no backup de 04/09).

-- ── clients ──────────────────────────────────────────────────────────
-- A mesma lista de cliente_visivel(), inline para o Postgres usar os índices.
-- scripts/teste-rls.mjs confere, pessoa por pessoa, que as duas batem.
drop policy if exists clients_authenticated on public.clients;
drop policy if exists clients_por_dono      on public.clients;
drop policy if exists clients_ver           on public.clients;
drop policy if exists clients_inserir       on public.clients;
drop policy if exists clients_alterar       on public.clients;
drop policy if exists clients_apagar        on public.clients;

create policy clients_ver on public.clients for select to authenticated
using (
  public.eh_gerente()
  or created_by            = auth.uid()
  or dono_id               = auth.uid()
  or assigned_to           = auth.uid()
  or visit_scheduled_by    = auth.uid()
  or visit_first_booked_by = auth.uid()
  or repescagem_by         = auth.uid()
  or auth.uid() = any (encaminhado_para)
  or public.tem_credito(id)
);

-- Cadastro novo nasce seu (o formulário grava created_by = quem está logado).
create policy clients_inserir on public.clients for insert to authenticated
with check (public.eh_gerente() or created_by = auth.uid());

-- Alterar: qualquer cliente que você enxerga, para QUALQUER valor — inclusive
-- passar para outra pessoa (trocar o vendedor, remarcar com outro). Sem o
-- `with check (true)` a pessoa que entrega o cliente levaria erro 403 na mão.
create policy clients_alterar on public.clients for update to authenticated
using (
  public.eh_gerente()
  or created_by            = auth.uid()
  or dono_id               = auth.uid()
  or assigned_to           = auth.uid()
  or visit_scheduled_by    = auth.uid()
  or visit_first_booked_by = auth.uid()
  or repescagem_by         = auth.uid()
  or auth.uid() = any (encaminhado_para)
  or public.tem_credito(id)
)
with check (true);

-- O app não apaga cliente; se um dia apagar, é coisa de gerente.
create policy clients_apagar on public.clients for delete to authenticated
using (public.eh_gerente());

-- ── visits ───────────────────────────────────────────────────────────
-- Vai pelo CLIENTE, não por visits.seller_id: a coluna está nula nas visitas
-- existentes, então usá-la esconderia todas de todo mundo.
-- Quem preenche a estrela continua limitado pelo trg_guard_visit_rating.
drop policy if exists visits_authenticated on public.visits;
drop policy if exists visits_por_dono      on public.visits;
create policy visits_por_dono on public.visits for all to authenticated
using (public.cliente_visivel(client_id))
with check (public.cliente_visivel(client_id));

-- ── client_history ───────────────────────────────────────────────────
-- Também pelo próprio autor: a aba "Produzido" lista as mudanças de estágio
-- que a pessoa fez (user_id), e uma delas pode ser num cliente que hoje está
-- com outra pessoa.
drop policy if exists "Autenticados podem ler historico"       on public.client_history;
drop policy if exists "Autenticados podem inserir historico"   on public.client_history;
drop policy if exists "Autenticados podem atualizar historico" on public.client_history;
drop policy if exists "Autenticados podem deletar historico"   on public.client_history;
drop policy if exists client_history_por_dono                  on public.client_history;
create policy client_history_por_dono on public.client_history for all to authenticated
using (public.cliente_visivel(client_id) or user_id = auth.uid())
with check (public.cliente_visivel(client_id) or user_id = auth.uid());

-- ── tasks ────────────────────────────────────────────────────────────
-- Tarefa solta (client_id nulo) pertence a quem a criou; tarefa de cliente
-- segue o cliente. A estrela cria tarefa para OUTRA pessoa (seller_id = ela)
-- num cliente que quem preenche enxerga — passa pelo segundo lado.
drop policy if exists tasks_authenticated on public.tasks;
drop policy if exists tasks_por_dono      on public.tasks;
create policy tasks_por_dono on public.tasks for all to authenticated
using (seller_id = auth.uid() or public.cliente_visivel(client_id))
with check (seller_id = auth.uid() or public.cliente_visivel(client_id));

-- ── matricula_credits ────────────────────────────────────────────────
-- credited_to/enrolled_by não são enfeite: clientStage.removeMatriculaCredit
-- apaga o crédito por client_id quando o cliente sai de "matriculado". Se a
-- linha ficasse invisível para quem executa, o crédito viraria fantasma.
drop policy if exists "Authenticated users can manage matricula credits" on public.matricula_credits;
drop policy if exists matricula_credits_por_dono on public.matricula_credits;
create policy matricula_credits_por_dono on public.matricula_credits for all to authenticated
using (
  public.cliente_visivel(client_id)
  or credited_to = auth.uid()
  or enrolled_by = auth.uid()
)
with check (
  public.cliente_visivel(client_id)
  or credited_to = auth.uid()
  or enrolled_by = auth.uid()
);

-- ── callbacks ("ligar depois") ───────────────────────────────────────
-- Não tem client_id: é de quem anotou. Gerente vê o dia de qualquer um na
-- aba Hoje (fetchProduzido por pessoa).
drop policy if exists callbacks_auth     on public.callbacks;
drop policy if exists callbacks_por_dono on public.callbacks;
create policy callbacks_por_dono on public.callbacks for all to authenticated
using (public.eh_gerente() or created_by = auth.uid())
with check (public.eh_gerente() or created_by = auth.uid());

-- agenda_slots, profiles, notifications, daily_logs, google_tokens: como estavam
-- (agenda é de todos por desenho: pré-vendas marca horário na agenda do vendedor).

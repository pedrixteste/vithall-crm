-- Troca de cargo confiável: função no servidor que confirma que QUEM chamou
-- é gerente e então altera o papel do membro. Roda como "definer" (contorna
-- as travas de RLS com segurança), então o gerente consegue alterar; qualquer
-- outro papel recebe erro. Chamada pela aba Equipe via supabase.rpc(...).
create or replace function set_member_role(member_id uuid, new_role text)
returns void as $$
begin
  if coalesce((select role from profiles where id = auth.uid()), '') <> 'gerente' then
    raise exception 'Somente gerentes podem alterar papeis';
  end if;
  if new_role not in ('pre_vendas', 'vendedor', 'gerente') then
    raise exception 'Papel invalido';
  end if;
  update profiles set role = new_role where id = member_id;
end;
$$ language plpgsql security definer;

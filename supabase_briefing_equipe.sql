-- Conta supervisora do briefing: recebe, junto do "Bom dia", um resumo com a
-- produtividade e as pendências de CADA pessoa da equipe (uma linha por pessoa).
-- É um marcador no perfil — trocar quem recebe é um UPDATE, não um deploy.
alter table public.profiles
  add column if not exists briefing_equipe boolean not null default false;

-- Por enquanto, só a conta "pedro".
update public.profiles
  set briefing_equipe = true
  where id = '3cefeeae-0736-4f90-8740-92bb7c2685a4';

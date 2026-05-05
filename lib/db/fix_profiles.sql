-- Corrige/vincula os perfis GN aos usuários existentes em auth.users.
-- Rode no Supabase SQL Editor depois de criar os usuários de teste.

delete from public.profiles p
where p.email in ('encarregado@gn.local', 'admin@gn.local', 'gestor@gn.local')
  and not exists (
    select 1
    from auth.users u
    where u.id = p.id
  );

insert into public.profiles (id, email, nome, role)
select u.id, u.email, p.nome, p.role::user_role
from (values
  ('encarregado@gn.local', 'Joao Silva (Encarregado)', 'encarregado'),
  ('admin@gn.local',       'Maria Souza (Admin)',      'admin'),
  ('gestor@gn.local',      'Carlos Pereira (Gestor)',  'gestor')
) as p(email, nome, role)
join auth.users u on u.email = p.email
on conflict (id) do update set
  email = excluded.email,
  nome = excluded.nome,
  role = excluded.role,
  ativo = true,
  updated_at = now();

update public.profiles
set equipe_id = '11111111-1111-1111-1111-111111111111'
where email = 'encarregado@gn.local'
  and exists (
    select 1 from public.equipes
    where id = '11111111-1111-1111-1111-111111111111'
  );

select
  u.email as auth_email,
  u.id as auth_user_id,
  p.id as profile_id,
  p.nome,
  p.role,
  (p.id = u.id) as vinculado
from auth.users u
left join public.profiles p on p.id = u.id
where u.email in ('encarregado@gn.local', 'admin@gn.local', 'gestor@gn.local')
order by u.email;

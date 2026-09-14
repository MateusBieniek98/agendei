-- Execute somente em banco local ou staging descartável, depois de todas as
-- migrations. O script cria fixtures, testa a matriz RLS e faz ROLLBACK.

begin;

create or replace function pg_temp.assert_true(condition boolean, message text)
returns void language plpgsql as $$
begin
  if not coalesce(condition, false) then
    raise exception 'ASSERTION FAILED: %', message;
  end if;
end $$;

create or replace function pg_temp.assert_raises(
  statement text,
  expected_state text,
  message text
)
returns void language plpgsql as $$
begin
  begin
    execute statement;
    raise exception 'ASSERTION FAILED: % (no error)', message;
  exception
    when others then
      if sqlstate = 'P0001' and sqlerrm like 'ASSERTION FAILED:%' then
        raise;
      end if;
      if sqlstate <> expected_state then
        raise exception 'ASSERTION FAILED: % (expected %, received %: %)',
          message, expected_state, sqlstate, sqlerrm;
      end if;
  end;
end $$;

-- UUIDs fixos tornam falhas reproduzíveis e são descartados no rollback.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000000',
   '10000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated',
   'tenant-a-test@example.invalid', '', now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000',
   '20000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated',
   'tenant-b-test@example.invalid', '', now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now());

insert into public.organizations (id, slug, display_name, status)
values
  ('a0000000-0000-0000-0000-000000000001', 'tenant-a-test', 'Tenant A Test', 'active'),
  ('b0000000-0000-0000-0000-000000000002', 'tenant-b-test', 'Tenant B Test', 'active');

insert into public.profiles (
  id, email, nome, role, ativo, active_organization_id
) values
  ('10000000-0000-0000-0000-000000000001', 'tenant-a-test@example.invalid',
   'Admin A', 'admin', true, 'a0000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-000000000002', 'tenant-b-test@example.invalid',
   'Admin B', 'admin', true, 'b0000000-0000-0000-0000-000000000002')
on conflict (id) do update set
  active_organization_id = excluded.active_organization_id,
  ativo = true;

insert into public.organization_members (organization_id, user_id, role, active)
values
  ('a0000000-0000-0000-0000-000000000001',
   '10000000-0000-0000-0000-000000000001', 'admin', true),
  ('b0000000-0000-0000-0000-000000000002',
   '20000000-0000-0000-0000-000000000002', 'admin', true);

insert into public.equipes (id, nome, ativo, organization_id)
values
  ('aa000000-0000-0000-0000-000000000001', 'Equipe A', true,
   'a0000000-0000-0000-0000-000000000001'),
  ('bb000000-0000-0000-0000-000000000002', 'Equipe B', true,
   'b0000000-0000-0000-0000-000000000002');

insert into storage.buckets (id, name, public)
values ('manutencao-fotos', 'manutencao-fotos', false)
on conflict (id) do nothing;

insert into storage.objects (bucket_id, name, owner_id)
values
  ('manutencao-fotos',
   'a0000000-0000-0000-0000-000000000001/10000000-0000-0000-0000-000000000001/a.txt',
   '10000000-0000-0000-0000-000000000001'),
  ('manutencao-fotos',
   'b0000000-0000-0000-0000-000000000002/20000000-0000-0000-0000-000000000002/b.txt',
   '20000000-0000-0000-0000-000000000002');

set local role anon;
select pg_temp.assert_raises(
  $$select count(*) from public.equipes$$,
  '42501',
  'anon não recebe grant em tabelas operacionais'
);
select pg_temp.assert_raises(
  $$select count(*) from public.organizations$$,
  '42501',
  'anon não recebe grant para listar organizações'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub',
  '10000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

-- SELECT: A vê A e nunca B.
select pg_temp.assert_true(
  (select count(*) = 1 from public.equipes),
  'SELECT operacional deve retornar somente o tenant ativo'
);
select pg_temp.assert_true(
  (select count(*) = 0 from public.equipes
    where organization_id = 'b0000000-0000-0000-0000-000000000002'),
  'SELECT não pode revelar tenant B'
);
select pg_temp.assert_true(
  (select count(*) = 0 from public.profiles
    where id = '20000000-0000-0000-0000-000000000002'),
  'profiles não pode revelar membro exclusivo do tenant B'
);

-- INSERT: A escreve em A; tentativa explícita em B falha.
insert into public.equipes (nome, ativo, organization_id)
values ('Equipe A criada pela RLS', true,
  'a0000000-0000-0000-0000-000000000001');
select pg_temp.assert_raises(
  $$insert into public.equipes (nome, ativo, organization_id)
    values ('Cross tenant', true,
      'b0000000-0000-0000-0000-000000000002')$$,
  '42501',
  'INSERT cruzado deve falhar'
);

-- UPDATE/DELETE: a linha B fica invisível e nenhuma linha é alterada.
with changed as (
  update public.equipes set nome = 'Invadida'
  where id = 'bb000000-0000-0000-0000-000000000002'
  returning 1
)
select pg_temp.assert_true((select count(*) = 0 from changed),
  'UPDATE cruzado deve afetar zero linhas');

with removed as (
  delete from public.equipes
  where id = 'bb000000-0000-0000-0000-000000000002'
  returning 1
)
select pg_temp.assert_true((select count(*) = 0 from removed),
  'DELETE cruzado deve afetar zero linhas');

-- RPC: usuário A não pode ativar organização B.
select pg_temp.assert_raises(
  $$select public.switch_active_organization(
    'b0000000-0000-0000-0000-000000000002')$$,
  '42501',
  'RPC não pode trocar para organização sem associação'
);

select pg_temp.assert_raises(
  $$update public.organization_members
    set role = 'gestor'
    where organization_id = 'a0000000-0000-0000-0000-000000000001'
      and user_id = '10000000-0000-0000-0000-000000000001'$$,
  '23514',
  'último administrador ativo deve ser preservado'
);

-- Storage: somente o prefixo da organização ativa é visível.
select pg_temp.assert_true(
  (select count(*) = 1 from storage.objects
   where bucket_id = 'manutencao-fotos'
     and name like 'a0000000-0000-0000-0000-000000000001/%'),
  'Storage deve retornar somente o prefixo do tenant A'
);

reset role;

-- Confirma que tentativas anteriores não tocaram o tenant B.
select pg_temp.assert_true(
  (select nome = 'Equipe B' from public.equipes
   where id = 'bb000000-0000-0000-0000-000000000002'),
  'tenant B deve permanecer intacto'
);

rollback;

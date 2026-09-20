-- Execute only in a disposable local database or staging. All fixtures are
-- rolled back after checking temporary support access and tenant isolation.

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

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000000',
   '56000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated',
   'platform-support-test@example.invalid', '', now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000',
   '56000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated',
   'tenant-support-admin@example.invalid', '', now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now());

insert into public.organizations (id, slug, display_name, status)
values
  ('56000000-0000-0000-0000-000000000010', 'platform-home-test',
   'Platform Home Test', 'active'),
  ('56000000-0000-0000-0000-000000000020', 'platform-target-test',
   'Platform Target Test', 'suspended');

insert into public.profiles (
  id, email, nome, role, ativo, active_organization_id
) values
  ('56000000-0000-0000-0000-000000000001',
   'platform-support-test@example.invalid', 'Platform Operator', 'admin', true,
   '56000000-0000-0000-0000-000000000010'),
  ('56000000-0000-0000-0000-000000000002',
   'tenant-support-admin@example.invalid', 'Tenant Admin', 'admin', true,
   '56000000-0000-0000-0000-000000000020');

insert into public.organization_members (organization_id, user_id, role, active)
values
  ('56000000-0000-0000-0000-000000000010',
   '56000000-0000-0000-0000-000000000001', 'admin', true),
  ('56000000-0000-0000-0000-000000000020',
   '56000000-0000-0000-0000-000000000002', 'admin', true);

insert into private.platform_admins (user_id)
values ('56000000-0000-0000-0000-000000000001');

select public.begin_platform_support_session(
  '56000000-0000-0000-0000-000000000001',
  '56000000-0000-0000-0000-000000000020',
  'Validação automatizada do suporte temporário',
  30
);

select pg_temp.assert_true(
  (select count(*) = 1
   from public.platform_support_sessions
   where actor_id = '56000000-0000-0000-0000-000000000001'
     and organization_id = '56000000-0000-0000-0000-000000000020'
     and ended_at is null),
  'início deve criar uma única sessão aberta'
);
select pg_temp.assert_true(
  (select active_organization_id = '56000000-0000-0000-0000-000000000020'
   from public.profiles
   where id = '56000000-0000-0000-0000-000000000001'),
  'início deve ativar o tenant alvo'
);
select pg_temp.assert_true(
  (select count(*) = 0
   from public.organization_members
   where organization_id = '56000000-0000-0000-0000-000000000020'
     and user_id = '56000000-0000-0000-0000-000000000001'),
  'suporte não deve criar associação permanente'
);

-- Simula um vínculo legado com papel inferior. A sessão de suporte deve
-- continuar projetando o papel administrativo durante a manutenção.
insert into public.organization_members (organization_id, user_id, role, active)
values (
  '56000000-0000-0000-0000-000000000020',
  '56000000-0000-0000-0000-000000000001',
  'encarregado',
  true
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '56000000-0000-0000-0000-000000000001',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);

select pg_temp.assert_true(
  public.current_role() = 'admin',
  'sessão de suporte deve projetar papel admin'
);
select pg_temp.assert_raises(
  $$select count(*) from public.platform_support_sessions$$,
  '42501',
  'tabela de sessões não pode ser consultada diretamente'
);

insert into public.equipes (nome, ativo, organization_id)
values (
  'Equipe criada em suporte', true,
  '56000000-0000-0000-0000-000000000020'
);
select pg_temp.assert_raises(
  $$insert into public.equipes (nome, ativo, organization_id)
    values ('Tentativa fora do tenant', true,
      '56000000-0000-0000-0000-000000000010')$$,
  '42501',
  'sessão de suporte não pode alterar outro tenant'
);

reset role;

select public.end_platform_support_session(
  '56000000-0000-0000-0000-000000000001',
  'teste_concluido'
);
select pg_temp.assert_true(
  (select active_organization_id = '56000000-0000-0000-0000-000000000010'
   from public.profiles
   where id = '56000000-0000-0000-0000-000000000001'),
  'encerramento deve restaurar o tenant anterior'
);
select pg_temp.assert_true(
  (select count(*) = 2
   from public.platform_audit_log
   where actor_id = '56000000-0000-0000-0000-000000000001'
     and action in ('organization.support_started', 'organization.support_ended')),
  'entrada e saída devem permanecer auditadas'
);

rollback;

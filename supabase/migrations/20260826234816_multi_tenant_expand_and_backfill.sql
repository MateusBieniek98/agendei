-- Phase 1/3 of the multi-tenant rollout.
--
-- This migration is intentionally backward compatible with the current GN
-- application: tenant columns are added, existing rows are assigned to the
-- initial GN organization and authenticated writes receive the active tenant
-- as a default. The isolation policies and NOT NULL constraints are installed
-- by the following migration only after the application has been validated in
-- staging.

begin;

do $$
begin
  create type public.organization_status as enum (
    'onboarding',
    'active',
    'suspended',
    'cancelled'
  );
exception when duplicate_object then null;
end $$;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  display_name text not null,
  legal_name text,
  document_number text,
  status public.organization_status not null default 'onboarding',
  plan_code text not null default 'founder',
  user_limit integer not null default 30 check (user_limit > 0),
  billing_email text,
  contract_started_at date,
  contract_ends_at date,
  suspended_reason text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organizations_slug_format_check
    check (slug = lower(slug) and slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint organizations_contract_period_check
    check (
      contract_ends_at is null
      or contract_started_at is null
      or contract_ends_at >= contract_started_at
    )
);

create unique index if not exists organizations_slug_unique
  on public.organizations (lower(slug));
create index if not exists organizations_status_idx
  on public.organizations (status, created_at desc);

alter table public.profiles
  add column if not exists active_organization_id uuid
    references public.organizations(id) on delete set null;

create table if not exists public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.user_role not null default 'encarregado',
  equipe_id uuid references public.equipes(id) on delete set null,
  active boolean not null default true,
  invited_by uuid references public.profiles(id) on delete set null,
  joined_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create index if not exists organization_members_user_active_idx
  on public.organization_members (user_id, active, organization_id);
create index if not exists organization_members_org_role_idx
  on public.organization_members (organization_id, role, active);
create index if not exists organization_members_equipe_idx
  on public.organization_members (organization_id, equipe_id)
  where equipe_id is not null;

create table if not exists public.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role public.user_role not null default 'encarregado',
  equipe_id uuid references public.equipes(id) on delete set null,
  token_hash text not null,
  invited_by uuid not null references public.profiles(id) on delete restrict,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint organization_invitations_email_check
    check (email = lower(trim(email)) and position('@' in email) > 1),
  constraint organization_invitations_expiry_check
    check (expires_at > created_at)
);

create unique index if not exists organization_invitations_token_hash_unique
  on public.organization_invitations (token_hash);
create unique index if not exists organization_invitations_pending_email_unique
  on public.organization_invitations (organization_id, lower(email))
  where accepted_at is null and revoked_at is null;
create index if not exists organization_invitations_org_expiry_idx
  on public.organization_invitations (organization_id, expires_at desc);

create table if not exists public.organization_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  timezone text not null default 'America/Campo_Grande',
  locale text not null default 'pt-BR',
  operational_name text,
  support_email text,
  privacy_email text,
  production_report jsonb not null default '{}'::jsonb,
  feature_flags jsonb not null default '{}'::jsonb,
  onboarding_state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Public only because PostgREST does not expose the private schema. No API
-- role receives access; all reads/writes go through server-only code.
create table if not exists public.organization_integrations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null,
  enabled boolean not null default false,
  config jsonb not null default '{}'::jsonb,
  token_hash text,
  secret_reference text,
  last_success_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, provider)
);

create unique index if not exists organization_integrations_token_hash_unique
  on public.organization_integrations (token_hash)
  where enabled is true and token_hash is not null;

create table if not exists private.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.platform_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete set null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists platform_audit_log_created_idx
  on public.platform_audit_log (created_at desc);
create index if not exists platform_audit_log_organization_idx
  on public.platform_audit_log (organization_id, created_at desc);
alter table public.platform_audit_log enable row level security;
revoke all on public.platform_audit_log from public, anon, authenticated;
grant all on public.platform_audit_log to service_role;

create table if not exists public.api_rate_limits (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  bucket text not null,
  window_started_at timestamptz not null,
  request_count integer not null default 0 check (request_count >= 0),
  primary key (organization_id, bucket, window_started_at)
);
alter table public.api_rate_limits enable row level security;
revoke all on public.api_rate_limits from public, anon, authenticated;
grant all on public.api_rate_limits to service_role;

create or replace function public.consume_api_rate_limit(
  p_organization_id uuid,
  p_bucket text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_window_started_at timestamptz;
  v_count integer;
begin
  if p_limit < 1 or p_window_seconds < 1 or nullif(trim(p_bucket), '') is null then
    raise exception 'Configuração de limite inválida.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.organizations where id = p_organization_id) then
    raise exception 'Organização inválida.' using errcode = '23503';
  end if;

  delete from public.api_rate_limits
  where organization_id = p_organization_id
    and window_started_at < clock_timestamp() - interval '7 days';

  v_window_started_at := to_timestamp(
    floor(extract(epoch from clock_timestamp()) / p_window_seconds) * p_window_seconds
  );
  insert into public.api_rate_limits (
    organization_id, bucket, window_started_at, request_count
  ) values (
    p_organization_id, trim(p_bucket), v_window_started_at, 1
  )
  on conflict (organization_id, bucket, window_started_at)
  do update set request_count = public.api_rate_limits.request_count + 1
  returning request_count into v_count;
  return v_count <= p_limit;
end;
$$;

revoke all on function public.consume_api_rate_limit(uuid, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_api_rate_limit(uuid, text, integer, integer)
  to service_role;

revoke all on table private.platform_admins from public, anon, authenticated;
grant select, insert, update, delete on table private.platform_admins to service_role;

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = private, public, pg_temp
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from private.platform_admins pa
      where pa.user_id = (select auth.uid())
    )
$$;

revoke all on function public.is_platform_admin() from public, anon, authenticated;
grant execute on function public.is_platform_admin() to authenticated, service_role;

-- The existing operation becomes the first tenant. The slug is an internal
-- migration identifier and is not the future commercial product name.
insert into public.organizations (
  slug,
  display_name,
  legal_name,
  status,
  plan_code,
  user_limit,
  contract_started_at
)
values (
  'gn',
  'GN',
  'GN',
  'active',
  'founder',
  30,
  current_date
)
on conflict ((lower(slug))) do update
set display_name = excluded.display_name,
    status = 'active',
    updated_at = now();

insert into public.organization_settings (organization_id, operational_name)
select id, display_name
from public.organizations
where lower(slug) = 'gn'
on conflict (organization_id) do nothing;

insert into public.organization_members (
  organization_id,
  user_id,
  role,
  equipe_id,
  active,
  joined_at
)
select
  o.id,
  p.id,
  p.role,
  p.equipe_id,
  p.ativo,
  coalesce(p.created_at, now())
from public.organizations o
cross join public.profiles p
where lower(o.slug) = 'gn'
on conflict (organization_id, user_id) do update
set role = excluded.role,
    equipe_id = excluded.equipe_id,
    active = excluded.active,
    updated_at = now();

update public.organizations o
set user_limit = greatest(
      o.user_limit,
      (
        select count(*)::integer
        from public.organization_members m
        where m.organization_id = o.id and m.active is true
      )
    ),
    updated_at = now()
where lower(o.slug) = 'gn';

update public.profiles p
set active_organization_id = o.id
from public.organizations o
where lower(o.slug) = 'gn'
  and p.active_organization_id is null;

-- Platform administrators are never inferred from a customer role. Provision
-- the verified owner explicitly, with service_role/SQL Editor, only after MFA
-- is enrolled and the UUID is recorded in the rollout evidence.

-- Tenant-owned data. The dynamic form keeps this migration repeatable across
-- older installations where optional modules were not created yet.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'equipes',
    'atividades',
    'services_metadata',
    'projetos',
    'talhoes',
    'producao',
    'planejamento',
    'maquinas',
    'manutencoes',
    'metas',
    'metas_equipes',
    'metas_atividades',
    'audit_log',
    'sync_jobs',
    'app_settings',
    'insumos',
    'insumo_movimentacoes',
    'manutencao_anexos',
    'manutencao_comentarios',
    'manutencao_mencoes',
    'manutencao_eventos',
    'alocacoes_operacionais'
  ]
  loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format(
        'alter table public.%I add column if not exists organization_id uuid references public.organizations(id) on delete restrict',
        table_name
      );
      execute format(
        'update public.%I set organization_id = (select id from public.organizations where lower(slug) = ''gn'') where organization_id is null',
        table_name
      );
      execute format(
        'create index if not exists %I on public.%I (organization_id)',
        left('idx_' || table_name || '_organization', 63),
        table_name
      );
    end if;
  end loop;
end $$;

-- Dual indexes keep both the legacy and tenant-aware application versions
-- functional during the expand/contract deployment window.
create unique index if not exists services_metadata_org_service_key_expand_unique
  on public.services_metadata (organization_id, service_key);
create unique index if not exists projetos_org_nome_expand_unique
  on public.projetos (organization_id, nome);
create unique index if not exists sync_jobs_org_tipo_dedupe_expand_unique
  on public.sync_jobs (organization_id, tipo, dedupe_key);
create unique index if not exists planejamento_org_origem_chave_expand_unique
  on public.planejamento (organization_id, origem_chave)
  where origem_chave is not null;
create unique index if not exists producao_org_origem_chave_expand_unique
  on public.producao (organization_id, origem_chave)
  where origem_chave is not null;

create or replace function private.current_organization_id()
returns uuid
language sql
stable
security definer
set search_path = public, private, pg_temp
as $$
  select p.active_organization_id
  from public.profiles p
  join public.organization_members m
    on m.organization_id = p.active_organization_id
   and m.user_id = p.id
   and m.active is true
  where p.id = (select auth.uid())
    and p.ativo is true
  limit 1
$$;

create or replace function private.has_organization_role(
  p_organization_id uuid,
  p_roles text[] default null
)
returns boolean
language sql
stable
security definer
set search_path = public, private, pg_temp
as $$
  select exists (
    select 1
    from public.organization_members m
    join public.profiles p on p.id = m.user_id and p.ativo is true
    where m.organization_id = p_organization_id
      and m.user_id = (select auth.uid())
      and m.active is true
      and (p_roles is null or m.role::text = any(p_roles))
  )
$$;

revoke all on function private.current_organization_id() from public, anon, authenticated;
revoke all on function private.has_organization_role(uuid, text[]) from public, anon, authenticated;
grant usage on schema private to authenticated, service_role;
grant execute on function private.current_organization_id() to authenticated, service_role;
grant execute on function private.has_organization_role(uuid, text[]) to authenticated, service_role;

-- Existing application inserts remain valid during the expand phase. Server
-- jobs using service_role must pass organization_id explicitly.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'equipes', 'atividades', 'services_metadata', 'projetos', 'talhoes',
    'producao', 'planejamento', 'maquinas', 'manutencoes', 'metas',
    'metas_equipes', 'metas_atividades', 'audit_log', 'sync_jobs',
    'app_settings', 'insumos', 'insumo_movimentacoes', 'manutencao_anexos',
    'manutencao_comentarios', 'manutencao_mencoes', 'manutencao_eventos',
    'alocacoes_operacionais'
  ]
  loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format(
        'alter table public.%I alter column organization_id set default private.current_organization_id()',
        table_name
      );
    end if;
  end loop;
end $$;

-- Move role/team authority to the membership while keeping legacy columns in
-- profiles for a reversible transition.
create or replace function public.current_role()
returns public.user_role
language sql
stable
security definer
set search_path = public, private, pg_temp
as $$
  select m.role
  from public.profiles p
  join public.organization_members m
    on m.organization_id = p.active_organization_id
   and m.user_id = p.id
   and m.active is true
  where p.id = (select auth.uid())
    and p.ativo is true
  limit 1
$$;

revoke all on function public.current_role() from public, anon, authenticated;
grant execute on function public.current_role() to authenticated, service_role;

-- Audit entries inherit the tenant of the changed row. This keeps the audit
-- table useful during the backfill and removes any dependency on client input.
create or replace function public.fn_audit()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_user uuid := nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
  v_source jsonb;
  v_organization_id uuid;
begin
  v_source := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_organization_id := coalesce(
    nullif(v_source ->> 'organization_id', '')::uuid,
    private.current_organization_id()
  );

  if tg_op = 'DELETE' then
    insert into public.audit_log(
      organization_id, tabela, registro_id, acao, usuario_id, diff
    ) values (
      v_organization_id, tg_table_name, old.id, 'delete', v_user, to_jsonb(old)
    );
    return old;
  elsif tg_op = 'UPDATE' then
    insert into public.audit_log(
      organization_id, tabela, registro_id, acao, usuario_id, diff
    ) values (
      v_organization_id,
      tg_table_name,
      new.id,
      'update',
      v_user,
      jsonb_build_object('antes', to_jsonb(old), 'depois', to_jsonb(new))
    );
    return new;
  end if;

  insert into public.audit_log(
    organization_id, tabela, registro_id, acao, usuario_id, diff
  ) values (
    v_organization_id, tg_table_name, new.id, 'insert', v_user, to_jsonb(new)
  );
  return new;
end;
$$;

-- New tables are explicitly exposed. RLS still controls their rows.
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.organization_invitations enable row level security;
alter table public.organization_settings enable row level security;
alter table public.organization_integrations enable row level security;

revoke all on public.organizations from public, anon, authenticated;
revoke all on public.organization_members from public, anon, authenticated;
revoke all on public.organization_invitations from public, anon, authenticated;
revoke all on public.organization_settings from public, anon, authenticated;
revoke all on public.organization_integrations from public, anon, authenticated;

grant select on public.organizations to authenticated;
grant select on public.organization_members to authenticated;
grant select, insert, update, delete on public.organization_invitations to service_role;
grant select, insert, update, delete on public.organization_settings to authenticated;
grant select, insert, update, delete on public.organization_integrations to service_role;
grant all on public.organizations,
  public.organization_members,
  public.organization_invitations,
  public.organization_settings,
  public.organization_integrations
to service_role;

drop policy if exists organizations_member_read on public.organizations;
create policy organizations_member_read on public.organizations
for select to authenticated
using (private.has_organization_role(id));

drop policy if exists organization_members_member_read on public.organization_members;
create policy organization_members_member_read on public.organization_members
for select to authenticated
using (private.has_organization_role(organization_id));

drop policy if exists organization_members_admin_insert on public.organization_members;
create policy organization_members_admin_insert on public.organization_members
for insert to authenticated
with check (private.has_organization_role(organization_id, array['admin']));

drop policy if exists organization_members_admin_update on public.organization_members;
create policy organization_members_admin_update on public.organization_members
for update to authenticated
using (private.has_organization_role(organization_id, array['admin']))
with check (private.has_organization_role(organization_id, array['admin']));

drop policy if exists organization_members_admin_delete on public.organization_members;
create policy organization_members_admin_delete on public.organization_members
for delete to authenticated
using (
  user_id <> (select auth.uid())
  and private.has_organization_role(organization_id, array['admin'])
);

drop policy if exists organization_settings_member_read on public.organization_settings;
create policy organization_settings_member_read on public.organization_settings
for select to authenticated
using (private.has_organization_role(organization_id));

drop policy if exists organization_settings_admin_insert on public.organization_settings;
create policy organization_settings_admin_insert on public.organization_settings
for insert to authenticated
with check (private.has_organization_role(organization_id, array['admin']));

drop policy if exists organization_settings_admin_update on public.organization_settings;
create policy organization_settings_admin_update on public.organization_settings
for update to authenticated
using (private.has_organization_role(organization_id, array['admin']))
with check (private.has_organization_role(organization_id, array['admin']));

-- updated_at support for new tables.
drop trigger if exists organizations_touch on public.organizations;
create trigger organizations_touch before update on public.organizations
for each row execute function public.touch_updated_at();
drop trigger if exists organization_members_touch on public.organization_members;
create trigger organization_members_touch before update on public.organization_members
for each row execute function public.touch_updated_at();
drop trigger if exists organization_settings_touch on public.organization_settings;
create trigger organization_settings_touch before update on public.organization_settings
for each row execute function public.touch_updated_at();
drop trigger if exists organization_integrations_touch on public.organization_integrations;
create trigger organization_integrations_touch before update on public.organization_integrations
for each row execute function public.touch_updated_at();

commit;

-- Temporary, audited access for Talhivo platform operators.
-- A platform administrator never becomes a permanent organization member.

begin;

create table if not exists public.platform_support_sessions (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  previous_organization_id uuid references public.organizations(id) on delete set null,
  reason text not null,
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  ended_at timestamptz,
  ended_reason text,
  constraint platform_support_sessions_reason_check
    check (char_length(trim(reason)) between 8 and 500),
  constraint platform_support_sessions_expiry_check
    check (
      expires_at > started_at
      and expires_at <= started_at + interval '2 hours'
    ),
  constraint platform_support_sessions_end_check
    check (ended_at is null or ended_at >= started_at)
);

create unique index if not exists platform_support_sessions_actor_open_unique
  on public.platform_support_sessions (actor_id)
  where ended_at is null;
create index if not exists platform_support_sessions_org_started_idx
  on public.platform_support_sessions (organization_id, started_at desc);
create index if not exists platform_support_sessions_expiry_idx
  on public.platform_support_sessions (expires_at)
  where ended_at is null;

alter table public.platform_support_sessions enable row level security;
revoke all on public.platform_support_sessions from public, anon, authenticated;
grant all on public.platform_support_sessions to service_role;

create or replace function private.has_active_platform_support(
  p_organization_id uuid,
  p_actor_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_actor_id is not null
    and exists (
      select 1
      from private.platform_admins pa
      join public.platform_support_sessions support
        on support.actor_id = pa.user_id
      where pa.user_id = p_actor_id
        and support.organization_id = p_organization_id
        and support.ended_at is null
        and support.expires_at > now()
    )
$$;

revoke all on function private.has_active_platform_support(uuid, uuid)
  from public, anon, authenticated;
grant execute on function private.has_active_platform_support(uuid, uuid)
  to authenticated, service_role;

create or replace function private.current_organization_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.active_organization_id
  from public.profiles p
  where p.id = (select auth.uid())
    and p.ativo is true
    and (
      exists (
        select 1
        from public.organization_members m
        where m.organization_id = p.active_organization_id
          and m.user_id = p.id
          and m.active is true
      )
      or private.has_active_platform_support(
        p.active_organization_id,
        p.id
      )
    )
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
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members m
    join public.profiles p on p.id = m.user_id and p.ativo is true
    where m.organization_id = p_organization_id
      and m.user_id = (select auth.uid())
      and m.active is true
      and (p_roles is null or m.role::text = any(p_roles))
  ) or (
    (p_roles is null or 'admin' = any(p_roles))
    and private.has_active_platform_support(
      p_organization_id,
      (select auth.uid())
    )
  )
$$;

create or replace function private.organization_is_accessible(
  p_organization_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organizations o
    where o.id = p_organization_id
      and (
        o.status in ('onboarding', 'active')
        or private.has_active_platform_support(
          p_organization_id,
          (select auth.uid())
        )
      )
  )
$$;

create or replace function public.current_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select m.role
      from public.organization_members m
      where m.organization_id = p.active_organization_id
        and m.user_id = p.id
        and m.active is true
      limit 1
    ),
    case
      when private.has_active_platform_support(
        p.active_organization_id,
        p.id
      ) then 'admin'::public.user_role
      else null
    end
  )
  from public.profiles p
  where p.id = (select auth.uid())
    and p.ativo is true
  limit 1
$$;

-- The relationship guard accepts the current support operator as an actor,
-- while every other referenced person must remain a real tenant member.
create or replace function private.enforce_same_tenant_relations()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  argument_index integer := 0;
  target_name text;
  column_name text;
  referenced_id uuid;
  row_org uuid := nullif(to_jsonb(new) ->> 'organization_id', '')::uuid;
  relation_ok boolean;
begin
  while argument_index < tg_nargs loop
    target_name := tg_argv[argument_index];
    column_name := tg_argv[argument_index + 1];
    referenced_id := nullif(to_jsonb(new) ->> column_name, '')::uuid;
    argument_index := argument_index + 2;

    if referenced_id is null then
      continue;
    end if;

    if target_name in ('@member', '@member_or_platform') then
      select exists (
        select 1
        from public.organization_members m
        where m.organization_id = row_org
          and m.user_id = referenced_id
        union all
        select 1
        from private.platform_admins pa
        where target_name = '@member_or_platform'
          and pa.user_id = referenced_id
        union all
        select 1
        where referenced_id = (select auth.uid())
          and private.has_active_platform_support(row_org, referenced_id)
      ) into relation_ok;
    else
      execute format(
        'select exists (select 1 from %s where id = $1 and organization_id = $2)',
        target_name::regclass
      ) using referenced_id, row_org into relation_ok;
    end if;

    if not relation_ok then
      raise exception 'cross_organization_relationship: %.%', tg_table_name, column_name
        using errcode = '23503';
    end if;
  end loop;

  return new;
end;
$$;

create or replace function public.current_platform_support_session()
returns table (
  id uuid,
  organization_id uuid,
  reason text,
  started_at timestamptz,
  expires_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    support.id,
    support.organization_id,
    support.reason,
    support.started_at,
    support.expires_at
  from public.platform_support_sessions support
  join public.profiles p
    on p.id = support.actor_id
   and p.active_organization_id = support.organization_id
   and p.ativo is true
  join private.platform_admins pa on pa.user_id = support.actor_id
  where support.actor_id = (select auth.uid())
    and support.ended_at is null
    and support.expires_at > now()
  order by support.started_at desc
  limit 1
$$;

revoke all on function public.current_platform_support_session()
  from public, anon, authenticated;
grant execute on function public.current_platform_support_session()
  to authenticated, service_role;

create or replace function public.begin_platform_support_session(
  p_actor_id uuid,
  p_organization_id uuid,
  p_reason text,
  p_duration_minutes integer default 60
)
returns public.platform_support_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous_organization uuid;
  support_session public.platform_support_sessions;
  normalized_reason text := trim(coalesce(p_reason, ''));
begin
  if not exists (
    select 1 from private.platform_admins pa where pa.user_id = p_actor_id
  ) then
    raise exception 'Administrador da plataforma inválido.' using errcode = '42501';
  end if;
  if char_length(normalized_reason) < 8 or char_length(normalized_reason) > 500 then
    raise exception 'Informe um motivo entre 8 e 500 caracteres.' using errcode = '22023';
  end if;
  if p_duration_minutes not in (30, 60, 120) then
    raise exception 'Duração de suporte inválida.' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.organizations o where o.id = p_organization_id
  ) then
    raise exception 'Empresa não encontrada.' using errcode = '23503';
  end if;

  select p.active_organization_id
  into previous_organization
  from public.profiles p
  where p.id = p_actor_id and p.ativo is true
  for update;
  if not found then
    raise exception 'Perfil ativo da plataforma não encontrado.' using errcode = '42501';
  end if;

  update public.platform_support_sessions
  set ended_at = now(),
      ended_reason = 'substituida_por_nova_sessao'
  where actor_id = p_actor_id and ended_at is null;

  insert into public.platform_support_sessions (
    actor_id,
    organization_id,
    previous_organization_id,
    reason,
    expires_at
  ) values (
    p_actor_id,
    p_organization_id,
    previous_organization,
    normalized_reason,
    now() + make_interval(mins => p_duration_minutes)
  )
  returning * into support_session;

  update public.profiles
  set active_organization_id = p_organization_id,
      updated_at = now()
  where id = p_actor_id;

  insert into public.platform_audit_log (
    actor_id,
    organization_id,
    action,
    details
  ) values (
    p_actor_id,
    p_organization_id,
    'organization.support_started',
    jsonb_build_object(
      'support_session_id', support_session.id,
      'reason', normalized_reason,
      'expires_at', support_session.expires_at
    )
  );

  return support_session;
end;
$$;

create or replace function public.end_platform_support_session(
  p_actor_id uuid,
  p_reason text default 'encerrada_pelo_operador'
)
returns public.platform_support_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  support_session public.platform_support_sessions;
  restore_organization uuid;
begin
  if not exists (
    select 1 from private.platform_admins pa where pa.user_id = p_actor_id
  ) then
    raise exception 'Administrador da plataforma inválido.' using errcode = '42501';
  end if;

  select *
  into support_session
  from public.platform_support_sessions support
  where support.actor_id = p_actor_id and support.ended_at is null
  order by support.started_at desc
  limit 1
  for update;

  if not found then
    return null;
  end if;

  update public.platform_support_sessions
  set ended_at = now(),
      ended_reason = left(trim(coalesce(p_reason, 'encerrada_pelo_operador')), 120)
  where id = support_session.id
  returning * into support_session;

  select candidate.organization_id
  into restore_organization
  from (
    select
      m.organization_id,
      case when m.organization_id = support_session.previous_organization_id then 0 else 1 end priority,
      m.created_at
    from public.organization_members m
    join public.organizations o on o.id = m.organization_id
    where m.user_id = p_actor_id
      and m.active is true
      and o.status in ('onboarding', 'active')
  ) candidate
  order by candidate.priority, candidate.created_at
  limit 1;

  update public.profiles
  set active_organization_id = restore_organization,
      updated_at = now()
  where id = p_actor_id;

  insert into public.platform_audit_log (
    actor_id,
    organization_id,
    action,
    details
  ) values (
    p_actor_id,
    support_session.organization_id,
    'organization.support_ended',
    jsonb_build_object(
      'support_session_id', support_session.id,
      'reason', support_session.ended_reason,
      'restored_organization_id', restore_organization
    )
  );

  return support_session;
end;
$$;

revoke all on function public.begin_platform_support_session(uuid, uuid, text, integer)
  from public, anon, authenticated;
revoke all on function public.end_platform_support_session(uuid, text)
  from public, anon, authenticated;
grant execute on function public.begin_platform_support_session(uuid, uuid, text, integer)
  to service_role;
grant execute on function public.end_platform_support_session(uuid, text)
  to service_role;

commit;

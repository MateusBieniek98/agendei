-- Phase 2/3 of the multi-tenant rollout.
-- Apply only after the expand migration, the tenant-aware app release and the
-- reconciliation queries in docs/commercial/MULTI_TENANT_ROLLOUT.md pass in
-- staging. This migration is the security boundary between customers.

begin;

create or replace function private.organization_is_accessible(
  p_organization_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, private, pg_temp
as $$
  select exists (
    select 1
    from public.organizations o
    where o.id = p_organization_id
      and o.status in ('onboarding', 'active')
  )
$$;

revoke all on function private.organization_is_accessible(uuid)
  from public, anon, authenticated;
grant execute on function private.organization_is_accessible(uuid)
  to authenticated, service_role;

-- Every tenant-owned row must have been reconciled before constraints are
-- tightened. Failing fast here prevents a partial isolation rollout.
do $$
declare
  table_name text;
  orphan_count bigint;
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
        'select count(*) from public.%I where organization_id is null',
        table_name
      ) into orphan_count;
      if orphan_count > 0 then
        raise exception 'tenant_backfill_incomplete: %.organization_id has % null rows',
          table_name,
          orphan_count;
      end if;
      execute format(
        'alter table public.%I alter column organization_id set not null',
        table_name
      );
    end if;
  end loop;
end $$;

-- Uniqueness belongs to an organization, never to the whole SaaS database.
alter table public.projetos drop constraint if exists projetos_nome_key;
drop index if exists public.idx_services_metadata_service_key;
drop index if exists public.idx_producao_origem_chave_unique;
drop index if exists public.idx_planejamento_origem_chave_unique;
alter table public.metas drop constraint if exists metas_ano_mes_key;
alter table public.metas_equipes
  drop constraint if exists metas_equipes_ano_mes_equipe_id_key;
drop index if exists public.idx_metas_atividades_global_unica;
drop index if exists public.idx_metas_atividades_equipe_unica;
drop index if exists public.idx_metas_atividades_profile_unica;
drop index if exists public.idx_insumos_codigo_unique;
drop index if exists public.idx_insumos_nome_unique;
alter table public.sync_jobs drop constraint if exists sync_jobs_tipo_dedupe_key_key;
alter table public.app_settings drop constraint if exists app_settings_pkey;
drop index if exists public.idx_alocacoes_equipe_ativa;
drop index if exists public.idx_alocacoes_maquina_ativa;

create unique index if not exists projetos_org_nome_unique
  on public.projetos (organization_id, lower(trim(nome)));
create unique index if not exists services_metadata_org_service_key_unique
  on public.services_metadata (organization_id, service_key);
create unique index if not exists producao_org_origem_chave_unique
  on public.producao (organization_id, origem_chave)
  where origem_chave is not null;
create unique index if not exists planejamento_org_origem_chave_unique
  on public.planejamento (organization_id, origem_chave)
  where origem_chave is not null;
create unique index if not exists metas_org_periodo_unique
  on public.metas (organization_id, ano, mes);
create unique index if not exists metas_equipes_org_periodo_equipe_unique
  on public.metas_equipes (organization_id, ano, mes, equipe_id);
create unique index if not exists metas_atividades_org_global_unique
  on public.metas_atividades (organization_id, ano, mes, atividade_id)
  where equipe_id is null and profile_id is null;
create unique index if not exists metas_atividades_org_equipe_unique
  on public.metas_atividades (
    organization_id, ano, mes, atividade_id, equipe_id
  ) where equipe_id is not null and profile_id is null;
create unique index if not exists metas_atividades_org_profile_unique
  on public.metas_atividades (
    organization_id, ano, mes, atividade_id, profile_id
  ) where profile_id is not null;
create unique index if not exists insumos_org_codigo_unique
  on public.insumos (organization_id, lower(trim(codigo)))
  where codigo is not null and trim(codigo) <> '';
create unique index if not exists insumos_org_nome_unique
  on public.insumos (organization_id, lower(trim(nome)));
create unique index if not exists sync_jobs_org_tipo_dedupe_unique
  on public.sync_jobs (organization_id, tipo, dedupe_key);
alter table public.app_settings
  add constraint app_settings_pkey primary key (organization_id, key);
create unique index if not exists talhoes_org_projeto_codigo_unique
  on public.talhoes (organization_id, projeto_id, lower(trim(codigo)));
create unique index if not exists alocacoes_org_equipe_ativa_unique
  on public.alocacoes_operacionais (organization_id, equipe_id)
  where equipe_id is not null and encerrado_em is null;
create unique index if not exists alocacoes_org_maquina_ativa_unique
  on public.alocacoes_operacionais (organization_id, maquina_id)
  where maquina_id is not null and encerrado_em is null;

-- A security-definer RPC still carries auth.uid(). These triggers make the
-- tenant boundary unavoidable even if an RPC forgets an organization filter.
create or replace function private.enforce_tenant_mutation_context()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  actor uuid := (select auth.uid());
  active_org uuid;
  row_org uuid;
begin
  if actor is null then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  active_org := private.current_organization_id();
  if active_org is null or not private.organization_is_accessible(active_org) then
    raise exception 'organization_access_blocked' using errcode = '42501';
  end if;

  row_org := nullif(
    (case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end)
      ->> 'organization_id',
    ''
  )::uuid;

  if row_org is distinct from active_org then
    raise exception 'cross_organization_mutation' using errcode = '42501';
  end if;

  if tg_op = 'UPDATE'
     and nullif(to_jsonb(old) ->> 'organization_id', '')::uuid
       is distinct from row_org then
    raise exception 'organization_id_is_immutable' using errcode = '42501';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function private.enforce_tenant_mutation_context()
  from public, anon, authenticated;

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
        'drop trigger if exists enforce_tenant_mutation_context on public.%I',
        table_name
      );
      execute format(
        'create trigger enforce_tenant_mutation_context before insert or update or delete on public.%I for each row execute function private.enforce_tenant_mutation_context()',
        table_name
      );
    end if;
  end loop;
end $$;

-- Validate every tenant-to-tenant and tenant-to-member relationship. This is
-- equivalent to a composite FK boundary while allowing the staged migration
-- to retain the existing single-column FK names.
create or replace function private.enforce_same_tenant_relations()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  index integer := 0;
  target_name text;
  column_name text;
  referenced_id uuid;
  row_org uuid := nullif(to_jsonb(new) ->> 'organization_id', '')::uuid;
  relation_ok boolean;
begin
  while index < tg_nargs loop
    target_name := tg_argv[index];
    column_name := tg_argv[index + 1];
    referenced_id := nullif(to_jsonb(new) ->> column_name, '')::uuid;
    index := index + 2;

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

revoke all on function private.enforce_same_tenant_relations()
  from public, anon, authenticated;

drop trigger if exists tenant_relations_equipes on public.equipes;
create trigger tenant_relations_equipes before insert or update on public.equipes
for each row execute function private.enforce_same_tenant_relations(
  '@member', 'encarregado_id'
);

drop trigger if exists tenant_relations_members on public.organization_members;
create trigger tenant_relations_members before insert or update on public.organization_members
for each row execute function private.enforce_same_tenant_relations(
  'public.equipes', 'equipe_id',
  '@member_or_platform', 'invited_by'
);

drop trigger if exists tenant_relations_invitations on public.organization_invitations;
create trigger tenant_relations_invitations before insert or update on public.organization_invitations
for each row execute function private.enforce_same_tenant_relations(
  'public.equipes', 'equipe_id',
  '@member_or_platform', 'invited_by'
);

drop trigger if exists tenant_relations_services on public.services_metadata;
create trigger tenant_relations_services before insert or update on public.services_metadata
for each row execute function private.enforce_same_tenant_relations(
  'public.atividades', 'atividade_id'
);

drop trigger if exists tenant_relations_atividades on public.atividades;
create trigger tenant_relations_atividades before insert or update on public.atividades
for each row execute function private.enforce_same_tenant_relations(
  'public.services_metadata', 'service_metadata_id'
);

drop trigger if exists tenant_relations_talhoes on public.talhoes;
create trigger tenant_relations_talhoes before insert or update on public.talhoes
for each row execute function private.enforce_same_tenant_relations(
  'public.projetos', 'projeto_id'
);

drop trigger if exists tenant_relations_producao on public.producao;
create trigger tenant_relations_producao before insert or update on public.producao
for each row execute function private.enforce_same_tenant_relations(
  'public.equipes', 'equipe_id',
  'public.atividades', 'atividade_id',
  'public.projetos', 'projeto_id',
  'public.talhoes', 'talhao_id',
  '@member', 'registrado_por',
  '@member', 'editado_por'
);

drop trigger if exists tenant_relations_planejamento on public.planejamento;
create trigger tenant_relations_planejamento before insert or update on public.planejamento
for each row execute function private.enforce_same_tenant_relations(
  'public.projetos', 'projeto_id',
  'public.atividades', 'atividade_id',
  'public.equipes', 'equipe_id',
  'public.talhoes', 'talhao_id'
);

drop trigger if exists tenant_relations_manutencoes on public.manutencoes;
create trigger tenant_relations_manutencoes before insert or update on public.manutencoes
for each row execute function private.enforce_same_tenant_relations(
  'public.maquinas', 'maquina_id',
  'public.equipes', 'equipe_id',
  'public.projetos', 'projeto_id',
  'public.talhoes', 'talhao_id',
  '@member', 'reportado_por',
  '@member', 'responsavel_id',
  '@member', 'concluido_por'
);

drop trigger if exists tenant_relations_metas_equipes on public.metas_equipes;
create trigger tenant_relations_metas_equipes before insert or update on public.metas_equipes
for each row execute function private.enforce_same_tenant_relations(
  'public.equipes', 'equipe_id'
);

drop trigger if exists tenant_relations_metas_atividades on public.metas_atividades;
create trigger tenant_relations_metas_atividades before insert or update on public.metas_atividades
for each row execute function private.enforce_same_tenant_relations(
  'public.atividades', 'atividade_id',
  'public.equipes', 'equipe_id',
  '@member', 'profile_id'
);

drop trigger if exists tenant_relations_audit on public.audit_log;
create trigger tenant_relations_audit before insert or update on public.audit_log
for each row execute function private.enforce_same_tenant_relations(
  '@member', 'usuario_id'
);

drop trigger if exists tenant_relations_sync_jobs on public.sync_jobs;
create trigger tenant_relations_sync_jobs before insert or update on public.sync_jobs
for each row execute function private.enforce_same_tenant_relations(
  'public.producao', 'producao_id'
);

drop trigger if exists tenant_relations_app_settings on public.app_settings;
create trigger tenant_relations_app_settings before insert or update on public.app_settings
for each row execute function private.enforce_same_tenant_relations(
  '@member', 'updated_by'
);

drop trigger if exists tenant_relations_insumo_movimentacoes on public.insumo_movimentacoes;
create trigger tenant_relations_insumo_movimentacoes before insert or update on public.insumo_movimentacoes
for each row execute function private.enforce_same_tenant_relations(
  'public.insumos', 'insumo_id',
  'public.producao', 'producao_id',
  '@member', 'usuario_id'
);

drop trigger if exists tenant_relations_manut_anexos on public.manutencao_anexos;
create trigger tenant_relations_manut_anexos before insert or update on public.manutencao_anexos
for each row execute function private.enforce_same_tenant_relations(
  'public.manutencoes', 'manutencao_id', '@member', 'uploaded_by'
);

drop trigger if exists tenant_relations_manut_comentarios on public.manutencao_comentarios;
create trigger tenant_relations_manut_comentarios before insert or update on public.manutencao_comentarios
for each row execute function private.enforce_same_tenant_relations(
  'public.manutencoes', 'manutencao_id', '@member', 'autor_id'
);

drop trigger if exists tenant_relations_manut_mencoes on public.manutencao_mencoes;
create trigger tenant_relations_manut_mencoes before insert or update on public.manutencao_mencoes
for each row execute function private.enforce_same_tenant_relations(
  'public.manutencoes', 'manutencao_id',
  'public.manutencao_comentarios', 'comentario_id',
  '@member', 'mentioned_profile_id',
  '@member', 'mentioned_by'
);

drop trigger if exists tenant_relations_manut_eventos on public.manutencao_eventos;
create trigger tenant_relations_manut_eventos before insert or update on public.manutencao_eventos
for each row execute function private.enforce_same_tenant_relations(
  'public.manutencoes', 'manutencao_id',
  'public.maquinas', 'maquina_id',
  '@member', 'ator_id'
);

drop trigger if exists tenant_relations_alocacoes on public.alocacoes_operacionais;
create trigger tenant_relations_alocacoes before insert or update on public.alocacoes_operacionais
for each row execute function private.enforce_same_tenant_relations(
  'public.projetos', 'projeto_id',
  'public.talhoes', 'talhao_id',
  'public.equipes', 'equipe_id',
  'public.maquinas', 'maquina_id',
  '@member', 'alocado_por'
);

-- Replace every legacy authenticated=true read policy with tenant ownership.
do $$
declare
  table_name text;
  policy_row record;
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
    if to_regclass(format('public.%I', table_name)) is null then
      continue;
    end if;
    for policy_row in
      select policyname
      from pg_policies
      where schemaname = 'public' and tablename = table_name
    loop
      execute format(
        'drop policy if exists %I on public.%I',
        policy_row.policyname,
        table_name
      );
    end loop;
    execute format('alter table public.%I enable row level security', table_name);
  end loop;
end $$;

-- Shared tenant read policies for operational tables.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'equipes', 'atividades', 'services_metadata', 'projetos', 'talhoes',
    'producao', 'planejamento', 'maquinas', 'manutencoes', 'metas',
    'metas_equipes', 'metas_atividades', 'app_settings', 'insumos',
    'manutencao_anexos', 'manutencao_comentarios', 'manutencao_mencoes',
    'manutencao_eventos', 'alocacoes_operacionais'
  ]
  loop
    execute format(
      'create policy tenant_read on public.%I for select to authenticated using (organization_id = (select private.current_organization_id()) and (select private.organization_is_accessible(organization_id)) and (select private.has_organization_role(organization_id)))',
      table_name
    );
  end loop;
end $$;

-- Catalog/configuration mutations are restricted to the customer admin.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'equipes', 'atividades', 'services_metadata', 'projetos', 'talhoes',
    'planejamento', 'maquinas', 'metas', 'metas_equipes',
    'metas_atividades', 'app_settings', 'insumos'
  ]
  loop
    execute format(
      'create policy tenant_admin_insert on public.%I for insert to authenticated with check (organization_id = (select private.current_organization_id()) and (select private.organization_is_accessible(organization_id)) and (select private.has_organization_role(organization_id, array[''admin''])))',
      table_name
    );
    execute format(
      'create policy tenant_admin_update on public.%I for update to authenticated using (organization_id = (select private.current_organization_id()) and (select private.has_organization_role(organization_id, array[''admin'']))) with check (organization_id = (select private.current_organization_id()) and (select private.organization_is_accessible(organization_id)) and (select private.has_organization_role(organization_id, array[''admin''])))',
      table_name
    );
    execute format(
      'create policy tenant_admin_delete on public.%I for delete to authenticated using (organization_id = (select private.current_organization_id()) and (select private.organization_is_accessible(organization_id)) and (select private.has_organization_role(organization_id, array[''admin''])))',
      table_name
    );
  end loop;
end $$;

create policy producao_tenant_insert on public.producao
for insert to authenticated
with check (
  organization_id = (select private.current_organization_id())
  and (select private.organization_is_accessible(organization_id))
  and registrado_por = (select auth.uid())
  and (select private.has_organization_role(organization_id))
);

create policy producao_tenant_update on public.producao
for update to authenticated
using (
  organization_id = (select private.current_organization_id())
  and (
    registrado_por = (select auth.uid())
    or (select private.has_organization_role(organization_id, array['admin']))
  )
)
with check (
  organization_id = (select private.current_organization_id())
  and (select private.organization_is_accessible(organization_id))
  and (
    registrado_por = (select auth.uid())
    or (select private.has_organization_role(organization_id, array['admin']))
  )
);

create policy producao_tenant_delete on public.producao
for delete to authenticated
using (
  organization_id = (select private.current_organization_id())
  and (select private.organization_is_accessible(organization_id))
  and (select private.has_organization_role(organization_id, array['admin']))
);

create policy manutencoes_tenant_insert on public.manutencoes
for insert to authenticated
with check (
  organization_id = (select private.current_organization_id())
  and (select private.organization_is_accessible(organization_id))
  and reportado_por = (select auth.uid())
  and (select private.has_organization_role(
    organization_id,
    array['admin', 'gestor', 'encarregado']
  ))
);

create policy manut_anexos_tenant_insert on public.manutencao_anexos
for insert to authenticated
with check (
  organization_id = (select private.current_organization_id())
  and uploaded_by = (select auth.uid())
  and (select private.organization_is_accessible(organization_id))
  and (select private.has_organization_role(organization_id))
);

create policy manut_comentarios_tenant_insert on public.manutencao_comentarios
for insert to authenticated
with check (
  organization_id = (select private.current_organization_id())
  and autor_id = (select auth.uid())
  and (select private.organization_is_accessible(organization_id))
  and private.can_comment_on_maintenance(manutencao_id, (select auth.uid()))
);

create policy manut_comentarios_tenant_update on public.manutencao_comentarios
for update to authenticated
using (
  organization_id = (select private.current_organization_id())
  and autor_id = (select auth.uid())
)
with check (
  organization_id = (select private.current_organization_id())
  and autor_id = (select auth.uid())
  and (select private.organization_is_accessible(organization_id))
);

create policy manut_mencoes_tenant_insert on public.manutencao_mencoes
for insert to authenticated
with check (
  organization_id = (select private.current_organization_id())
  and mentioned_by = (select auth.uid())
  and (select private.organization_is_accessible(organization_id))
  and private.can_comment_on_maintenance(manutencao_id, (select auth.uid()))
);

create policy manut_mencoes_tenant_update on public.manutencao_mencoes
for update to authenticated
using (
  organization_id = (select private.current_organization_id())
  and mentioned_profile_id = (select auth.uid())
)
with check (
  organization_id = (select private.current_organization_id())
  and mentioned_profile_id = (select auth.uid())
);

create policy alocacoes_tenant_insert on public.alocacoes_operacionais
for insert to authenticated
with check (
  organization_id = (select private.current_organization_id())
  and alocado_por = (select auth.uid())
  and (select private.organization_is_accessible(organization_id))
  and (select private.has_organization_role(organization_id, array['admin', 'gestor']))
);

create policy alocacoes_tenant_update on public.alocacoes_operacionais
for update to authenticated
using (
  organization_id = (select private.current_organization_id())
  and (select private.has_organization_role(organization_id, array['admin', 'gestor']))
)
with check (
  organization_id = (select private.current_organization_id())
  and (select private.organization_is_accessible(organization_id))
  and (select private.has_organization_role(organization_id, array['admin', 'gestor']))
);

create policy audit_tenant_read on public.audit_log
for select to authenticated
using (
  organization_id = (select private.current_organization_id())
  and (select private.organization_is_accessible(organization_id))
  and (select private.has_organization_role(organization_id, array['admin', 'gestor']))
);

create policy sync_jobs_tenant_admin_read on public.sync_jobs
for select to authenticated
using (
  organization_id = (select private.current_organization_id())
  and (select private.organization_is_accessible(organization_id))
  and (select private.has_organization_role(organization_id, array['admin']))
);

create policy insumo_movimentacoes_tenant_admin_read on public.insumo_movimentacoes
for select to authenticated
using (
  organization_id = (select private.current_organization_id())
  and (select private.organization_is_accessible(organization_id))
  and (select private.has_organization_role(organization_id, array['admin']))
);

-- Profiles are global identities. A member can only discover identities that
-- share the active organization (plus their own row).
do $$
declare policy_row record;
begin
  for policy_row in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'profiles'
  loop
    execute format('drop policy if exists %I on public.profiles', policy_row.policyname);
  end loop;
end $$;

create policy profiles_same_tenant_read on public.profiles
for select to authenticated
using (
  id = (select auth.uid())
  or exists (
    select 1
    from public.organization_members target_membership
    where target_membership.user_id = profiles.id
      and target_membership.organization_id = (select private.current_organization_id())
  )
);

-- Direct profile writes remain server-only. Customer admins mutate the
-- membership role/team through authenticated server endpoints.
revoke insert, update, delete on public.profiles from authenticated;

-- Storage objects are isolated by organization. Legacy GN paths remain
-- readable only when they are referenced by a GN attachment row.
drop policy if exists manutencao_fotos_select on storage.objects;
drop policy if exists manutencao_fotos_insert_own_folder on storage.objects;
drop policy if exists manutencao_fotos_admin_delete on storage.objects;

create policy manutencao_fotos_tenant_select on storage.objects
for select to authenticated
using (
  bucket_id = 'manutencao-fotos'
  and (
    (storage.foldername(name))[1] = (select private.current_organization_id())::text
    or exists (
      select 1
      from public.manutencao_anexos a
      where a.storage_path = name
        and a.organization_id = (select private.current_organization_id())
    )
  )
  and (select private.organization_is_accessible(
    (select private.current_organization_id())
  ))
);

create policy manutencao_fotos_tenant_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'manutencao-fotos'
  and (storage.foldername(name))[1] = (select private.current_organization_id())::text
  and (storage.foldername(name))[2] = (select auth.uid())::text
  and (select private.organization_is_accessible(
    (select private.current_organization_id())
  ))
);

create policy manutencao_fotos_tenant_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'manutencao-fotos'
  and (
    (storage.foldername(name))[1] = (select private.current_organization_id())::text
    or exists (
      select 1
      from public.manutencao_anexos a
      where a.storage_path = name
        and a.organization_id = (select private.current_organization_id())
    )
  )
  and (select private.has_organization_role(
    (select private.current_organization_id()),
    array['admin']
  ))
);

-- The stock validation helper is security definer, so it must filter before
-- locking or returning stock details.
create or replace function public.validate_and_lock_insumos(p_insumos jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_item record;
  v_raw jsonb;
  v_insumo public.insumos;
  v_normalized jsonb := '[]'::jsonb;
  v_organization_id uuid := private.current_organization_id();
begin
  if p_insumos is not null and jsonb_typeof(p_insumos) <> 'array' then
    raise exception 'Formato de insumos inválido.' using errcode = '22023';
  end if;
  if jsonb_array_length(coalesce(p_insumos, '[]'::jsonb)) > 6 then
    raise exception 'Cada apontamento aceita no máximo 6 insumos.' using errcode = '22023';
  end if;

  if v_organization_id is null
     or not private.organization_is_accessible(v_organization_id) then
    raise exception 'organization_access_blocked' using errcode = '42501';
  end if;

  for v_raw in
    select value from jsonb_array_elements(coalesce(p_insumos, '[]'::jsonb)) value
  loop
    if nullif(v_raw ->> 'quantidade', '') is null then continue; end if;
    if nullif(coalesce(v_raw ->> 'insumo_id', v_raw ->> 'id'), '') is null then
      raise exception 'Selecione apenas insumos cadastrados no estoque.'
        using errcode = '22023';
    end if;
    if (v_raw ->> 'quantidade')::numeric <= 0 then
      raise exception 'Quantidade de insumo inválida.' using errcode = '22023';
    end if;
  end loop;

  for v_item in
    select
      coalesce(value ->> 'insumo_id', value ->> 'id')::uuid insumo_id,
      sum((value ->> 'quantidade')::numeric)::numeric(14,3) quantidade
    from jsonb_array_elements(coalesce(p_insumos, '[]'::jsonb)) value
    where nullif(coalesce(value ->> 'insumo_id', value ->> 'id'), '') is not null
      and nullif(value ->> 'quantidade', '') is not null
    group by coalesce(value ->> 'insumo_id', value ->> 'id')::uuid
  loop
    select * into v_insumo
    from public.insumos
    where id = v_item.insumo_id
      and organization_id = v_organization_id
    for update;

    if not found or v_insumo.ativo is false then
      raise exception 'Insumo inválido ou inativo.' using errcode = '22023';
    end if;
    if v_insumo.saldo_atual < v_item.quantidade then
      raise exception 'Estoque insuficiente para %: disponível %, solicitado %.',
        v_insumo.nome, v_insumo.saldo_atual, v_item.quantidade
        using errcode = '22023';
    end if;

    v_normalized := v_normalized || jsonb_build_array(jsonb_build_object(
      'insumo_id', v_insumo.id,
      'codigo', v_insumo.codigo,
      'nome', v_insumo.nome,
      'unidade', v_insumo.unidade,
      'quantidade', v_item.quantidade
    ));
  end loop;

  return v_normalized;
end;
$$;

revoke all on function public.validate_and_lock_insumos(jsonb)
  from public, anon, authenticated;

-- Explicit Data API grants for current and future Supabase defaults.
revoke all on public.profiles, public.equipes, public.atividades,
  public.services_metadata, public.projetos, public.talhoes,
  public.producao, public.planejamento, public.maquinas, public.manutencoes,
  public.metas, public.metas_equipes, public.metas_atividades,
  public.app_settings, public.insumos, public.insumo_movimentacoes,
  public.audit_log, public.sync_jobs, public.manutencao_anexos,
  public.manutencao_comentarios, public.manutencao_mencoes,
  public.manutencao_eventos, public.alocacoes_operacionais
from anon;

grant select on public.profiles to authenticated;
grant select on public.organizations, public.organization_members,
  public.organization_settings to authenticated;
grant select, insert, update, delete on public.equipes, public.atividades,
  public.services_metadata, public.projetos, public.talhoes,
  public.producao, public.planejamento, public.maquinas, public.manutencoes,
  public.metas, public.metas_equipes, public.metas_atividades,
  public.app_settings, public.insumos, public.manutencao_anexos,
  public.manutencao_comentarios, public.manutencao_mencoes,
  public.alocacoes_operacionais to authenticated;
grant select on public.audit_log, public.sync_jobs,
  public.insumo_movimentacoes, public.manutencao_eventos to authenticated;

revoke all on public.organization_invitations,
  public.organization_integrations from anon, authenticated;
grant all on public.organization_invitations,
  public.organization_integrations to service_role;

commit;

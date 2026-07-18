-- Operational maintenance workspace: role, workflow, social thread and audit trail.

alter type public.user_role add value if not exists 'manutencao';

do $$
begin
  create type public.maintenance_priority as enum ('normal', 'alta', 'urgente');
exception
  when duplicate_object then null;
end;
$$;

alter table public.manutencoes
  add column if not exists prioridade public.maintenance_priority not null default 'normal',
  add column if not exists responsavel_id uuid references public.profiles(id) on delete set null,
  add column if not exists iniciado_em timestamptz,
  add column if not exists concluido_por uuid references public.profiles(id) on delete set null,
  add column if not exists relato_conclusao text;

create index if not exists idx_manutencoes_fila
  on public.manutencoes (status, prioridade, created_at);
create index if not exists idx_manutencoes_responsavel
  on public.manutencoes (responsavel_id, status);
create index if not exists idx_manutencoes_concluido_por
  on public.manutencoes (concluido_por);

-- The social tables existed as a legacy SQL script but were not in managed
-- migrations. Keep their creation idempotent for projects where it was run.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'manutencao-fotos',
  'manutencao-fotos',
  false,
  6291456,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.manutencao_anexos (
  id uuid primary key default gen_random_uuid(),
  manutencao_id uuid not null references public.manutencoes(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null,
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 6291456),
  uploaded_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.manutencao_comentarios (
  id uuid primary key default gen_random_uuid(),
  manutencao_id uuid not null references public.manutencoes(id) on delete cascade,
  autor_id uuid not null references public.profiles(id),
  texto text not null check (char_length(trim(texto)) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.manutencao_mencoes (
  id uuid primary key default gen_random_uuid(),
  manutencao_id uuid not null references public.manutencoes(id) on delete cascade,
  comentario_id uuid references public.manutencao_comentarios(id) on delete cascade,
  mentioned_profile_id uuid not null references public.profiles(id),
  mentioned_by uuid not null references public.profiles(id),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.manutencao_eventos (
  id uuid primary key default gen_random_uuid(),
  manutencao_id uuid references public.manutencoes(id) on delete cascade,
  maquina_id uuid not null references public.maquinas(id) on delete cascade,
  tipo text not null check (tipo in (
    'criado', 'atribuido', 'iniciado', 'prioridade_alterada',
    'concluido', 'status_maquina_alterado'
  )),
  ator_id uuid references public.profiles(id) on delete set null,
  dados jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_manut_anexos_manutencao
  on public.manutencao_anexos (manutencao_id, created_at);
create index if not exists idx_manut_anexos_uploaded_by
  on public.manutencao_anexos (uploaded_by);
create index if not exists idx_manut_comentarios_manutencao
  on public.manutencao_comentarios (manutencao_id, created_at);
create index if not exists idx_manut_comentarios_autor
  on public.manutencao_comentarios (autor_id);
create index if not exists idx_manut_mencoes_manutencao
  on public.manutencao_mencoes (manutencao_id, created_at);
create index if not exists idx_manut_mencoes_mentioned_by
  on public.manutencao_mencoes (mentioned_by);
create index if not exists idx_manut_mencoes_profile_unread
  on public.manutencao_mencoes (mentioned_profile_id, read_at)
  where read_at is null;
create unique index if not exists idx_manut_mencoes_pedido_unique
  on public.manutencao_mencoes (manutencao_id, mentioned_profile_id)
  where comentario_id is null;
create unique index if not exists idx_manut_mencoes_comentario_unique
  on public.manutencao_mencoes (comentario_id, mentioned_profile_id)
  where comentario_id is not null;
create index if not exists idx_manut_eventos_manutencao
  on public.manutencao_eventos (manutencao_id, created_at);
create index if not exists idx_manut_eventos_maquina
  on public.manutencao_eventos (maquina_id, created_at desc);
create index if not exists idx_manut_eventos_ator
  on public.manutencao_eventos (ator_id);

create or replace function public.touch_manutencao_comentario()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch_manutencao_comentario on public.manutencao_comentarios;
create trigger trg_touch_manutencao_comentario
before update on public.manutencao_comentarios
for each row execute function public.touch_manutencao_comentario();

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

create or replace function private.can_comment_on_maintenance(
  p_manutencao_id uuid,
  p_profile_id uuid
) returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_role text;
begin
  if p_profile_id is null or p_profile_id <> auth.uid() then
    return false;
  end if;

  select role::text into v_role
  from public.profiles
  where id = p_profile_id and ativo is true;

  if v_role in ('admin', 'gestor', 'manutencao') then
    return true;
  end if;

  return exists (
    select 1 from public.manutencoes
    where id = p_manutencao_id and reportado_por = p_profile_id
  ) or exists (
    select 1 from public.manutencao_mencoes
    where manutencao_id = p_manutencao_id
      and mentioned_profile_id = p_profile_id
  ) or exists (
    select 1 from public.manutencao_comentarios
    where manutencao_id = p_manutencao_id
      and autor_id = p_profile_id
      and deleted_at is null
  );
end;
$$;

create or replace function public.record_new_maintenance_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.manutencao_eventos (
    manutencao_id, maquina_id, tipo, ator_id, dados
  ) values (
    new.id,
    new.maquina_id,
    'criado',
    new.reportado_por,
    jsonb_build_object('status', new.status)
  );
  return new;
end;
$$;

drop trigger if exists trg_record_new_maintenance_event on public.manutencoes;
create trigger trg_record_new_maintenance_event
after insert on public.manutencoes
for each row execute function public.record_new_maintenance_event();

create or replace function public.record_machine_status_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.status is distinct from new.status and auth.uid() is not null then
    insert into public.manutencao_eventos (
      manutencao_id, maquina_id, tipo, ator_id, dados
    ) values (
      null,
      new.id,
      'status_maquina_alterado',
      auth.uid(),
      jsonb_build_object('anterior', old.status, 'novo', new.status)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_record_machine_status_event on public.maquinas;
create trigger trg_record_machine_status_event
after update of status on public.maquinas
for each row execute function public.record_machine_status_event();

create or replace function public.maintenance_action(
  p_manutencao_id uuid,
  p_action text,
  p_responsavel_id uuid default null,
  p_prioridade public.maintenance_priority default null,
  p_relato_conclusao text default null,
  p_machine_status public.machine_status default null
) returns public.manutencoes
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_role text;
  v_manut public.manutencoes;
  v_responsavel_nome text;
begin
  if v_actor is null then
    raise exception 'unauthenticated';
  end if;

  select role::text into v_role
  from public.profiles
  where id = v_actor and ativo is true;

  if v_role not in ('admin', 'manutencao') then
    raise exception 'forbidden';
  end if;

  select * into v_manut
  from public.manutencoes
  where id = p_manutencao_id
  for update;

  if v_manut.id is null then
    raise exception 'maintenance_not_found';
  end if;

  if p_action = 'priorizar' then
    if v_manut.status = 'resolvido' or p_prioridade is null then
      raise exception 'invalid_priority_change';
    end if;
    update public.manutencoes set prioridade = p_prioridade
    where id = p_manutencao_id returning * into v_manut;
    insert into public.manutencao_eventos (manutencao_id, maquina_id, tipo, ator_id, dados)
    values (v_manut.id, v_manut.maquina_id, 'prioridade_alterada', v_actor,
      jsonb_build_object('prioridade', p_prioridade));

  elsif p_action = 'atribuir' then
    if v_manut.status = 'resolvido' or p_responsavel_id is null then
      raise exception 'invalid_assignment';
    end if;
    select nome into v_responsavel_nome from public.profiles
    where id = p_responsavel_id and ativo is true and role::text = 'manutencao';
    if v_responsavel_nome is null then
      raise exception 'invalid_technician';
    end if;
    update public.manutencoes set responsavel_id = p_responsavel_id
    where id = p_manutencao_id returning * into v_manut;
    insert into public.manutencao_eventos (manutencao_id, maquina_id, tipo, ator_id, dados)
    values (v_manut.id, v_manut.maquina_id, 'atribuido', v_actor,
      jsonb_build_object('responsavel_id', p_responsavel_id, 'responsavel_nome', v_responsavel_nome));

  elsif p_action = 'assumir' then
    if v_role <> 'manutencao' or v_manut.status = 'resolvido' then
      raise exception 'invalid_claim';
    end if;
    update public.manutencoes
    set responsavel_id = v_actor,
        status = 'em_andamento',
        iniciado_em = coalesce(iniciado_em, now())
    where id = p_manutencao_id returning * into v_manut;
    insert into public.manutencao_eventos (manutencao_id, maquina_id, tipo, ator_id, dados)
    values (v_manut.id, v_manut.maquina_id, 'atribuido', v_actor,
      jsonb_build_object('responsavel_id', v_actor));
    insert into public.manutencao_eventos (manutencao_id, maquina_id, tipo, ator_id, dados)
    values (v_manut.id, v_manut.maquina_id, 'iniciado', v_actor, '{}'::jsonb);

  elsif p_action = 'iniciar' then
    if v_manut.status <> 'aberto' or v_manut.responsavel_id is null then
      raise exception 'invalid_start';
    end if;
    if v_role = 'manutencao' and v_manut.responsavel_id <> v_actor then
      raise exception 'not_assigned_technician';
    end if;
    update public.manutencoes
    set status = 'em_andamento', iniciado_em = coalesce(iniciado_em, now())
    where id = p_manutencao_id returning * into v_manut;
    insert into public.manutencao_eventos (manutencao_id, maquina_id, tipo, ator_id, dados)
    values (v_manut.id, v_manut.maquina_id, 'iniciado', v_actor, '{}'::jsonb);

  elsif p_action = 'concluir' then
    if v_manut.status <> 'em_andamento'
      or char_length(trim(coalesce(p_relato_conclusao, ''))) < 3
      or p_machine_status is null then
      raise exception 'invalid_completion';
    end if;
    if v_role = 'manutencao' and v_manut.responsavel_id <> v_actor then
      raise exception 'not_assigned_technician';
    end if;
    update public.manutencoes
    set status = 'resolvido',
        resolvido_em = now(),
        concluido_por = v_actor,
        relato_conclusao = trim(p_relato_conclusao)
    where id = p_manutencao_id returning * into v_manut;
    insert into public.manutencao_eventos (manutencao_id, maquina_id, tipo, ator_id, dados)
    values (v_manut.id, v_manut.maquina_id, 'concluido', v_actor,
      jsonb_build_object('status_maquina', p_machine_status));
    update public.maquinas set status = p_machine_status
    where id = v_manut.maquina_id;

  else
    raise exception 'invalid_action';
  end if;

  return v_manut;
end;
$$;

create or replace function public.set_machine_status(
  p_maquina_id uuid,
  p_status public.machine_status
) returns public.maquinas
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role text;
  v_maquina public.maquinas;
begin
  if auth.uid() is null then
    raise exception 'unauthenticated';
  end if;

  select role::text into v_role from public.profiles
  where id = auth.uid() and ativo is true;
  if v_role not in ('admin', 'encarregado', 'gestor', 'manutencao') then
    raise exception 'forbidden';
  end if;

  update public.maquinas set status = p_status
  where id = p_maquina_id returning * into v_maquina;
  if v_maquina.id is null then
    raise exception 'machine_not_found';
  end if;
  return v_maquina;
end;
$$;

alter table public.manutencao_anexos enable row level security;
alter table public.manutencao_comentarios enable row level security;
alter table public.manutencao_mencoes enable row level security;
alter table public.manutencao_eventos enable row level security;

grant select, insert on public.manutencao_anexos to authenticated;
grant select, insert, update on public.manutencao_comentarios to authenticated;
grant select, insert on public.manutencao_mencoes to authenticated;
grant update(read_at) on public.manutencao_mencoes to authenticated;
grant select on public.manutencao_eventos to authenticated;
grant all on public.manutencao_anexos, public.manutencao_comentarios,
  public.manutencao_mencoes, public.manutencao_eventos to service_role;

drop policy if exists manut_anexos_read on public.manutencao_anexos;
create policy manut_anexos_read on public.manutencao_anexos
  for select to authenticated using ((select auth.uid()) is not null);
drop policy if exists manut_anexos_insert_author on public.manutencao_anexos;
create policy manut_anexos_insert_author on public.manutencao_anexos
  for insert to authenticated with check (
    uploaded_by = (select auth.uid())
    and exists (select 1 from public.manutencoes m
      where m.id = manutencao_id and m.reportado_por = (select auth.uid()))
  );

drop policy if exists manut_comentarios_read on public.manutencao_comentarios;
create policy manut_comentarios_read on public.manutencao_comentarios
  for select to authenticated using ((select auth.uid()) is not null);
drop policy if exists manut_comentarios_insert_involved on public.manutencao_comentarios;
create policy manut_comentarios_insert_involved on public.manutencao_comentarios
  for insert to authenticated with check (
    autor_id = (select auth.uid())
    and private.can_comment_on_maintenance(manutencao_id, (select auth.uid()))
  );
drop policy if exists manut_comentarios_update_own on public.manutencao_comentarios;
create policy manut_comentarios_update_own on public.manutencao_comentarios
  for update to authenticated
  using (autor_id = (select auth.uid()))
  with check (autor_id = (select auth.uid()));

drop policy if exists manut_mencoes_read on public.manutencao_mencoes;
create policy manut_mencoes_read on public.manutencao_mencoes
  for select to authenticated using ((select auth.uid()) is not null);
drop policy if exists manut_mencoes_insert_involved on public.manutencao_mencoes;
create policy manut_mencoes_insert_involved on public.manutencao_mencoes
  for insert to authenticated with check (
    mentioned_by = (select auth.uid())
    and private.can_comment_on_maintenance(manutencao_id, (select auth.uid()))
  );
drop policy if exists manut_mencoes_mark_read on public.manutencao_mencoes;
create policy manut_mencoes_mark_read on public.manutencao_mencoes
  for update to authenticated
  using (mentioned_profile_id = (select auth.uid()))
  with check (mentioned_profile_id = (select auth.uid()));

drop policy if exists manut_eventos_read on public.manutencao_eventos;
create policy manut_eventos_read on public.manutencao_eventos
  for select to authenticated using ((select auth.uid()) is not null);

drop policy if exists manutencao_fotos_select on storage.objects;
create policy manutencao_fotos_select on storage.objects
  for select to authenticated using (bucket_id = 'manutencao-fotos');
drop policy if exists manutencao_fotos_insert_own_folder on storage.objects;
create policy manutencao_fotos_insert_own_folder on storage.objects
  for insert to authenticated with check (
    bucket_id = 'manutencao-fotos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
drop policy if exists manutencao_fotos_admin_delete on storage.objects;
create policy manutencao_fotos_admin_delete on storage.objects
  for delete to authenticated using (
    bucket_id = 'manutencao-fotos'
    and (select public.current_role())::text = 'admin'
  );

-- Direct table writes cannot bypass the workflow RPC.
drop policy if exists manut_update on public.manutencoes;
drop policy if exists manut_insert on public.manutencoes;
create policy manut_insert on public.manutencoes
  for insert to authenticated
  with check (
    reportado_por = (select auth.uid())
    and coalesce((select public.current_role())::text, '') <> 'manutencao'
  );

revoke all on function public.touch_manutencao_comentario() from public, anon, authenticated;
revoke all on function public.record_new_maintenance_event() from public, anon, authenticated;
revoke all on function public.record_machine_status_event() from public, anon, authenticated;
revoke all on function private.can_comment_on_maintenance(uuid, uuid) from public, anon;
revoke all on function public.maintenance_action(uuid, text, uuid, public.maintenance_priority, text, public.machine_status) from public, anon;
revoke all on function public.set_machine_status(uuid, public.machine_status) from public, anon;
revoke all on function public.resolve_maintenance(uuid, public.machine_status) from public, anon, authenticated;

grant execute on function private.can_comment_on_maintenance(uuid, uuid)
  to authenticated, service_role;
grant execute on function public.maintenance_action(uuid, text, uuid, public.maintenance_priority, text, public.machine_status)
  to authenticated, service_role;
grant execute on function public.set_machine_status(uuid, public.machine_status)
  to authenticated, service_role;
grant execute on function public.resolve_maintenance(uuid, public.machine_status)
  to service_role;

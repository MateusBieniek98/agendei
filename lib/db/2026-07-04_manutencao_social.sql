-- Aba Manutencao Social
-- Feed compartilhado com fotos, comentarios e mencoes.

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
  id             uuid primary key default gen_random_uuid(),
  manutencao_id  uuid not null references public.manutencoes(id) on delete cascade,
  storage_path   text not null unique,
  file_name      text not null,
  mime_type      text not null,
  size_bytes     integer not null check (size_bytes > 0 and size_bytes <= 6291456),
  uploaded_by    uuid not null references public.profiles(id),
  created_at     timestamptz not null default now()
);

create table if not exists public.manutencao_comentarios (
  id             uuid primary key default gen_random_uuid(),
  manutencao_id  uuid not null references public.manutencoes(id) on delete cascade,
  autor_id       uuid not null references public.profiles(id),
  texto          text not null check (char_length(trim(texto)) between 1 and 2000),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz
);

create table if not exists public.manutencao_mencoes (
  id                   uuid primary key default gen_random_uuid(),
  manutencao_id        uuid not null references public.manutencoes(id) on delete cascade,
  comentario_id        uuid references public.manutencao_comentarios(id) on delete cascade,
  mentioned_profile_id uuid not null references public.profiles(id),
  mentioned_by         uuid not null references public.profiles(id),
  read_at              timestamptz,
  created_at           timestamptz not null default now()
);

create index if not exists idx_manut_anexos_manutencao
  on public.manutencao_anexos(manutencao_id, created_at);
create index if not exists idx_manut_comentarios_manutencao
  on public.manutencao_comentarios(manutencao_id, created_at);
create index if not exists idx_manut_mencoes_manutencao
  on public.manutencao_mencoes(manutencao_id, created_at);
create index if not exists idx_manut_mencoes_profile_unread
  on public.manutencao_mencoes(mentioned_profile_id, read_at)
  where read_at is null;
create unique index if not exists idx_manut_mencoes_pedido_unique
  on public.manutencao_mencoes(manutencao_id, mentioned_profile_id)
  where comentario_id is null;
create unique index if not exists idx_manut_mencoes_comentario_unique
  on public.manutencao_mencoes(comentario_id, mentioned_profile_id)
  where comentario_id is not null;

create or replace function public.touch_manutencao_comentario()
returns trigger
language plpgsql
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

create or replace function public.can_comment_on_maintenance(
  p_manutencao_id uuid,
  p_profile_id uuid
) returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role public.user_role;
begin
  if p_profile_id is null or p_profile_id <> auth.uid() then
    return false;
  end if;

  select role into v_role
  from public.profiles
  where id = p_profile_id and ativo is true;

  if v_role in ('admin', 'gestor') then
    return true;
  end if;

  if exists (
    select 1
    from public.manutencoes
    where id = p_manutencao_id
      and reportado_por = p_profile_id
  ) then
    return true;
  end if;

  if exists (
    select 1
    from public.manutencao_mencoes
    where manutencao_id = p_manutencao_id
      and mentioned_profile_id = p_profile_id
  ) then
    return true;
  end if;

  if exists (
    select 1
    from public.manutencao_comentarios
    where manutencao_id = p_manutencao_id
      and autor_id = p_profile_id
      and deleted_at is null
  ) then
    return true;
  end if;

  return false;
end;
$$;

revoke all on function public.touch_manutencao_comentario() from public;
grant execute on function public.touch_manutencao_comentario() to authenticated, service_role;
revoke all on function public.can_comment_on_maintenance(uuid, uuid) from public;
grant execute on function public.can_comment_on_maintenance(uuid, uuid) to authenticated, service_role;

alter table public.manutencao_anexos enable row level security;
alter table public.manutencao_comentarios enable row level security;
alter table public.manutencao_mencoes enable row level security;

grant select, insert on public.manutencao_anexos to authenticated;
grant select, insert, update on public.manutencao_comentarios to authenticated;
grant select, insert on public.manutencao_mencoes to authenticated;
grant update(read_at) on public.manutencao_mencoes to authenticated;

drop policy if exists manut_anexos_read on public.manutencao_anexos;
create policy manut_anexos_read on public.manutencao_anexos
  for select to authenticated
  using ((select auth.uid()) is not null);

drop policy if exists manut_anexos_insert_author on public.manutencao_anexos;
create policy manut_anexos_insert_author on public.manutencao_anexos
  for insert to authenticated
  with check (
    uploaded_by = (select auth.uid())
    and exists (
      select 1 from public.manutencoes m
      where m.id = manutencao_id
        and m.reportado_por = (select auth.uid())
    )
  );

drop policy if exists manut_comentarios_read on public.manutencao_comentarios;
create policy manut_comentarios_read on public.manutencao_comentarios
  for select to authenticated
  using ((select auth.uid()) is not null);

drop policy if exists manut_comentarios_insert_involved on public.manutencao_comentarios;
create policy manut_comentarios_insert_involved on public.manutencao_comentarios
  for insert to authenticated
  with check (
    autor_id = (select auth.uid())
    and public.can_comment_on_maintenance(manutencao_id, (select auth.uid()))
  );

drop policy if exists manut_comentarios_update_own on public.manutencao_comentarios;
create policy manut_comentarios_update_own on public.manutencao_comentarios
  for update to authenticated
  using (autor_id = (select auth.uid()))
  with check (autor_id = (select auth.uid()));

drop policy if exists manut_mencoes_read on public.manutencao_mencoes;
create policy manut_mencoes_read on public.manutencao_mencoes
  for select to authenticated
  using ((select auth.uid()) is not null);

drop policy if exists manut_mencoes_insert_involved on public.manutencao_mencoes;
create policy manut_mencoes_insert_involved on public.manutencao_mencoes
  for insert to authenticated
  with check (
    mentioned_by = (select auth.uid())
    and public.can_comment_on_maintenance(manutencao_id, (select auth.uid()))
  );

drop policy if exists manut_mencoes_mark_read on public.manutencao_mencoes;
create policy manut_mencoes_mark_read on public.manutencao_mencoes
  for update to authenticated
  using (mentioned_profile_id = (select auth.uid()))
  with check (mentioned_profile_id = (select auth.uid()));

drop policy if exists manutencao_fotos_select on storage.objects;
create policy manutencao_fotos_select on storage.objects
  for select to authenticated
  using (bucket_id = 'manutencao-fotos');

drop policy if exists manutencao_fotos_insert_own_folder on storage.objects;
create policy manutencao_fotos_insert_own_folder on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'manutencao-fotos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists manutencao_fotos_admin_delete on storage.objects;
create policy manutencao_fotos_admin_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'manutencao-fotos'
    and public.current_role() = 'admin'
  );

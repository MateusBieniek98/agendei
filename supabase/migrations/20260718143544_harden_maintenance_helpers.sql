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

revoke all on function private.can_comment_on_maintenance(uuid, uuid) from public, anon;
grant execute on function private.can_comment_on_maintenance(uuid, uuid)
  to authenticated, service_role;

drop policy if exists manut_comentarios_insert_involved on public.manutencao_comentarios;
create policy manut_comentarios_insert_involved on public.manutencao_comentarios
  for insert to authenticated with check (
    autor_id = (select auth.uid())
    and private.can_comment_on_maintenance(manutencao_id, (select auth.uid()))
  );

drop policy if exists manut_mencoes_insert_involved on public.manutencao_mencoes;
create policy manut_mencoes_insert_involved on public.manutencao_mencoes
  for insert to authenticated with check (
    mentioned_by = (select auth.uid())
    and private.can_comment_on_maintenance(manutencao_id, (select auth.uid()))
  );

drop function if exists public.can_comment_on_maintenance(uuid, uuid);

create index if not exists idx_manut_anexos_uploaded_by
  on public.manutencao_anexos (uploaded_by);
create index if not exists idx_manut_comentarios_autor
  on public.manutencao_comentarios (autor_id);
create index if not exists idx_manut_mencoes_mentioned_by
  on public.manutencao_mencoes (mentioned_by);

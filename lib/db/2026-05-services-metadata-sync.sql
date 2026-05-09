-- GN · Fonte Unica de Verdade para serviços/atividades
-- Rode este arquivo no SQL Editor do Supabase. Ele é idempotente.

create extension if not exists pgcrypto;
create extension if not exists unaccent;

create table if not exists public.services_metadata (
  id                 uuid primary key default gen_random_uuid(),
  service_key        text not null,
  slug               text not null,
  display_name       text not null,
  canonical_name     text not null,
  operation_code     text,
  operation_name     text,
  unidade            text not null default 'ha',
  escala_rendimento  text,
  valor_unitario     numeric(12,4) not null default 0 check (valor_unitario >= 0),
  atividade_id       uuid references public.atividades(id) on delete set null,
  aliases            text[] not null default '{}'::text[],
  source_spreadsheet text,
  source_sheet       text,
  source_row         int,
  metadata           jsonb not null default '{}'::jsonb,
  ativo              boolean not null default true,
  last_synced_at     timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create unique index if not exists idx_services_metadata_service_key
  on public.services_metadata(service_key);
drop index if exists public.idx_services_metadata_slug;
create index if not exists idx_services_metadata_slug
  on public.services_metadata(slug);
create index if not exists idx_services_metadata_display_name
  on public.services_metadata(display_name);
create index if not exists idx_services_metadata_atividade
  on public.services_metadata(atividade_id);

alter table public.atividades
  add column if not exists service_key text,
  add column if not exists service_metadata_id uuid references public.services_metadata(id) on delete set null;
create index if not exists idx_atividades_service_key on public.atividades(service_key);
create index if not exists idx_atividades_service_metadata on public.atividades(service_metadata_id);

with atividades_source as (
  select distinct on (service_key)
    a.id,
    a.nome,
    a.unidade,
    a.valor_unitario,
    coalesce(
      nullif(a.service_key, ''),
      'srv-' || coalesce(nullif(trim(both '-' from regexp_replace(lower(unaccent(a.nome)), '[^a-z0-9]+', '-', 'g')), ''), a.id::text)
    ) as service_key
  from public.atividades a
  order by
    coalesce(
      nullif(a.service_key, ''),
      'srv-' || coalesce(nullif(trim(both '-' from regexp_replace(lower(unaccent(a.nome)), '[^a-z0-9]+', '-', 'g')), ''), a.id::text)
    ),
    a.created_at,
    a.id
)
insert into public.services_metadata (
  service_key,
  slug,
  display_name,
  canonical_name,
  unidade,
  valor_unitario,
  atividade_id,
  aliases,
  source_sheet,
  last_synced_at
)
select
  service_key,
  left(service_key, 120),
  nome,
  nome,
  unidade,
  valor_unitario,
  id,
  array[nome],
  'backfill_atividades',
  now()
from atividades_source
on conflict (service_key) do update
set
  display_name = excluded.display_name,
  canonical_name = excluded.canonical_name,
  unidade = excluded.unidade,
  valor_unitario = excluded.valor_unitario,
  atividade_id = coalesce(public.services_metadata.atividade_id, excluded.atividade_id),
  aliases = array(
    select distinct alias
    from unnest(coalesce(public.services_metadata.aliases, '{}'::text[]) || excluded.aliases) as alias
    where nullif(trim(alias), '') is not null
  ),
  last_synced_at = now();

update public.atividades a
set
  service_key = s.service_key,
  service_metadata_id = sm.id
from (
  select
    id,
    coalesce(
      nullif(service_key, ''),
      'srv-' || coalesce(nullif(trim(both '-' from regexp_replace(lower(unaccent(nome)), '[^a-z0-9]+', '-', 'g')), ''), id::text)
    ) as service_key
  from public.atividades
) s
join public.services_metadata sm on sm.service_key = s.service_key
where a.id = s.id
  and (a.service_metadata_id is distinct from sm.id or a.service_key is distinct from s.service_key);

create or replace function public.touch_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

drop trigger if exists trg_services_metadata_touch on public.services_metadata;
create trigger trg_services_metadata_touch before update on public.services_metadata
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_audit_services_metadata on public.services_metadata;
create trigger trg_audit_services_metadata after insert or update or delete on public.services_metadata
  for each row execute function public.fn_audit();

alter table public.services_metadata enable row level security;

drop policy if exists services_metadata_read on public.services_metadata;
create policy services_metadata_read on public.services_metadata
  for select using (auth.uid() is not null);

drop policy if exists services_metadata_admin_write on public.services_metadata;
create policy services_metadata_admin_write on public.services_metadata
  for all using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

-- Conferencia rapida:
-- select count(*) as servicos from public.services_metadata;

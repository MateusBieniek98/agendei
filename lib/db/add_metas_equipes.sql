-- GN · Migração: metas mensais por equipe
-- Rode uma vez no SQL Editor do Supabase para habilitar a distribuição
-- da meta mensal entre equipes/frentes.

begin;

create extension if not exists pgcrypto;

create table if not exists public.metas_equipes (
  id uuid primary key default gen_random_uuid(),
  ano int not null check (ano between 2000 and 2100),
  mes int not null check (mes between 1 and 12),
  equipe_id uuid not null references public.equipes(id) on delete cascade,
  valor_meta numeric(14,2) not null check (valor_meta >= 0),
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(ano, mes, equipe_id)
);

create index if not exists idx_metas_equipes_periodo
  on public.metas_equipes(ano, mes);

create index if not exists idx_metas_equipes_equipe
  on public.metas_equipes(equipe_id);

create or replace function public.touch_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_metas_equipes_touch on public.metas_equipes;
create trigger trg_metas_equipes_touch
  before update on public.metas_equipes
  for each row execute function public.touch_updated_at();

do $$
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'fn_audit'
  ) then
    execute 'drop trigger if exists trg_audit_metas_equipes on public.metas_equipes';
    execute 'create trigger trg_audit_metas_equipes after insert or update or delete on public.metas_equipes for each row execute function public.fn_audit()';
  end if;
end $$;

alter table public.metas_equipes enable row level security;

drop policy if exists metas_equipes_read on public.metas_equipes;
create policy metas_equipes_read
  on public.metas_equipes for select
  to authenticated
  using (auth.uid() is not null);

drop policy if exists metas_equipes_admin_write on public.metas_equipes;
create policy metas_equipes_admin_write
  on public.metas_equipes for all
  to authenticated
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

grant select, insert, update, delete on public.metas_equipes to authenticated;
grant all on public.metas_equipes to service_role;

commit;

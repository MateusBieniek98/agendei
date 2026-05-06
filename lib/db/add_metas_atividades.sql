-- Metas por atividade/acesso/frente para o resumo do encarregado.
-- Rode este script no SQL Editor do Supabase. Ele é idempotente.

create extension if not exists pgcrypto;

create table if not exists public.metas_atividades (
  id              uuid primary key default gen_random_uuid(),
  ano             int not null check (ano between 2000 and 2100),
  mes             int not null check (mes between 1 and 12),
  atividade_id    uuid not null references public.atividades(id) on delete cascade,
  equipe_id       uuid references public.equipes(id) on delete set null,
  profile_id      uuid references public.profiles(id) on delete set null,
  quantidade_meta numeric(12,3) not null check (quantidade_meta >= 0),
  observacoes     text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_metas_atividades_periodo
  on public.metas_atividades(ano, mes);
create index if not exists idx_metas_atividades_atividade
  on public.metas_atividades(atividade_id);
create index if not exists idx_metas_atividades_equipe
  on public.metas_atividades(equipe_id);
create index if not exists idx_metas_atividades_profile
  on public.metas_atividades(profile_id);

create unique index if not exists idx_metas_atividades_global_unica
  on public.metas_atividades(ano, mes, atividade_id)
  where equipe_id is null and profile_id is null;
create unique index if not exists idx_metas_atividades_equipe_unica
  on public.metas_atividades(ano, mes, atividade_id, equipe_id)
  where equipe_id is not null and profile_id is null;
create unique index if not exists idx_metas_atividades_profile_unica
  on public.metas_atividades(ano, mes, atividade_id, profile_id)
  where profile_id is not null;

create or replace function public.touch_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

drop trigger if exists trg_metas_atividades_touch on public.metas_atividades;
create trigger trg_metas_atividades_touch before update on public.metas_atividades
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_audit_metas_atividades on public.metas_atividades;
create trigger trg_audit_metas_atividades after insert or update or delete on public.metas_atividades
  for each row execute function public.fn_audit();

alter table public.metas_atividades enable row level security;

drop policy if exists metas_atividades_read on public.metas_atividades;
create policy metas_atividades_read on public.metas_atividades
  for select using (auth.uid() is not null);

drop policy if exists metas_atividades_admin_write on public.metas_atividades;
create policy metas_atividades_admin_write on public.metas_atividades
  for all using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

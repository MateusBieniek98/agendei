-- GN · fila de sincronizacao App -> Planilha
-- Rode no SQL Editor do Supabase se o banco ja existe em producao.

create extension if not exists pgcrypto;

create table if not exists public.sync_jobs (
  id            uuid primary key default gen_random_uuid(),
  tipo          text not null,
  dedupe_key    text not null,
  status        text not null default 'pendente'
    check (status in ('pendente', 'processando', 'concluido', 'erro')),
  evento        text,
  producao_id   uuid references public.producao(id) on delete set null,
  payload       jsonb not null default '{}'::jsonb,
  attempts      int not null default 0 check (attempts >= 0),
  max_attempts  int not null default 8 check (max_attempts > 0),
  last_error    text,
  scheduled_at  timestamptz not null default now(),
  locked_at     timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique(tipo, dedupe_key)
);

create index if not exists idx_sync_jobs_status
  on public.sync_jobs(tipo, status, scheduled_at);
create index if not exists idx_sync_jobs_producao
  on public.sync_jobs(producao_id);

create or replace function public.touch_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

drop trigger if exists trg_sync_jobs_touch on public.sync_jobs;
create trigger trg_sync_jobs_touch before update on public.sync_jobs
  for each row execute function public.touch_updated_at();

alter table public.sync_jobs enable row level security;

drop policy if exists sync_jobs_admin_read on public.sync_jobs;
create policy sync_jobs_admin_read on public.sync_jobs
  for select using (public.current_role() = 'admin');

drop policy if exists sync_jobs_admin_write on public.sync_jobs;
create policy sync_jobs_admin_write on public.sync_jobs
  for all using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

drop policy if exists sync_jobs_service_role_all on public.sync_jobs;
create policy sync_jobs_service_role_all on public.sync_jobs
  for all to service_role
  using (true)
  with check (true);

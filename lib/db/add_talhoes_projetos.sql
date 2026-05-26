-- GN · cadastro de projetos e talhoes
-- Rode este script no SQL Editor do Supabase para habilitar a aba Admin > Projetos.

create extension if not exists pgcrypto;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.talhoes (
  id          uuid primary key default gen_random_uuid(),
  projeto_id  uuid not null references public.projetos(id) on delete cascade,
  codigo      text not null,
  area_ha     numeric(12,3),
  ativo       boolean not null default true,
  observacoes text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

do $$
begin
  alter table public.talhoes
    add constraint talhoes_projeto_codigo_key unique (projeto_id, codigo);
exception when duplicate_object then null;
end $$;

create index if not exists idx_talhoes_projeto on public.talhoes(projeto_id);
create index if not exists idx_talhoes_ativo on public.talhoes(ativo);

drop trigger if exists trg_talhoes_updated_at on public.talhoes;
create trigger trg_talhoes_updated_at
before update on public.talhoes
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
    drop trigger if exists trg_audit_talhoes on public.talhoes;
    create trigger trg_audit_talhoes
    after insert or update or delete on public.talhoes
    for each row execute function public.fn_audit();
  end if;
end $$;

alter table public.talhoes enable row level security;

drop policy if exists talhoes_read on public.talhoes;
create policy talhoes_read on public.talhoes
for select using (auth.uid() is not null);

drop policy if exists talhoes_admin_write on public.talhoes;
create policy talhoes_admin_write on public.talhoes
for all
using (public.current_role() = 'admin')
with check (public.current_role() = 'admin');

-- Backfill: cria talhoes a partir dos textos ja existentes em planejamento e apontamentos.
insert into public.talhoes (projeto_id, codigo)
select distinct projeto_id, btrim(talhao) as codigo
from (
  select projeto_id, talhao from public.planejamento
  union all
  select projeto_id, talhao from public.producao
) origem
where projeto_id is not null
  and nullif(btrim(coalesce(talhao, '')), '') is not null
on conflict on constraint talhoes_projeto_codigo_key do nothing;

select
  p.nome as projeto,
  count(t.id) as talhoes_cadastrados
from public.projetos p
left join public.talhoes t on t.projeto_id = p.id and t.ativo = true
group by p.nome
order by p.nome;

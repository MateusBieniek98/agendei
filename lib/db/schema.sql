-- ════════════════════════════════════════════════════════════════════════
--  GN · schema PostgreSQL (Supabase)
--  Rode este arquivo no SQL Editor do Supabase. Idempotente: pode rodar
--  novamente para recriar (use `drop schema public cascade; create schema public;`
--  antes se quiser zerar tudo).
-- ════════════════════════════════════════════════════════════════════════

-- ───── extensões ────────────────────────────────────────────────────────
create extension if not exists pgcrypto;

-- ───── tipos enumerados ─────────────────────────────────────────────────
do $$ begin
  create type user_role as enum ('encarregado', 'admin', 'gestor');
exception when duplicate_object then null; end $$;

do $$ begin
  create type machine_status as enum ('operando', 'parada', 'manutencao_urgente');
exception when duplicate_object then null; end $$;

do $$ begin
  create type maintenance_status as enum ('aberto', 'em_andamento', 'resolvido');
exception when duplicate_object then null; end $$;

do $$ begin
  create type planning_status as enum ('planejado', 'em_execucao', 'concluido', 'cancelado');
exception when duplicate_object then null; end $$;

-- ═══ profiles ═══════════════════════════════════════════════════════════
-- Estende auth.users com nome e papel (role).
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text unique not null,
  nome        text not null,
  role        user_role not null default 'encarregado',
  equipe_id   uuid,
  ativo       boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ═══ equipes (frentes de trabalho) ══════════════════════════════════════
create table if not exists public.equipes (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  descricao   text,
  encarregado_id uuid references public.profiles(id),
  ativo       boolean not null default true,
  created_at  timestamptz not null default now()
);

alter table public.profiles
  drop constraint if exists profiles_equipe_fk,
  add constraint profiles_equipe_fk
    foreign key (equipe_id) references public.equipes(id) on delete set null;

-- ═══ atividades (tipos de serviço com valor unitário) ═══════════════════
create table if not exists public.atividades (
  id              uuid primary key default gen_random_uuid(),
  nome            text not null,
  unidade         text not null,                  -- ha, m, mudas, kg…
  valor_unitario  numeric(12,4) not null check (valor_unitario >= 0),
  ativo           boolean not null default true,
  created_at      timestamptz not null default now()
);

-- ═══ projetos (fazendas) ═══════════════════════════════════════════════
create table if not exists public.projetos (
  id          uuid primary key default gen_random_uuid(),
  nome        text unique not null,
  ativo       boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ═══ producao (lançamento diário) ═══════════════════════════════════════
create table if not exists public.producao (
  id            uuid primary key default gen_random_uuid(),
  data          date not null default current_date,
  equipe_id     uuid not null references public.equipes(id),
  atividade_id  uuid not null references public.atividades(id),
  projeto_id    uuid references public.projetos(id),
  talhao        text,
  quantidade    numeric(12,3) not null check (quantidade > 0),
  insumos       jsonb not null default '[]'::jsonb,
  descarte      numeric(12,3),
  observacoes   text,
  -- snapshot do valor unitário no momento do lançamento (auditoria)
  valor_unitario_snapshot numeric(12,4) not null,
  registrado_por uuid not null references public.profiles(id),
  editado_por    uuid references public.profiles(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
alter table public.producao
  add column if not exists projeto_id uuid references public.projetos(id),
  add column if not exists talhao text,
  add column if not exists insumos jsonb not null default '[]'::jsonb,
  add column if not exists descarte numeric(12,3);
create index if not exists idx_producao_data on public.producao(data);
create index if not exists idx_producao_equipe on public.producao(equipe_id);
create index if not exists idx_producao_atividade on public.producao(atividade_id);
create index if not exists idx_producao_projeto on public.producao(projeto_id);

-- ═══ planejamento mensal ═══════════════════════════════════════════════
create table if not exists public.planejamento (
  id                  uuid primary key default gen_random_uuid(),
  ano                 int not null check (ano between 2000 and 2100),
  mes                 int not null check (mes between 1 and 12),
  projeto_id           uuid not null references public.projetos(id),
  talhao              text not null,
  atividade_id         uuid not null references public.atividades(id),
  equipe_id            uuid references public.equipes(id),
  quantidade_prevista  numeric(12,3),
  data_inicio          date,
  data_limite          date not null,
  status              planning_status not null default 'planejado',
  observacoes          text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index if not exists idx_planejamento_mes on public.planejamento(ano, mes);
create index if not exists idx_planejamento_prazo on public.planejamento(data_limite);
create index if not exists idx_planejamento_status on public.planejamento(status);
create index if not exists idx_producao_planejamento_chave
  on public.producao (projeto_id, atividade_id, lower(trim(talhao)));
create index if not exists idx_planejamento_chave
  on public.planejamento (projeto_id, atividade_id, lower(trim(talhao)));

-- ═══ máquinas e manutenções ═════════════════════════════════════════════
create table if not exists public.maquinas (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  tipo        text not null,                  -- trator, roçadeira, motosserra…
  identificador text,                          -- placa/patrimônio
  status      machine_status not null default 'operando',
  ativo       boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists public.manutencoes (
  id           uuid primary key default gen_random_uuid(),
  maquina_id   uuid not null references public.maquinas(id) on delete cascade,
  equipe_id    uuid references public.equipes(id),
  projeto_id   uuid references public.projetos(id),
  talhao       text,
  descricao    text not null,
  status       maintenance_status not null default 'aberto',
  reportado_por uuid not null references public.profiles(id),
  resolvido_em  timestamptz,
  created_at   timestamptz not null default now()
);
alter table public.manutencoes
  add column if not exists equipe_id uuid references public.equipes(id),
  add column if not exists projeto_id uuid references public.projetos(id),
  add column if not exists talhao text;
create index if not exists idx_manut_maquina on public.manutencoes(maquina_id);
create index if not exists idx_manut_status on public.manutencoes(status);
create index if not exists idx_manut_equipe on public.manutencoes(equipe_id);
create index if not exists idx_manut_projeto on public.manutencoes(projeto_id);

-- ═══ metas mensais ══════════════════════════════════════════════════════
create table if not exists public.metas (
  id           uuid primary key default gen_random_uuid(),
  ano          int not null check (ano between 2000 and 2100),
  mes          int not null check (mes between 1 and 12),
  valor_meta   numeric(14,2) not null check (valor_meta >= 0),
  observacoes  text,
  created_at   timestamptz not null default now(),
  unique(ano, mes)
);

-- ═══ audit log ══════════════════════════════════════════════════════════
create table if not exists public.audit_log (
  id          uuid primary key default gen_random_uuid(),
  tabela      text not null,
  registro_id uuid,
  acao        text not null,                  -- insert | update | delete
  usuario_id  uuid references public.profiles(id),
  diff        jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists idx_audit_tabela on public.audit_log(tabela);
create index if not exists idx_audit_registro on public.audit_log(registro_id);

-- ───── trigger de updated_at ───────────────────────────────────────────
create or replace function public.touch_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

drop trigger if exists trg_profiles_touch on public.profiles;
create trigger trg_profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_producao_touch on public.producao;
create trigger trg_producao_touch before update on public.producao
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_planejamento_touch on public.planejamento;
create trigger trg_planejamento_touch before update on public.planejamento
  for each row execute function public.touch_updated_at();

-- ───── trigger de auditoria ────────────────────────────────────────────
create or replace function public.fn_audit() returns trigger as $$
declare
  v_user uuid := nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
begin
  if (tg_op = 'DELETE') then
    insert into public.audit_log(tabela, registro_id, acao, usuario_id, diff)
    values (tg_table_name, old.id, 'delete', v_user, to_jsonb(old));
    return old;
  elsif (tg_op = 'UPDATE') then
    insert into public.audit_log(tabela, registro_id, acao, usuario_id, diff)
    values (tg_table_name, new.id, 'update', v_user,
            jsonb_build_object('antes', to_jsonb(old), 'depois', to_jsonb(new)));
    return new;
  else
    insert into public.audit_log(tabela, registro_id, acao, usuario_id, diff)
    values (tg_table_name, new.id, 'insert', v_user, to_jsonb(new));
    return new;
  end if;
end;
$$ language plpgsql;

drop trigger if exists trg_audit_producao   on public.producao;
drop trigger if exists trg_audit_maquinas   on public.maquinas;
drop trigger if exists trg_audit_atividades on public.atividades;
drop trigger if exists trg_audit_metas      on public.metas;
drop trigger if exists trg_audit_planejamento on public.planejamento;
create trigger trg_audit_producao   after insert or update or delete on public.producao
  for each row execute function public.fn_audit();
create trigger trg_audit_maquinas   after insert or update or delete on public.maquinas
  for each row execute function public.fn_audit();
create trigger trg_audit_atividades after insert or update or delete on public.atividades
  for each row execute function public.fn_audit();
create trigger trg_audit_metas      after insert or update or delete on public.metas
  for each row execute function public.fn_audit();
create trigger trg_audit_planejamento after insert or update or delete on public.planejamento
  for each row execute function public.fn_audit();

-- ───── helpers RLS ─────────────────────────────────────────────────────
create or replace function public.current_role() returns user_role
  language sql
  stable
  security definer
  set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

revoke all on function public.current_role() from public;
grant execute on function public.current_role() to anon, authenticated, service_role;

create or replace function public.set_machine_status(
  p_maquina_id uuid,
  p_status machine_status
) returns public.maquinas
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_maquina public.maquinas;
begin
  if auth.uid() is null then
    raise exception 'unauthenticated';
  end if;

  update public.maquinas
  set status = p_status
  where id = p_maquina_id
  returning * into v_maquina;

  if v_maquina.id is null then
    raise exception 'machine_not_found';
  end if;

  return v_maquina;
end;
$$;

revoke all on function public.set_machine_status(uuid, machine_status) from public;
grant execute on function public.set_machine_status(uuid, machine_status)
  to authenticated, service_role;

create or replace function public.resolve_maintenance(
  p_manutencao_id uuid,
  p_machine_status machine_status default 'operando'
) returns public.manutencoes
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_manut public.manutencoes;
begin
  if auth.uid() is null then
    raise exception 'unauthenticated';
  end if;

  select *
  into v_manut
  from public.manutencoes
  where id = p_manutencao_id;

  if v_manut.id is null then
    raise exception 'maintenance_not_found';
  end if;

  if public.current_role() not in ('admin', 'encarregado') then
    raise exception 'forbidden';
  end if;

  update public.manutencoes
  set status = 'resolvido',
      resolvido_em = coalesce(resolvido_em, now())
  where id = p_manutencao_id
  returning * into v_manut;

  if not exists (
    select 1
    from public.manutencoes m
    where m.maquina_id = v_manut.maquina_id
      and m.status <> 'resolvido'
  ) then
    update public.maquinas
    set status = p_machine_status
    where id = v_manut.maquina_id;
  end if;

  return v_manut;
end;
$$;

revoke all on function public.resolve_maintenance(uuid, machine_status) from public;
grant execute on function public.resolve_maintenance(uuid, machine_status)
  to authenticated, service_role;

create or replace function public.sync_planejamento_progress(
  p_projeto_id uuid,
  p_talhao text,
  p_atividade_id uuid
) returns void
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  if p_projeto_id is null or p_talhao is null or p_atividade_id is null then
    return;
  end if;

  with alvo as (
    select
      pl.id,
      coalesce(pl.quantidade_prevista, 0)::numeric as previsto,
      coalesce(sum(p.quantidade), 0)::numeric as produzido
    from public.planejamento pl
    left join public.producao p
      on p.projeto_id = pl.projeto_id
     and p.atividade_id = pl.atividade_id
     and lower(trim(p.talhao)) = lower(trim(pl.talhao))
    where pl.projeto_id = p_projeto_id
      and pl.atividade_id = p_atividade_id
      and lower(trim(pl.talhao)) = lower(trim(p_talhao))
      and pl.status not in ('concluido', 'cancelado')
    group by pl.id, pl.quantidade_prevista
  )
  update public.planejamento pl
  set status = case
      when alvo.previsto > 0 and alvo.produzido >= alvo.previsto then 'concluido'::planning_status
      when alvo.produzido > 0 then 'em_execucao'::planning_status
      else 'planejado'::planning_status
    end,
    updated_at = now()
  from alvo
  where pl.id = alvo.id;
end;
$$;

revoke all on function public.sync_planejamento_progress(uuid, text, uuid) from public;
grant execute on function public.sync_planejamento_progress(uuid, text, uuid)
  to authenticated, service_role;

create or replace function public.sync_planejamento_progress_after_producao()
returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform public.sync_planejamento_progress(old.projeto_id, old.talhao, old.atividade_id);
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    perform public.sync_planejamento_progress(new.projeto_id, new.talhao, new.atividade_id);
    return new;
  end if;

  return old;
end;
$$;

drop trigger if exists trg_sync_planejamento_progress on public.producao;
create trigger trg_sync_planejamento_progress
  after insert or update or delete on public.producao
  for each row execute function public.sync_planejamento_progress_after_producao();

-- ═══ RLS ════════════════════════════════════════════════════════════════
alter table public.profiles    enable row level security;
alter table public.equipes     enable row level security;
alter table public.atividades  enable row level security;
alter table public.projetos    enable row level security;
alter table public.producao    enable row level security;
alter table public.planejamento enable row level security;
alter table public.maquinas    enable row level security;
alter table public.manutencoes enable row level security;
alter table public.metas       enable row level security;
alter table public.audit_log   enable row level security;

-- profiles
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (auth.uid() = id or public.current_role() in ('admin','gestor'));
drop policy if exists profiles_admin_write on public.profiles;
create policy profiles_admin_write on public.profiles
  for all using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

-- equipes / atividades / projetos / metas / maquinas — leitura para todos autenticados,
-- escrita para admin
do $$
declare t text;
begin
  for t in select unnest(array['equipes','atividades','projetos','metas','maquinas','planejamento']) loop
    execute format('drop policy if exists %I_read on public.%I', t, t);
    execute format('drop policy if exists %I_admin_write on public.%I', t, t);
    execute format('create policy %I_read on public.%I for select using (auth.uid() is not null)', t, t);
    execute format('create policy %I_admin_write on public.%I for all using (public.current_role()=''admin'') with check (public.current_role()=''admin'')', t, t);
  end loop;
end $$;

-- producao
drop policy if exists producao_read on public.producao;
create policy producao_read on public.producao
  for select using (auth.uid() is not null);

drop policy if exists producao_insert on public.producao;
create policy producao_insert on public.producao
  for insert with check (
    auth.uid() is not null
    and registrado_por = auth.uid()
  );

drop policy if exists producao_update on public.producao;
create policy producao_update on public.producao
  for update using (
    public.current_role() = 'admin'
    or registrado_por = auth.uid()  -- encarregado pode corrigir o próprio lançamento do dia
  );

drop policy if exists producao_delete on public.producao;
create policy producao_delete on public.producao
  for delete using (public.current_role() = 'admin');

-- manutencoes — encarregado abre, admin gerencia
drop policy if exists manut_read on public.manutencoes;
create policy manut_read on public.manutencoes
  for select using (auth.uid() is not null);
drop policy if exists manut_insert on public.manutencoes;
create policy manut_insert on public.manutencoes
  for insert with check (auth.uid() is not null and reportado_por = auth.uid());
drop policy if exists manut_update on public.manutencoes;
create policy manut_update on public.manutencoes
  for update using (public.current_role() = 'admin');
drop policy if exists manut_delete on public.manutencoes;
create policy manut_delete on public.manutencoes
  for delete using (public.current_role() = 'admin');

-- audit_log — somente admin lê, ninguém escreve direto
drop policy if exists audit_admin_read on public.audit_log;
create policy audit_admin_read on public.audit_log
  for select using (public.current_role() = 'admin');

-- ═══ views agregadas (dashboards) ═══════════════════════════════════════

-- faturamento por dia (últimos 60d)
create or replace view public.v_faturamento_dia as
select
  p.data,
  sum(p.quantidade * p.valor_unitario_snapshot)::numeric(14,2) as faturamento
from public.producao p
where p.data >= current_date - interval '60 days'
group by p.data
order by p.data;

-- produção por atividade no mês corrente
create or replace view public.v_producao_atividade_mes as
select
  a.id, a.nome, a.unidade,
  coalesce(sum(p.quantidade), 0) as total,
  coalesce(sum(p.quantidade * p.valor_unitario_snapshot), 0)::numeric(14,2) as faturamento
from public.atividades a
left join public.producao p
  on p.atividade_id = a.id
 and date_trunc('month', p.data) = date_trunc('month', current_date)
group by a.id, a.nome, a.unidade
order by faturamento desc;

-- ranking de equipes no mês
create or replace view public.v_ranking_equipes_mes as
select
  e.id, e.nome,
  coalesce(sum(p.quantidade * p.valor_unitario_snapshot), 0)::numeric(14,2) as faturamento,
  count(p.id) as total_lancamentos
from public.equipes e
left join public.producao p
  on p.equipe_id = e.id
 and date_trunc('month', p.data) = date_trunc('month', current_date)
group by e.id, e.nome
order by faturamento desc;

-- status atual das máquinas
create or replace view public.v_status_maquinas as
select
  status,
  count(*) as total
from public.maquinas
where ativo = true
group by status;

-- Canonical project/plot links and auditable operational allocations.

alter table public.producao add column if not exists talhao_id uuid;
alter table public.planejamento add column if not exists talhao_id uuid;
alter table public.manutencoes add column if not exists talhao_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'producao_talhao_id_fkey'
      and conrelid = 'public.producao'::regclass
  ) then
    alter table public.producao
      add constraint producao_talhao_id_fkey
      foreign key (talhao_id) references public.talhoes(id) on delete restrict;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'planejamento_talhao_id_fkey'
      and conrelid = 'public.planejamento'::regclass
  ) then
    alter table public.planejamento
      add constraint planejamento_talhao_id_fkey
      foreign key (talhao_id) references public.talhoes(id) on delete restrict;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'manutencoes_talhao_id_fkey'
      and conrelid = 'public.manutencoes'::regclass
  ) then
    alter table public.manutencoes
      add constraint manutencoes_talhao_id_fkey
      foreign key (talhao_id) references public.talhoes(id) on delete restrict;
  end if;
end $$;

create unique index if not exists idx_talhoes_projeto_codigo_normalizado
  on public.talhoes (projeto_id, lower(trim(codigo)));
create unique index if not exists idx_talhoes_id_projeto
  on public.talhoes (id, projeto_id);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'producao_talhao_projeto_fkey') then
    alter table public.producao add constraint producao_talhao_projeto_fkey
      foreign key (talhao_id, projeto_id) references public.talhoes(id, projeto_id) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'planejamento_talhao_projeto_fkey') then
    alter table public.planejamento add constraint planejamento_talhao_projeto_fkey
      foreign key (talhao_id, projeto_id) references public.talhoes(id, projeto_id) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'manutencoes_talhao_projeto_fkey') then
    alter table public.manutencoes add constraint manutencoes_talhao_projeto_fkey
      foreign key (talhao_id, projeto_id) references public.talhoes(id, projeto_id) on delete restrict;
  end if;
end $$;
create index if not exists idx_producao_projeto_talhao_data
  on public.producao (projeto_id, talhao_id, data);
create index if not exists idx_planejamento_projeto_talhao_periodo
  on public.planejamento (projeto_id, talhao_id, ano, mes);
create index if not exists idx_manutencoes_projeto_talhao_status
  on public.manutencoes (projeto_id, talhao_id, status);
create index if not exists idx_producao_talhao_id
  on public.producao (talhao_id);
create index if not exists idx_producao_talhao_projeto
  on public.producao (talhao_id, projeto_id);
create index if not exists idx_planejamento_talhao_id
  on public.planejamento (talhao_id);
create index if not exists idx_planejamento_talhao_projeto
  on public.planejamento (talhao_id, projeto_id);
create index if not exists idx_manutencoes_talhao_id
  on public.manutencoes (talhao_id);
create index if not exists idx_manutencoes_talhao_projeto
  on public.manutencoes (talhao_id, projeto_id);

-- Preserve history: link only exact catalog matches inside the same project.
update public.producao p
set talhao_id = t.id,
    talhao = t.codigo
from public.talhoes t
where p.talhao_id is null
  and p.projeto_id = t.projeto_id
  and lower(trim(p.talhao)) = lower(trim(t.codigo));

update public.planejamento p
set talhao_id = t.id,
    talhao = t.codigo
from public.talhoes t
where p.talhao_id is null
  and p.projeto_id = t.projeto_id
  and lower(trim(p.talhao)) = lower(trim(t.codigo));

update public.manutencoes m
set talhao_id = t.id,
    talhao = t.codigo
from public.talhoes t
where m.talhao_id is null
  and m.projeto_id = t.projeto_id
  and lower(trim(m.talhao)) = lower(trim(t.codigo));

create or replace function public.enforce_catalog_plot_link()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_talhao public.talhoes;
begin
  if tg_op = 'UPDATE'
     and new.projeto_id is not distinct from old.projeto_id
     and new.talhao_id is not distinct from old.talhao_id
     and new.talhao is not distinct from old.talhao then
    return new;
  end if;

  if new.talhao_id is not null then
    select t.* into v_talhao
    from public.talhoes t
    join public.projetos p on p.id = t.projeto_id
    where t.id = new.talhao_id
      and t.ativo is true
      and p.ativo is true;
  else
    if new.projeto_id is null or nullif(trim(coalesce(new.talhao, '')), '') is null then
      raise exception 'project_and_plot_required';
    end if;

    select t.* into v_talhao
    from public.talhoes t
    join public.projetos p on p.id = t.projeto_id
    where t.projeto_id = new.projeto_id
      and lower(trim(t.codigo)) = lower(trim(new.talhao))
      and t.ativo is true
      and p.ativo is true;
  end if;

  if v_talhao.id is null then
    raise exception 'invalid_or_inactive_plot';
  end if;
  if new.projeto_id is not null and new.projeto_id <> v_talhao.projeto_id then
    raise exception 'plot_does_not_belong_to_project';
  end if;

  new.projeto_id := v_talhao.projeto_id;
  new.talhao_id := v_talhao.id;
  new.talhao := v_talhao.codigo;
  return new;
end;
$$;

drop trigger if exists trg_producao_catalog_plot on public.producao;
create trigger trg_producao_catalog_plot
before insert or update of projeto_id, talhao_id, talhao on public.producao
for each row execute function public.enforce_catalog_plot_link();

drop trigger if exists trg_planejamento_catalog_plot on public.planejamento;
create trigger trg_planejamento_catalog_plot
before insert or update of projeto_id, talhao_id, talhao on public.planejamento
for each row execute function public.enforce_catalog_plot_link();

drop trigger if exists trg_manutencoes_catalog_plot on public.manutencoes;
create trigger trg_manutencoes_catalog_plot
before insert or update of projeto_id, talhao_id, talhao on public.manutencoes
for each row execute function public.enforce_catalog_plot_link();

-- Prefer canonical IDs when both records are linked; retain text matching only
-- when at least one side is legacy and has no catalog link.
create or replace function public.sync_planejamento_progress(
  p_projeto_id uuid,
  p_talhao text,
  p_atividade_id uuid
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_projeto_nome text;
  v_atividade_nome text;
begin
  if p_projeto_id is null or p_talhao is null or p_atividade_id is null then return; end if;
  select nome into v_projeto_nome from public.projetos where id = p_projeto_id;
  select nome into v_atividade_nome from public.atividades where id = p_atividade_id;

  with alvo as (
    select pl.id, coalesce(pl.quantidade_prevista, 0)::numeric as previsto,
      coalesce(sum(p.quantidade), 0)::numeric as produzido
    from public.planejamento pl
    join public.projetos pl_proj on pl_proj.id = pl.projeto_id
    join public.atividades pl_ativ on pl_ativ.id = pl.atividade_id
    left join public.producao p
      on (p.projeto_id = pl.projeto_id or exists (
          select 1 from public.projetos p_proj where p_proj.id = p.projeto_id
          and public.normalize_planejamento_projeto(p_proj.nome) = public.normalize_planejamento_projeto(pl_proj.nome)))
     and (p.atividade_id = pl.atividade_id or exists (
          select 1 from public.atividades p_ativ where p_ativ.id = p.atividade_id
          and public.normalize_planejamento_text(p_ativ.nome) = public.normalize_planejamento_text(pl_ativ.nome)))
     and (
       (pl.talhao_id is not null and p.talhao_id = pl.talhao_id)
       or ((pl.talhao_id is null or p.talhao_id is null) and lower(trim(p.talhao)) = lower(trim(pl.talhao)))
     )
    where (pl.projeto_id = p_projeto_id or public.normalize_planejamento_projeto(pl_proj.nome) = public.normalize_planejamento_projeto(v_projeto_nome))
      and (pl.atividade_id = p_atividade_id or public.normalize_planejamento_text(pl_ativ.nome) = public.normalize_planejamento_text(v_atividade_nome))
      and lower(trim(pl.talhao)) = lower(trim(p_talhao))
      and pl.status not in ('concluido', 'cancelado')
    group by pl.id, pl.quantidade_prevista
  )
  update public.planejamento pl
  set status = case
      when alvo.previsto > 0 and alvo.produzido >= alvo.previsto then 'concluido'::public.planning_status
      when alvo.produzido > 0 then 'em_execucao'::public.planning_status
      else 'planejado'::public.planning_status
    end,
    updated_at = now()
  from alvo where pl.id = alvo.id;
end;
$$;

create table if not exists public.alocacoes_operacionais (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid not null references public.projetos(id) on delete restrict,
  talhao_id uuid not null,
  equipe_id uuid references public.equipes(id) on delete restrict,
  maquina_id uuid references public.maquinas(id) on delete restrict,
  iniciado_em timestamptz not null default now(),
  encerrado_em timestamptz,
  observacoes text,
  alocado_por uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint alocacoes_operacionais_recurso_check
    check (num_nonnulls(equipe_id, maquina_id) = 1),
  constraint alocacoes_operacionais_periodo_check
    check (encerrado_em is null or encerrado_em >= iniciado_em),
  constraint alocacoes_operacionais_talhao_projeto_fkey
    foreign key (talhao_id, projeto_id)
    references public.talhoes(id, projeto_id) on delete restrict
);

create unique index if not exists idx_alocacoes_equipe_ativa
  on public.alocacoes_operacionais (equipe_id)
  where equipe_id is not null and encerrado_em is null;
create unique index if not exists idx_alocacoes_maquina_ativa
  on public.alocacoes_operacionais (maquina_id)
  where maquina_id is not null and encerrado_em is null;
create index if not exists idx_alocacoes_escopo_periodo
  on public.alocacoes_operacionais (projeto_id, talhao_id, encerrado_em, iniciado_em desc);
create index if not exists idx_alocacoes_talhao_id
  on public.alocacoes_operacionais (talhao_id);
create index if not exists idx_alocacoes_alocado_por
  on public.alocacoes_operacionais (alocado_por);
create index if not exists idx_alocacoes_talhao_projeto
  on public.alocacoes_operacionais (talhao_id, projeto_id);

alter table public.alocacoes_operacionais enable row level security;

drop policy if exists alocacoes_read on public.alocacoes_operacionais;
create policy alocacoes_read on public.alocacoes_operacionais
for select to authenticated using (true);

drop policy if exists alocacoes_insert on public.alocacoes_operacionais;
create policy alocacoes_insert on public.alocacoes_operacionais
for insert to authenticated
with check (
  (select public.current_role()) in ('admin'::public.user_role, 'gestor'::public.user_role)
  and alocado_por = (select auth.uid())
);

drop policy if exists alocacoes_update on public.alocacoes_operacionais;
create policy alocacoes_update on public.alocacoes_operacionais
for update to authenticated
using ((select public.current_role()) in ('admin'::public.user_role, 'gestor'::public.user_role))
with check ((select public.current_role()) in ('admin'::public.user_role, 'gestor'::public.user_role));

create or replace function public.manage_operational_allocation(
  p_action text,
  p_resource_type text,
  p_resource_id uuid,
  p_talhao_id uuid default null,
  p_observacoes text default null
) returns public.alocacoes_operacionais
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_role text := coalesce(public.current_role()::text, '');
  v_talhao public.talhoes;
  v_result public.alocacoes_operacionais;
begin
  if v_actor is null then raise exception 'unauthenticated'; end if;
  if v_role not in ('admin', 'gestor') then raise exception 'forbidden'; end if;
  if p_action not in ('alocar', 'encerrar') then raise exception 'invalid_action'; end if;
  if p_resource_type not in ('equipe', 'maquina') then raise exception 'invalid_resource_type'; end if;

  if p_resource_type = 'equipe' then
    perform 1 from public.equipes where id = p_resource_id and ativo is true for update;
  else
    perform 1 from public.maquinas where id = p_resource_id and ativo is true for update;
  end if;
  if not found then raise exception 'inactive_or_missing_resource'; end if;

  if p_action = 'encerrar' then
    update public.alocacoes_operacionais
    set encerrado_em = now()
    where encerrado_em is null
      and ((p_resource_type = 'equipe' and equipe_id = p_resource_id)
        or (p_resource_type = 'maquina' and maquina_id = p_resource_id))
    returning * into v_result;
    if v_result.id is null then raise exception 'active_allocation_not_found'; end if;
    return v_result;
  end if;

  select t.* into v_talhao
  from public.talhoes t
  join public.projetos p on p.id = t.projeto_id
  where t.id = p_talhao_id and t.ativo is true and p.ativo is true;
  if v_talhao.id is null then raise exception 'invalid_or_inactive_plot'; end if;

  update public.alocacoes_operacionais
  set encerrado_em = now()
  where encerrado_em is null
    and ((p_resource_type = 'equipe' and equipe_id = p_resource_id)
      or (p_resource_type = 'maquina' and maquina_id = p_resource_id));

  insert into public.alocacoes_operacionais (
    projeto_id, talhao_id, equipe_id, maquina_id, observacoes, alocado_por
  ) values (
    v_talhao.projeto_id,
    v_talhao.id,
    case when p_resource_type = 'equipe' then p_resource_id else null end,
    case when p_resource_type = 'maquina' then p_resource_id else null end,
    nullif(trim(coalesce(p_observacoes, '')), ''),
    v_actor
  ) returning * into v_result;

  return v_result;
end;
$$;

revoke all on public.alocacoes_operacionais from public, anon, authenticated;
grant select on public.alocacoes_operacionais to authenticated;
grant all on public.alocacoes_operacionais to service_role;

revoke all on function public.enforce_catalog_plot_link() from public, anon, authenticated;
revoke all on function public.manage_operational_allocation(text, text, uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.manage_operational_allocation(text, text, uuid, uuid, text)
  to authenticated, service_role;

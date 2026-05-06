-- GN · atualização de produção: status automático, projetos, talhão e planejamento
--
-- Rode este arquivo no Supabase SQL Editor depois do deploy.

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

do $$ begin
  create type planning_status as enum ('planejado', 'em_execucao', 'concluido', 'cancelado');
exception when duplicate_object then null; end $$;

create table if not exists public.projetos (
  id          uuid primary key default gen_random_uuid(),
  nome        text unique not null,
  ativo       boolean not null default true,
  created_at  timestamptz not null default now()
);

alter table public.producao
  add column if not exists projeto_id uuid references public.projetos(id),
  add column if not exists talhao text;

create index if not exists idx_producao_projeto on public.producao(projeto_id);

alter table public.manutencoes
  add column if not exists equipe_id uuid references public.equipes(id),
  add column if not exists projeto_id uuid references public.projetos(id),
  add column if not exists talhao text;

create index if not exists idx_manut_equipe on public.manutencoes(equipe_id);
create index if not exists idx_manut_projeto on public.manutencoes(projeto_id);

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

create or replace function public.touch_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

drop trigger if exists trg_planejamento_touch on public.planejamento;
create trigger trg_planejamento_touch before update on public.planejamento
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_audit_planejamento on public.planejamento;
create trigger trg_audit_planejamento after insert or update or delete on public.planejamento
  for each row execute function public.fn_audit();

alter table public.projetos enable row level security;
alter table public.planejamento enable row level security;

do $$
declare t text;
begin
  for t in select unnest(array['projetos','planejamento']) loop
    execute format('drop policy if exists %I_read on public.%I', t, t);
    execute format('drop policy if exists %I_admin_write on public.%I', t, t);
    execute format('create policy %I_read on public.%I for select using (auth.uid() is not null)', t, t);
    execute format('create policy %I_admin_write on public.%I for all using (public.current_role()=''admin'') with check (public.current_role()=''admin'')', t, t);
  end loop;
end $$;

insert into public.projetos (nome)
select nome
from (values
  ('Água Limpa'),
  ('Azinheira Gleba A'),
  ('Mãe Santa'),
  ('Monte Belo Gleba A'),
  ('Monte Belo Gleba B'),
  ('Monte Belo Gleba C'),
  ('Nossa Senhora de Fátima'),
  ('Pontal II'),
  ('Santa Maria II'),
  ('Santo Expedito II'),
  ('São José'),
  ('São Pedro III'),
  ('Taboca II')
) as v(nome)
on conflict (nome) do update set ativo = true;

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

select public.sync_planejamento_progress(projeto_id, talhao, atividade_id)
from public.planejamento;

select
  (select count(*) from public.projetos where ativo = true) as projetos_ativos,
  (select count(*) from public.planejamento) as itens_planejamento,
  'ok' as status;

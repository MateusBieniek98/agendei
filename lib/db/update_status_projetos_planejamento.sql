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

select
  (select count(*) from public.projetos where ativo = true) as projetos_ativos,
  (select count(*) from public.planejamento) as itens_planejamento,
  'ok' as status;

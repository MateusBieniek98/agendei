-- GN · controle de estoque de insumos somente para novos apontamentos.
-- Mantem producao.insumos legado intacto e inicia o controle em novos registros.

create extension if not exists pgcrypto;

alter table public.producao
  add column if not exists estoque_controlado boolean not null default false;

create table if not exists public.insumos (
  id             uuid primary key default gen_random_uuid(),
  codigo         text,
  nome           text not null,
  grupo          text not null default 'Operacional',
  unidade        text not null default 'un',
  saldo_atual    numeric(14,3) not null default 0 check (saldo_atual >= 0),
  estoque_minimo numeric(14,3) not null default 0 check (estoque_minimo >= 0),
  ativo          boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create unique index if not exists idx_insumos_codigo_unique
  on public.insumos (lower(trim(codigo)))
  where codigo is not null and trim(codigo) <> '';

create unique index if not exists idx_insumos_nome_unique
  on public.insumos (lower(trim(nome)));

create index if not exists idx_insumos_ativo_nome
  on public.insumos (ativo, nome);

create table if not exists public.insumo_movimentacoes (
  id              uuid primary key default gen_random_uuid(),
  insumo_id       uuid not null references public.insumos(id) on delete restrict,
  tipo            text not null check (
    tipo in ('entrada', 'ajuste', 'saida_apontamento', 'estorno_apontamento')
  ),
  quantidade      numeric(14,3) not null check (quantidade <> 0),
  saldo_anterior  numeric(14,3) not null,
  saldo_posterior numeric(14,3) not null check (saldo_posterior >= 0),
  producao_id     uuid references public.producao(id) on delete set null,
  usuario_id      uuid references public.profiles(id) on delete set null,
  observacoes     text,
  created_at      timestamptz not null default now()
);

create index if not exists idx_insumo_movimentacoes_insumo_data
  on public.insumo_movimentacoes (insumo_id, created_at desc);

create index if not exists idx_insumo_movimentacoes_producao
  on public.insumo_movimentacoes (producao_id)
  where producao_id is not null;

drop trigger if exists trg_insumos_touch on public.insumos;
create trigger trg_insumos_touch
before update on public.insumos
for each row execute function public.touch_updated_at();

alter table public.insumos enable row level security;
alter table public.insumo_movimentacoes enable row level security;

grant select, insert, update on public.insumos to authenticated;
grant select, insert on public.insumo_movimentacoes to authenticated;

drop policy if exists insumos_read on public.insumos;
create policy insumos_read on public.insumos
  for select
  to authenticated
  using (ativo = true or public.current_role() in ('admin', 'gestor'));

drop policy if exists insumos_admin_write on public.insumos;
create policy insumos_admin_write on public.insumos
  for all
  to authenticated
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

drop policy if exists insumo_movimentacoes_admin_read on public.insumo_movimentacoes;
create policy insumo_movimentacoes_admin_read on public.insumo_movimentacoes
  for select
  to authenticated
  using (public.current_role() = 'admin');

drop policy if exists insumo_movimentacoes_admin_insert on public.insumo_movimentacoes;
create policy insumo_movimentacoes_admin_insert on public.insumo_movimentacoes
  for insert
  to authenticated
  with check (public.current_role() = 'admin');

create or replace function public.current_cycle_start()
returns date
language sql
stable
as $$
  select case
    when extract(day from (now() at time zone 'America/Campo_Grande')::date) >= 21 then
      (date_trunc('month', (now() at time zone 'America/Campo_Grande')::date)::date + 20)
    else
      ((date_trunc('month', (now() at time zone 'America/Campo_Grande')::date)::date - interval '1 month')::date + 20)
  end
$$;

create or replace function public.current_cycle_end()
returns date
language sql
stable
as $$
  select case
    when extract(day from (now() at time zone 'America/Campo_Grande')::date) >= 21 then
      ((date_trunc('month', (now() at time zone 'America/Campo_Grande')::date)::date + interval '1 month')::date + 19)
    else
      (date_trunc('month', (now() at time zone 'America/Campo_Grande')::date)::date + 19)
  end
$$;

create or replace function public.registrar_movimentacao_insumo(
  p_insumo_id uuid,
  p_tipo text,
  p_quantidade numeric,
  p_observacoes text default null
) returns public.insumos
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_profile public.profiles;
  v_insumo public.insumos;
  v_anterior numeric(14,3);
  v_posterior numeric(14,3);
begin
  if v_actor is null then
    raise exception 'Usuário não autenticado.' using errcode = '28000';
  end if;

  select * into v_profile from public.profiles where id = v_actor and ativo = true;
  if not found or v_profile.role <> 'admin' then
    raise exception 'Apenas admin pode movimentar estoque.' using errcode = '42501';
  end if;

  if p_tipo not in ('entrada', 'ajuste') then
    raise exception 'Tipo de movimentação inválido.' using errcode = '22023';
  end if;

  if p_quantidade is null or p_quantidade = 0 then
    raise exception 'Quantidade inválida.' using errcode = '22023';
  end if;

  if p_tipo = 'entrada' and p_quantidade <= 0 then
    raise exception 'Entrada deve ter quantidade positiva.' using errcode = '22023';
  end if;

  select * into v_insumo from public.insumos where id = p_insumo_id for update;
  if not found then
    raise exception 'Insumo não encontrado.' using errcode = 'P0002';
  end if;

  v_anterior := v_insumo.saldo_atual;
  v_posterior := v_anterior + p_quantidade;
  if v_posterior < 0 then
    raise exception 'Ajuste deixaria o estoque negativo.' using errcode = '22023';
  end if;

  update public.insumos
     set saldo_atual = v_posterior
   where id = p_insumo_id
   returning * into v_insumo;

  insert into public.insumo_movimentacoes (
    insumo_id, tipo, quantidade, saldo_anterior, saldo_posterior, usuario_id, observacoes
  ) values (
    p_insumo_id, p_tipo, p_quantidade, v_anterior, v_posterior, v_actor, p_observacoes
  );

  return v_insumo;
end;
$$;

create or replace function public.validate_and_lock_insumos(
  p_insumos jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item record;
  v_raw jsonb;
  v_insumo public.insumos;
  v_normalized jsonb := '[]'::jsonb;
begin
  for v_raw in
    select value from jsonb_array_elements(coalesce(p_insumos, '[]'::jsonb)) as value
  loop
    if nullif(v_raw->>'quantidade', '') is null then
      continue;
    end if;
    if nullif(coalesce(v_raw->>'insumo_id', v_raw->>'id'), '') is null then
      raise exception 'Selecione apenas insumos cadastrados no estoque.' using errcode = '22023';
    end if;
    if (v_raw->>'quantidade')::numeric <= 0 then
      raise exception 'Quantidade de insumo inválida.' using errcode = '22023';
    end if;
  end loop;

  for v_item in
    select
      coalesce(value->>'insumo_id', value->>'id')::uuid as insumo_id,
      sum((value->>'quantidade')::numeric)::numeric(14,3) as quantidade
    from jsonb_array_elements(coalesce(p_insumos, '[]'::jsonb)) as value
    where nullif(coalesce(value->>'insumo_id', value->>'id'), '') is not null
      and nullif(value->>'quantidade', '') is not null
    group by coalesce(value->>'insumo_id', value->>'id')::uuid
  loop
    if v_item.quantidade <= 0 then
      raise exception 'Quantidade de insumo inválida.' using errcode = '22023';
    end if;

    select * into v_insumo from public.insumos where id = v_item.insumo_id for update;
    if not found or v_insumo.ativo = false then
      raise exception 'Insumo inválido ou inativo.' using errcode = '22023';
    end if;

    if v_insumo.saldo_atual < v_item.quantidade then
      raise exception 'Estoque insuficiente para %: disponível %, solicitado %.',
        v_insumo.nome, v_insumo.saldo_atual, v_item.quantidade
        using errcode = '22023';
    end if;

    v_normalized := v_normalized || jsonb_build_array(jsonb_build_object(
      'insumo_id', v_insumo.id,
      'codigo', v_insumo.codigo,
      'nome', v_insumo.nome,
      'unidade', v_insumo.unidade,
      'quantidade', v_item.quantidade
    ));
  end loop;

  return v_normalized;
end;
$$;

create or replace function public.baixar_insumos_apontamento(
  p_producao_id uuid,
  p_insumos jsonb,
  p_actor_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item record;
  v_insumo public.insumos;
  v_anterior numeric(14,3);
  v_posterior numeric(14,3);
begin
  for v_item in
    select
      (value->>'insumo_id')::uuid as insumo_id,
      (value->>'quantidade')::numeric(14,3) as quantidade
    from jsonb_array_elements(coalesce(p_insumos, '[]'::jsonb)) as value
  loop
    select * into v_insumo from public.insumos where id = v_item.insumo_id for update;
    if not found then
      raise exception 'Insumo não encontrado para baixa.' using errcode = 'P0002';
    end if;
    if v_insumo.saldo_atual < v_item.quantidade then
      raise exception 'Estoque insuficiente para %: disponível %, solicitado %.',
        v_insumo.nome, v_insumo.saldo_atual, v_item.quantidade
        using errcode = '22023';
    end if;
    v_anterior := v_insumo.saldo_atual;
    v_posterior := v_anterior - v_item.quantidade;
    update public.insumos set saldo_atual = v_posterior where id = v_item.insumo_id;
    insert into public.insumo_movimentacoes (
      insumo_id, tipo, quantidade, saldo_anterior, saldo_posterior,
      producao_id, usuario_id
    ) values (
      v_item.insumo_id, 'saida_apontamento', -v_item.quantidade,
      v_anterior, v_posterior, p_producao_id, p_actor_id
    );
  end loop;
end;
$$;

create or replace function public.estornar_insumos_apontamento(
  p_producao_id uuid,
  p_insumos jsonb,
  p_actor_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item record;
  v_insumo public.insumos;
  v_anterior numeric(14,3);
  v_posterior numeric(14,3);
begin
  for v_item in
    select
      (value->>'insumo_id')::uuid as insumo_id,
      (value->>'quantidade')::numeric(14,3) as quantidade
    from jsonb_array_elements(coalesce(p_insumos, '[]'::jsonb)) as value
  loop
    select * into v_insumo from public.insumos where id = v_item.insumo_id for update;
    if not found then
      raise exception 'Insumo não encontrado para estorno.' using errcode = 'P0002';
    end if;
    v_anterior := v_insumo.saldo_atual;
    v_posterior := v_anterior + v_item.quantidade;
    update public.insumos set saldo_atual = v_posterior where id = v_item.insumo_id;
    insert into public.insumo_movimentacoes (
      insumo_id, tipo, quantidade, saldo_anterior, saldo_posterior,
      producao_id, usuario_id
    ) values (
      v_item.insumo_id, 'estorno_apontamento', v_item.quantidade,
      v_anterior, v_posterior, p_producao_id, p_actor_id
    );
  end loop;
end;
$$;

create or replace function public.can_edit_producao_controlada(
  p_profile public.profiles,
  p_row public.producao
) returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return p_profile.role = 'admin'
    or p_row.registrado_por = p_profile.id
    or (
      p_profile.role = 'encarregado'
      and p_profile.equipe_id is not null
      and p_profile.equipe_id = p_row.equipe_id
      and p_row.data between public.current_cycle_start() and public.current_cycle_end()
    );
end;
$$;

create or replace function public.create_producao_with_stock(
  p_data date,
  p_equipe_id uuid,
  p_atividade_id uuid,
  p_projeto_id uuid,
  p_talhao text,
  p_quantidade numeric,
  p_descarte numeric,
  p_observacoes text,
  p_insumos jsonb,
  p_client_id text default null,
  p_origem_chave text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_profile public.profiles;
  v_atividade public.atividades;
  v_normalized jsonb;
  v_row public.producao;
begin
  if v_actor is null then
    raise exception 'Usuário não autenticado.' using errcode = '28000';
  end if;

  select * into v_profile from public.profiles where id = v_actor and ativo = true;
  if not found then
    raise exception 'Perfil inválido.' using errcode = '42501';
  end if;

  if p_origem_chave is not null then
    select * into v_row from public.producao where origem_chave = p_origem_chave;
    if found then
      return jsonb_build_object('item', to_jsonb(v_row), 'deduplicated', true);
    end if;
  end if;

  if p_equipe_id is null or p_atividade_id is null or p_projeto_id is null
     or nullif(trim(coalesce(p_talhao, '')), '') is null
     or p_quantidade is null or p_quantidade <= 0 then
    raise exception 'Campos obrigatórios faltando.' using errcode = '22023';
  end if;

  select * into v_atividade from public.atividades where id = p_atividade_id and ativo = true;
  if not found then
    raise exception 'Atividade inválida.' using errcode = '22023';
  end if;

  v_normalized := public.validate_and_lock_insumos(p_insumos);

  insert into public.producao (
    data, equipe_id, atividade_id, projeto_id, talhao, quantidade,
    insumos, descarte, observacoes, valor_unitario_snapshot, registrado_por,
    origem, origem_chave, import_metadata, estoque_controlado
  ) values (
    coalesce(p_data, current_date), p_equipe_id, p_atividade_id, p_projeto_id,
    trim(p_talhao), p_quantidade, v_normalized, p_descarte, p_observacoes,
    v_atividade.valor_unitario, v_actor,
    case when p_origem_chave is not null then 'gn-app' else null end,
    p_origem_chave,
    case when p_client_id is not null then jsonb_build_object('client_id', p_client_id) else '{}'::jsonb end,
    true
  )
  returning * into v_row;

  perform public.baixar_insumos_apontamento(v_row.id, v_normalized, v_actor);

  return jsonb_build_object('item', to_jsonb(v_row), 'deduplicated', false);
end;
$$;

create or replace function public.update_producao_with_stock(
  p_id uuid,
  p_data date,
  p_equipe_id uuid,
  p_atividade_id uuid,
  p_projeto_id uuid,
  p_talhao text,
  p_quantidade numeric,
  p_descarte numeric,
  p_observacoes text,
  p_insumos jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_profile public.profiles;
  v_before public.producao;
  v_after public.producao;
  v_atividade public.atividades;
  v_normalized jsonb;
begin
  if v_actor is null then
    raise exception 'Usuário não autenticado.' using errcode = '28000';
  end if;

  select * into v_profile from public.profiles where id = v_actor and ativo = true;
  if not found then
    raise exception 'Perfil inválido.' using errcode = '42501';
  end if;

  select * into v_before from public.producao where id = p_id for update;
  if not found then
    raise exception 'Apontamento não encontrado.' using errcode = 'P0002';
  end if;

  if v_before.estoque_controlado is not true then
    raise exception 'Apontamento legado não usa controle de estoque.' using errcode = '22023';
  end if;

  if not public.can_edit_producao_controlada(v_profile, v_before) then
    raise exception 'Sem permissão para editar este apontamento.' using errcode = '42501';
  end if;

  select * into v_atividade from public.atividades where id = p_atividade_id and ativo = true;
  if not found then
    raise exception 'Atividade inválida.' using errcode = '22023';
  end if;

  perform public.estornar_insumos_apontamento(p_id, v_before.insumos, v_actor);
  v_normalized := public.validate_and_lock_insumos(p_insumos);

  update public.producao
     set data = p_data,
         equipe_id = p_equipe_id,
         atividade_id = p_atividade_id,
         projeto_id = p_projeto_id,
         talhao = trim(p_talhao),
         quantidade = p_quantidade,
         descarte = p_descarte,
         observacoes = p_observacoes,
         insumos = v_normalized,
         valor_unitario_snapshot = v_atividade.valor_unitario,
         editado_por = v_actor,
         estoque_controlado = true
   where id = p_id
   returning * into v_after;

  perform public.baixar_insumos_apontamento(p_id, v_normalized, v_actor);

  return jsonb_build_object('item', to_jsonb(v_after));
end;
$$;

create or replace function public.delete_producao_with_stock(
  p_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_profile public.profiles;
  v_before public.producao;
begin
  if v_actor is null then
    raise exception 'Usuário não autenticado.' using errcode = '28000';
  end if;

  select * into v_profile from public.profiles where id = v_actor and ativo = true;
  if not found or v_profile.role <> 'admin' then
    raise exception 'Apenas admin pode excluir apontamentos.' using errcode = '42501';
  end if;

  select * into v_before from public.producao where id = p_id for update;
  if not found then
    raise exception 'Apontamento não encontrado.' using errcode = 'P0002';
  end if;

  if v_before.estoque_controlado is true then
    perform public.estornar_insumos_apontamento(p_id, v_before.insumos, v_actor);
  end if;

  delete from public.producao where id = p_id;
  return jsonb_build_object('item', to_jsonb(v_before));
end;
$$;

revoke all on function public.registrar_movimentacao_insumo(uuid, text, numeric, text) from public;
revoke all on function public.validate_and_lock_insumos(jsonb) from public;
revoke all on function public.baixar_insumos_apontamento(uuid, jsonb, uuid) from public;
revoke all on function public.estornar_insumos_apontamento(uuid, jsonb, uuid) from public;
revoke all on function public.can_edit_producao_controlada(public.profiles, public.producao) from public;
revoke all on function public.create_producao_with_stock(date, uuid, uuid, uuid, text, numeric, numeric, text, jsonb, text, text) from public;
revoke all on function public.update_producao_with_stock(uuid, date, uuid, uuid, uuid, text, numeric, numeric, text, jsonb) from public;
revoke all on function public.delete_producao_with_stock(uuid) from public;

grant execute on function public.registrar_movimentacao_insumo(uuid, text, numeric, text) to authenticated;
grant execute on function public.create_producao_with_stock(date, uuid, uuid, uuid, text, numeric, numeric, text, jsonb, text, text) to authenticated;
grant execute on function public.update_producao_with_stock(uuid, date, uuid, uuid, uuid, text, numeric, numeric, text, jsonb) to authenticated;
grant execute on function public.delete_producao_with_stock(uuid) to authenticated;

with src(codigo, nome, grupo, unidade) as (
  values
    ('90000746', 'HERBICIDA SUNWARD 5KG', 'Herbicida', 'un'),
    ('90000748', 'HERBICIDA WG 720 POS EMERGENTE ZAPP 20KG', 'Herbicida', 'un'),
    ('90000749', 'HERBICIDA DISTINTOBR 5KG', 'Herbicida', 'un'),
    ('90000750', 'HERBICIDA PONTEIROBR 20L', 'Herbicida', 'un'),
    ('90000751', 'HERBICIDA PALMERO 1KG', 'Herbicida', 'un'),
    ('90000754', 'FINALE HERBICIDA GALAO 10L', 'Herbicida', 'un'),
    ('90000762', 'HERBICIDA SOLDIER', 'Herbicida', 'un'),
    ('90000768', 'HERBICIDA PRE EMERGENTE BLOCK 20LT', 'Herbicida', 'un'),
    ('90000769', 'HERBICIDA POS EMERGENTE AGILE 5L', 'Herbicida', 'un'),
    ('90000775', 'HERBICIDA SUMYZIN 1KG', 'Herbicida', 'un'),
    ('90000776', 'HERBICIDA TOPINAM 20L', 'Herbicida', 'un'),
    ('90000779', 'HERBICIDA OSBAR 5KG', 'Herbicida', 'un'),
    ('90000780', 'HERBICIDA FALCON 20L', 'Herbicida', 'un'),
    ('90000789', 'HERBICIDA PRE EMERGENTE GOAL 20LT', 'Herbicida', 'un'),
    ('90000790', 'HERBICIDA POS EMERGENTE SECTOR 20LT', 'Herbicida', 'un'),
    ('90000791', 'HERBICIDA POS EMERGENTE OUTLINER 20LT', 'Herbicida', 'un'),
    ('90000792', 'HERBICIDA PRE EMERGENTE SOLARA 20L', 'Herbicida', 'un'),
    ('90000793', 'HERBICIDA POS EMERGENTE VALEOS 0.350KG', 'Herbicida', 'un'),
    ('90000801', 'HERBICIDA POS EMERGENTE SCOUT 5KG', 'Herbicida', 'un'),
    ('90000815', 'HERBICIDA PRE EMERGENTE ESPLANADE 1L', 'Herbicida', 'un'),
    ('90000846', 'HERBICIDA FORDOR FLEX 1KG', 'Herbicida', 'un'),
    ('90000852', 'HERBICIDA PRE EMERGENTE FLUMYZIN 500 5L', 'Herbicida', 'un'),
    ('90000991', 'HERBICIDA TRICLOPIR PERTERRA', 'Herbicida', 'un'),
    (null, 'OLEO MINERAL CONCENTRADO EMULSIONADO', 'Operacional', 'un'),
    (null, 'INSETICIDA PREZ', 'Operacional', 'un'),
    (null, 'FIPRONIL PIRAZOL', 'Operacional', 'un'),
    (null, 'GEL', 'Operacional', 'un'),
    (null, 'ATTAMEX-S', 'Operacional', 'un'),
    (null, 'PLEDGE', 'Operacional', 'un'),
    (null, 'MAP', 'Operacional', 'un'),
    (null, 'FORMICIDA PO SULFURAMID ATTA-KILL/MIREX', 'Formicida', 'un'),
    (null, 'FORMICIDA ISCA DINAGRO S 5KG', 'Formicida', 'un'),
    (null, 'Adubo 16-6-20', 'Adubo', 'un'),
    (null, 'CO1058', 'Clone', 'un'),
    (null, 'CO1572', 'Clone', 'un'),
    (null, 'AECO144', 'Clone', 'un'),
    (null, 'SUZA', 'Clone', 'un')
)
insert into public.insumos (codigo, nome, grupo, unidade)
select codigo, nome, grupo, unidade
from src
where not exists (
  select 1
  from public.insumos i
  where (src.codigo is not null and i.codigo is not null and lower(trim(i.codigo)) = lower(trim(src.codigo)))
     or lower(trim(i.nome)) = lower(trim(src.nome))
);

select
  count(*) as insumos_cadastrados,
  coalesce(sum(saldo_atual), 0) as saldo_total
from public.insumos;

-- Phase 3/3 of the multi-tenant rollout.
-- Harden every stock/production security-definer RPC with an explicit tenant
-- boundary. These checks are intentionally duplicated at the RPC boundary and
-- in triggers/RLS so a future refactor cannot silently bypass isolation.

begin;

create or replace function private.require_active_organization(
  p_roles text[] default null
)
returns uuid
language plpgsql
stable
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_actor uuid := (select auth.uid());
  v_organization_id uuid;
begin
  if v_actor is null then
    raise exception 'Usuário não autenticado.' using errcode = '28000';
  end if;

  v_organization_id := private.current_organization_id();
  if v_organization_id is null
     or not private.organization_is_accessible(v_organization_id)
     or not private.has_organization_role(v_organization_id, p_roles) then
    raise exception 'Acesso à organização negado.' using errcode = '42501';
  end if;

  return v_organization_id;
end;
$$;

revoke all on function private.require_active_organization(text[])
  from public, anon, authenticated;
grant execute on function private.require_active_organization(text[])
  to authenticated, service_role;

create or replace function private.enforce_organization_user_limit()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_limit integer;
  v_active_count integer;
begin
  if new.active is not true then return new; end if;

  select user_limit into v_limit
  from public.organizations
  where id = new.organization_id
  for update;
  if not found then
    raise exception 'Organização não encontrada.' using errcode = '23503';
  end if;

  select count(*) into v_active_count
  from public.organization_members m
  where m.organization_id = new.organization_id
    and m.active is true
    and m.user_id <> new.user_id;
  if v_active_count >= v_limit then
    raise exception 'Limite de usuários ativos da organização atingido.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function private.enforce_organization_user_limit()
  from public, anon, authenticated;
drop trigger if exists enforce_organization_user_limit
  on public.organization_members;
create trigger enforce_organization_user_limit
before insert or update of active, organization_id
on public.organization_members
for each row execute function private.enforce_organization_user_limit();

create or replace function private.preserve_last_organization_admin()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_remaining integer;
  v_removes_admin boolean;
begin
  v_removes_admin := old.active is true
    and old.role = 'admin'
    and (
      tg_op = 'DELETE'
      or new.active is false
      or new.role <> 'admin'
      or new.organization_id <> old.organization_id
    );
  if not v_removes_admin then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  -- Allow an intentional organization cascade; otherwise serialize changes
  -- and guarantee that every live customer keeps an active administrator.
  perform 1 from public.organizations where id = old.organization_id for update;
  if not found then return case when tg_op = 'DELETE' then old else new end; end if;

  select count(*) into v_remaining
  from public.organization_members m
  where m.organization_id = old.organization_id
    and m.user_id <> old.user_id
    and m.role = 'admin'
    and m.active is true;
  if v_remaining = 0 then
    raise exception 'A organização precisa manter um administrador ativo.'
      using errcode = '23514';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function private.preserve_last_organization_admin()
  from public, anon, authenticated;
drop trigger if exists preserve_last_organization_admin
  on public.organization_members;
create trigger preserve_last_organization_admin
before update of role, active, organization_id or delete
on public.organization_members
for each row execute function private.preserve_last_organization_admin();

create or replace function public.switch_active_organization(
  p_organization_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_actor uuid := (select auth.uid());
begin
  if v_actor is null then
    raise exception 'Usuário não autenticado.' using errcode = '28000';
  end if;
  if not private.organization_is_accessible(p_organization_id)
     or not exists (
       select 1 from public.organization_members m
       where m.organization_id = p_organization_id
         and m.user_id = v_actor
         and m.active is true
     ) then
    raise exception 'Organização indisponível.' using errcode = '42501';
  end if;
  update public.profiles
  set active_organization_id = p_organization_id
  where id = v_actor and ativo is true;
  if not found then
    raise exception 'Perfil inválido.' using errcode = '42501';
  end if;
  return p_organization_id;
end;
$$;

revoke all on function public.switch_active_organization(uuid)
  from public, anon, authenticated;
grant execute on function public.switch_active_organization(uuid)
  to authenticated;

create or replace function public.registrar_movimentacao_insumo(
  p_insumo_id uuid,
  p_tipo text,
  p_quantidade numeric,
  p_observacoes text default null
) returns public.insumos
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_actor uuid := (select auth.uid());
  v_organization_id uuid := private.require_active_organization(array['admin']);
  v_insumo public.insumos;
  v_anterior numeric(14,3);
  v_posterior numeric(14,3);
begin
  if p_tipo not in ('entrada', 'ajuste') then
    raise exception 'Tipo de movimentação inválido.' using errcode = '22023';
  end if;
  if p_quantidade is null or p_quantidade = 0 then
    raise exception 'Quantidade inválida.' using errcode = '22023';
  end if;
  if p_tipo = 'entrada' and p_quantidade <= 0 then
    raise exception 'Entrada deve ter quantidade positiva.' using errcode = '22023';
  end if;

  select * into v_insumo
  from public.insumos
  where id = p_insumo_id
    and organization_id = v_organization_id
  for update;
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
     and organization_id = v_organization_id
   returning * into v_insumo;

  insert into public.insumo_movimentacoes (
    organization_id, insumo_id, tipo, quantidade, saldo_anterior,
    saldo_posterior, usuario_id, observacoes
  ) values (
    v_organization_id, p_insumo_id, p_tipo, p_quantidade, v_anterior,
    v_posterior, v_actor, p_observacoes
  );

  return v_insumo;
end;
$$;

create or replace function public.baixar_insumos_apontamento(
  p_producao_id uuid,
  p_insumos jsonb,
  p_actor_id uuid
) returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_item record;
  v_insumo public.insumos;
  v_organization_id uuid := private.require_active_organization();
  v_anterior numeric(14,3);
  v_posterior numeric(14,3);
begin
  if p_actor_id is distinct from (select auth.uid()) then
    raise exception 'Ator inválido.' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.producao
    where id = p_producao_id and organization_id = v_organization_id
  ) then
    raise exception 'Apontamento não encontrado.' using errcode = 'P0002';
  end if;

  for v_item in
    select
      (value ->> 'insumo_id')::uuid insumo_id,
      (value ->> 'quantidade')::numeric(14,3) quantidade
    from jsonb_array_elements(coalesce(p_insumos, '[]'::jsonb)) value
  loop
    select * into v_insumo
    from public.insumos
    where id = v_item.insumo_id
      and organization_id = v_organization_id
    for update;
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
    update public.insumos
      set saldo_atual = v_posterior
      where id = v_item.insumo_id and organization_id = v_organization_id;
    insert into public.insumo_movimentacoes (
      organization_id, insumo_id, tipo, quantidade, saldo_anterior,
      saldo_posterior, producao_id, usuario_id
    ) values (
      v_organization_id, v_item.insumo_id, 'saida_apontamento',
      -v_item.quantidade, v_anterior, v_posterior, p_producao_id, p_actor_id
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
set search_path = public, private, pg_temp
as $$
declare
  v_item record;
  v_insumo public.insumos;
  v_organization_id uuid := private.require_active_organization();
  v_anterior numeric(14,3);
  v_posterior numeric(14,3);
begin
  if p_actor_id is distinct from (select auth.uid()) then
    raise exception 'Ator inválido.' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.producao
    where id = p_producao_id and organization_id = v_organization_id
  ) then
    raise exception 'Apontamento não encontrado.' using errcode = 'P0002';
  end if;

  for v_item in
    select
      (value ->> 'insumo_id')::uuid insumo_id,
      (value ->> 'quantidade')::numeric(14,3) quantidade
    from jsonb_array_elements(coalesce(p_insumos, '[]'::jsonb)) value
  loop
    select * into v_insumo
    from public.insumos
    where id = v_item.insumo_id
      and organization_id = v_organization_id
    for update;
    if not found then
      raise exception 'Insumo não encontrado para estorno.' using errcode = 'P0002';
    end if;

    v_anterior := v_insumo.saldo_atual;
    v_posterior := v_anterior + v_item.quantidade;
    update public.insumos
      set saldo_atual = v_posterior
      where id = v_item.insumo_id and organization_id = v_organization_id;
    insert into public.insumo_movimentacoes (
      organization_id, insumo_id, tipo, quantidade, saldo_anterior,
      saldo_posterior, producao_id, usuario_id
    ) values (
      v_organization_id, v_item.insumo_id, 'estorno_apontamento',
      v_item.quantidade, v_anterior, v_posterior, p_producao_id, p_actor_id
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
set search_path = public, private, pg_temp
as $$
declare
  v_membership public.organization_members;
begin
  if p_profile.id is distinct from (select auth.uid())
     or p_row.organization_id is distinct from private.current_organization_id()
     or not private.organization_is_accessible(p_row.organization_id) then
    return false;
  end if;

  select * into v_membership
  from public.organization_members
  where organization_id = p_row.organization_id
    and user_id = p_profile.id
    and active is true;
  if not found then return false; end if;

  return v_membership.role = 'admin'
    or p_row.registrado_por = p_profile.id
    or (
      v_membership.role = 'encarregado'
      and v_membership.equipe_id is not null
      and v_membership.equipe_id = p_row.equipe_id
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
set search_path = public, private, pg_temp
as $$
declare
  v_actor uuid := (select auth.uid());
  v_organization_id uuid := private.require_active_organization(array['admin', 'encarregado']);
  v_atividade public.atividades;
  v_normalized jsonb;
  v_row public.producao;
begin
  if p_origem_chave is not null then
    select * into v_row
    from public.producao
    where organization_id = v_organization_id
      and origem_chave = p_origem_chave;
    if found then
      return jsonb_build_object('item', to_jsonb(v_row), 'deduplicated', true);
    end if;
  end if;

  if p_equipe_id is null or p_atividade_id is null or p_projeto_id is null
     or nullif(trim(coalesce(p_talhao, '')), '') is null
     or p_quantidade is null or p_quantidade <= 0 then
    raise exception 'Campos obrigatórios faltando.' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.equipes
    where id = p_equipe_id and organization_id = v_organization_id and ativo is true
  ) then
    raise exception 'Equipe inválida.' using errcode = '22023';
  end if;
  select * into v_atividade
  from public.atividades
  where id = p_atividade_id and organization_id = v_organization_id and ativo is true;
  if not found then
    raise exception 'Atividade inválida.' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.projetos
    where id = p_projeto_id and organization_id = v_organization_id and ativo is true
  ) then
    raise exception 'Projeto inválido.' using errcode = '22023';
  end if;

  v_normalized := public.validate_and_lock_insumos(p_insumos);

  insert into public.producao (
    organization_id, data, equipe_id, atividade_id, projeto_id, talhao,
    quantidade, insumos, descarte, observacoes, valor_unitario_snapshot,
    registrado_por, origem, origem_chave, import_metadata, estoque_controlado
  ) values (
    v_organization_id, coalesce(p_data, current_date), p_equipe_id,
    p_atividade_id, p_projeto_id, trim(p_talhao), p_quantidade,
    v_normalized, p_descarte, p_observacoes, v_atividade.valor_unitario,
    v_actor, case when p_origem_chave is not null then 'app' else null end,
    p_origem_chave,
    case when p_client_id is not null
      then jsonb_build_object('client_id', p_client_id)
      else '{}'::jsonb
    end,
    true
  ) returning * into v_row;

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
set search_path = public, private, pg_temp
as $$
declare
  v_actor uuid := (select auth.uid());
  v_organization_id uuid := private.require_active_organization();
  v_profile public.profiles;
  v_before public.producao;
  v_after public.producao;
  v_atividade public.atividades;
  v_normalized jsonb;
begin
  select * into v_profile
  from public.profiles where id = v_actor and ativo is true;
  if not found then
    raise exception 'Perfil inválido.' using errcode = '42501';
  end if;

  select * into v_before
  from public.producao
  where id = p_id and organization_id = v_organization_id
  for update;
  if not found then
    raise exception 'Apontamento não encontrado.' using errcode = 'P0002';
  end if;
  if v_before.estoque_controlado is not true then
    raise exception 'Apontamento legado não usa controle de estoque.' using errcode = '22023';
  end if;
  if not public.can_edit_producao_controlada(v_profile, v_before) then
    raise exception 'Sem permissão para editar este apontamento.' using errcode = '42501';
  end if;
  if p_data is null or p_equipe_id is null or p_atividade_id is null
     or p_projeto_id is null or nullif(trim(coalesce(p_talhao, '')), '') is null
     or p_quantidade is null or p_quantidade <= 0 then
    raise exception 'Campos obrigatórios faltando.' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.equipes
    where id = p_equipe_id and organization_id = v_organization_id and ativo is true
  ) then
    raise exception 'Equipe inválida.' using errcode = '22023';
  end if;
  select * into v_atividade
  from public.atividades
  where id = p_atividade_id and organization_id = v_organization_id and ativo is true;
  if not found then
    raise exception 'Atividade inválida.' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.projetos
    where id = p_projeto_id and organization_id = v_organization_id and ativo is true
  ) then
    raise exception 'Projeto inválido.' using errcode = '22023';
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
   where id = p_id and organization_id = v_organization_id
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
set search_path = public, private, pg_temp
as $$
declare
  v_actor uuid := (select auth.uid());
  v_organization_id uuid := private.require_active_organization(array['admin']);
  v_before public.producao;
begin
  select * into v_before
  from public.producao
  where id = p_id and organization_id = v_organization_id
  for update;
  if not found then
    raise exception 'Apontamento não encontrado.' using errcode = 'P0002';
  end if;

  if v_before.estoque_controlado is true then
    perform public.estornar_insumos_apontamento(p_id, v_before.insumos, v_actor);
  end if;
  delete from public.producao
  where id = p_id and organization_id = v_organization_id;
  return jsonb_build_object('item', to_jsonb(v_before));
end;
$$;

revoke all on function public.registrar_movimentacao_insumo(uuid, text, numeric, text)
  from public, anon, authenticated;
revoke all on function public.baixar_insumos_apontamento(uuid, jsonb, uuid)
  from public, anon, authenticated;
revoke all on function public.estornar_insumos_apontamento(uuid, jsonb, uuid)
  from public, anon, authenticated;
revoke all on function public.can_edit_producao_controlada(public.profiles, public.producao)
  from public, anon, authenticated;
revoke all on function public.create_producao_with_stock(date, uuid, uuid, uuid, text, numeric, numeric, text, jsonb, text, text)
  from public, anon, authenticated;
revoke all on function public.update_producao_with_stock(uuid, date, uuid, uuid, uuid, text, numeric, numeric, text, jsonb)
  from public, anon, authenticated;
revoke all on function public.delete_producao_with_stock(uuid)
  from public, anon, authenticated;

grant execute on function public.registrar_movimentacao_insumo(uuid, text, numeric, text)
  to authenticated, service_role;
grant execute on function public.create_producao_with_stock(date, uuid, uuid, uuid, text, numeric, numeric, text, jsonb, text, text)
  to authenticated, service_role;
grant execute on function public.update_producao_with_stock(uuid, date, uuid, uuid, uuid, text, numeric, numeric, text, jsonb)
  to authenticated, service_role;
grant execute on function public.delete_producao_with_stock(uuid)
  to authenticated, service_role;

commit;

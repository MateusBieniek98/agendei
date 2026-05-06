-- GN · habilita alteração segura de status de máquinas
--
-- Rode no Supabase SQL Editor. Necessário para encarregado alterar status
-- ao reportar problema ou pela lista da frota.

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

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

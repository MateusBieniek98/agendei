create or replace function public.maintenance_action(
  p_manutencao_id uuid,
  p_action text,
  p_responsavel_id uuid default null,
  p_prioridade public.maintenance_priority default null,
  p_relato_conclusao text default null,
  p_machine_status public.machine_status default null
) returns public.manutencoes
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_role text;
  v_manut public.manutencoes;
  v_responsavel_nome text;
begin
  if v_actor is null then
    raise exception 'unauthenticated';
  end if;

  select role::text into v_role
  from public.profiles
  where id = v_actor and ativo is true;

  if v_role not in ('admin', 'manutencao') then
    raise exception 'forbidden';
  end if;

  select * into v_manut
  from public.manutencoes
  where id = p_manutencao_id
  for update;

  if v_manut.id is null then
    raise exception 'maintenance_not_found';
  end if;

  if p_action = 'priorizar' then
    if v_manut.status = 'resolvido' or p_prioridade is null then
      raise exception 'invalid_priority_change';
    end if;
    update public.manutencoes set prioridade = p_prioridade
    where id = p_manutencao_id returning * into v_manut;
    insert into public.manutencao_eventos (manutencao_id, maquina_id, tipo, ator_id, dados)
    values (v_manut.id, v_manut.maquina_id, 'prioridade_alterada', v_actor,
      jsonb_build_object('prioridade', p_prioridade));

  elsif p_action = 'atribuir' then
    if v_manut.status = 'resolvido' or p_responsavel_id is null then
      raise exception 'invalid_assignment';
    end if;
    select nome into v_responsavel_nome from public.profiles
    where id = p_responsavel_id and ativo is true and role::text = 'manutencao';
    if v_responsavel_nome is null then
      raise exception 'invalid_technician';
    end if;
    update public.manutencoes set responsavel_id = p_responsavel_id
    where id = p_manutencao_id returning * into v_manut;
    insert into public.manutencao_eventos (manutencao_id, maquina_id, tipo, ator_id, dados)
    values (v_manut.id, v_manut.maquina_id, 'atribuido', v_actor,
      jsonb_build_object('responsavel_id', p_responsavel_id, 'responsavel_nome', v_responsavel_nome));

  elsif p_action = 'assumir' then
    if v_role <> 'manutencao' or v_manut.status = 'resolvido' then
      raise exception 'invalid_claim';
    end if;
    update public.manutencoes
    set responsavel_id = v_actor,
        status = 'em_andamento',
        iniciado_em = coalesce(iniciado_em, now())
    where id = p_manutencao_id returning * into v_manut;
    insert into public.manutencao_eventos (manutencao_id, maquina_id, tipo, ator_id, dados)
    values (v_manut.id, v_manut.maquina_id, 'atribuido', v_actor,
      jsonb_build_object('responsavel_id', v_actor));
    insert into public.manutencao_eventos (manutencao_id, maquina_id, tipo, ator_id, dados)
    values (v_manut.id, v_manut.maquina_id, 'iniciado', v_actor, '{}'::jsonb);

  elsif p_action = 'iniciar' then
    if v_manut.status <> 'aberto' or v_manut.responsavel_id is null then
      raise exception 'invalid_start';
    end if;
    if v_role = 'manutencao' and v_manut.responsavel_id <> v_actor then
      raise exception 'not_assigned_technician';
    end if;
    update public.manutencoes
    set status = 'em_andamento', iniciado_em = coalesce(iniciado_em, now())
    where id = p_manutencao_id returning * into v_manut;
    insert into public.manutencao_eventos (manutencao_id, maquina_id, tipo, ator_id, dados)
    values (v_manut.id, v_manut.maquina_id, 'iniciado', v_actor, '{}'::jsonb);

  elsif p_action = 'concluir' then
    if v_manut.status <> 'em_andamento'
      or char_length(trim(coalesce(p_relato_conclusao, ''))) < 3
      or p_machine_status is null then
      raise exception 'invalid_completion';
    end if;
    if v_role = 'manutencao' and v_manut.responsavel_id <> v_actor then
      raise exception 'not_assigned_technician';
    end if;
    update public.manutencoes
    set status = 'resolvido',
        resolvido_em = now(),
        concluido_por = v_actor,
        relato_conclusao = trim(p_relato_conclusao)
    where id = p_manutencao_id returning * into v_manut;
    insert into public.manutencao_eventos (manutencao_id, maquina_id, tipo, ator_id, dados)
    values (v_manut.id, v_manut.maquina_id, 'concluido', v_actor,
      jsonb_build_object('status_maquina', p_machine_status));
    update public.maquinas set status = p_machine_status
    where id = v_manut.maquina_id;

  else
    raise exception 'invalid_action';
  end if;

  return v_manut;
end;
$$;

revoke all on function public.maintenance_action(
  uuid, text, uuid, public.maintenance_priority, text, public.machine_status
) from public, anon;
grant execute on function public.maintenance_action(
  uuid, text, uuid, public.maintenance_priority, text, public.machine_status
) to authenticated, service_role;

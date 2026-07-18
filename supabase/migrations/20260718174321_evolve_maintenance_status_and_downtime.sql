-- Detailed maintenance status, auditable updates and machine downtime.

alter table public.manutencoes
  add column if not exists situacao_atual text,
  add column if not exists situacao_atualizada_em timestamptz,
  add column if not exists parada_desde timestamptz,
  add column if not exists parada_ate timestamptz;

update public.manutencoes
set
  situacao_atual = case status::text
    when 'resolvido' then 'Resolvido'
    when 'em_andamento' then 'Manutenção em atendimento'
    else 'Aguardando manutenção'
  end,
  situacao_atualizada_em = coalesce(resolvido_em, iniciado_em, created_at),
  parada_desde = created_at,
  parada_ate = case when status::text = 'resolvido' then resolvido_em else null end
where situacao_atual is null
   or situacao_atualizada_em is null
   or parada_desde is null;

alter table public.manutencoes
  alter column situacao_atual set default 'Aguardando manutenção',
  alter column situacao_atual set not null,
  alter column situacao_atualizada_em set default now(),
  alter column situacao_atualizada_em set not null,
  alter column parada_desde set default now(),
  alter column parada_desde set not null;

alter table public.manutencoes
  drop constraint if exists manutencoes_situacao_atual_check,
  add constraint manutencoes_situacao_atual_check
    check (char_length(trim(situacao_atual)) between 3 and 500),
  drop constraint if exists manutencoes_periodo_parada_check,
  add constraint manutencoes_periodo_parada_check
    check (parada_ate is null or parada_ate >= parada_desde);

create index if not exists idx_manutencoes_status_parada
  on public.manutencoes (status, parada_desde);

create unique index if not exists idx_manutencoes_maquina_pendente_unique
  on public.manutencoes (maquina_id)
  where status <> 'resolvido';

alter table public.manutencao_eventos
  drop constraint if exists manutencao_eventos_tipo_check;
alter table public.manutencao_eventos
  add constraint manutencao_eventos_tipo_check check (tipo in (
    'criado', 'atribuido', 'iniciado', 'prioridade_alterada',
    'concluido', 'status_maquina_alterado', 'situacao_atualizada'
  ));

create or replace function public.record_new_maintenance_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.manutencao_eventos (
    manutencao_id, maquina_id, tipo, ator_id, dados
  ) values (
    new.id,
    new.maquina_id,
    'criado',
    new.reportado_por,
    jsonb_build_object(
      'status', new.status,
      'situacao_atual', new.situacao_atual,
      'parada_desde', new.parada_desde
    )
  );
  return new;
end;
$$;

create or replace function public.update_maintenance_situation(
  p_manutencao_id uuid,
  p_situacao text
) returns public.manutencoes
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_role text;
  v_manut public.manutencoes;
  v_anterior text;
  v_situacao text := trim(coalesce(p_situacao, ''));
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
  if char_length(v_situacao) not between 3 and 500 then
    raise exception 'invalid_current_situation';
  end if;

  select * into v_manut
  from public.manutencoes
  where id = p_manutencao_id
  for update;

  if v_manut.id is null then
    raise exception 'maintenance_not_found';
  end if;
  if v_manut.status = 'resolvido' then
    raise exception 'maintenance_already_resolved';
  end if;

  v_anterior := v_manut.situacao_atual;
  update public.manutencoes
  set situacao_atual = v_situacao,
      situacao_atualizada_em = now()
  where id = p_manutencao_id
  returning * into v_manut;

  insert into public.manutencao_eventos (
    manutencao_id, maquina_id, tipo, ator_id, dados
  ) values (
    v_manut.id,
    v_manut.maquina_id,
    'situacao_atualizada',
    v_actor,
    jsonb_build_object('anterior', v_anterior, 'novo', v_situacao)
  );

  return v_manut;
end;
$$;

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
  v_situacao_anterior text;
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
    v_situacao_anterior := v_manut.situacao_atual;
    update public.manutencoes
    set responsavel_id = v_actor,
        status = 'em_andamento',
        iniciado_em = coalesce(iniciado_em, now()),
        situacao_atual = 'Manutenção em atendimento',
        situacao_atualizada_em = now()
    where id = p_manutencao_id returning * into v_manut;
    insert into public.manutencao_eventos (manutencao_id, maquina_id, tipo, ator_id, dados)
    values (v_manut.id, v_manut.maquina_id, 'atribuido', v_actor,
      jsonb_build_object('responsavel_id', v_actor));
    insert into public.manutencao_eventos (manutencao_id, maquina_id, tipo, ator_id, dados)
    values (v_manut.id, v_manut.maquina_id, 'iniciado', v_actor, '{}'::jsonb);
    insert into public.manutencao_eventos (manutencao_id, maquina_id, tipo, ator_id, dados)
    values (v_manut.id, v_manut.maquina_id, 'situacao_atualizada', v_actor,
      jsonb_build_object('anterior', v_situacao_anterior, 'novo', v_manut.situacao_atual));

  elsif p_action = 'iniciar' then
    if v_manut.status <> 'aberto' or v_manut.responsavel_id is null then
      raise exception 'invalid_start';
    end if;
    if v_role = 'manutencao' and v_manut.responsavel_id <> v_actor then
      raise exception 'not_assigned_technician';
    end if;
    v_situacao_anterior := v_manut.situacao_atual;
    update public.manutencoes
    set status = 'em_andamento',
        iniciado_em = coalesce(iniciado_em, now()),
        situacao_atual = 'Manutenção em atendimento',
        situacao_atualizada_em = now()
    where id = p_manutencao_id returning * into v_manut;
    insert into public.manutencao_eventos (manutencao_id, maquina_id, tipo, ator_id, dados)
    values (v_manut.id, v_manut.maquina_id, 'iniciado', v_actor, '{}'::jsonb);
    insert into public.manutencao_eventos (manutencao_id, maquina_id, tipo, ator_id, dados)
    values (v_manut.id, v_manut.maquina_id, 'situacao_atualizada', v_actor,
      jsonb_build_object('anterior', v_situacao_anterior, 'novo', v_manut.situacao_atual));

  elsif p_action = 'concluir' then
    if v_manut.status <> 'em_andamento'
      or char_length(trim(coalesce(p_relato_conclusao, ''))) < 3
      or p_machine_status is null then
      raise exception 'invalid_completion';
    end if;
    if v_role = 'manutencao' and v_manut.responsavel_id <> v_actor then
      raise exception 'not_assigned_technician';
    end if;
    v_situacao_anterior := v_manut.situacao_atual;
    update public.manutencoes
    set status = 'resolvido',
        resolvido_em = now(),
        concluido_por = v_actor,
        relato_conclusao = trim(p_relato_conclusao),
        situacao_atual = 'Resolvido',
        situacao_atualizada_em = now(),
        parada_ate = now()
    where id = p_manutencao_id returning * into v_manut;
    insert into public.manutencao_eventos (manutencao_id, maquina_id, tipo, ator_id, dados)
    values (v_manut.id, v_manut.maquina_id, 'situacao_atualizada', v_actor,
      jsonb_build_object('anterior', v_situacao_anterior, 'novo', v_manut.situacao_atual));
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

revoke all on function public.record_new_maintenance_event() from public, anon, authenticated;
revoke all on function public.update_maintenance_situation(uuid, text) from public, anon, authenticated;
revoke all on function public.maintenance_action(
  uuid, text, uuid, public.maintenance_priority, text, public.machine_status
) from public, anon;

grant execute on function public.update_maintenance_situation(uuid, text)
  to authenticated, service_role;
grant execute on function public.maintenance_action(
  uuid, text, uuid, public.maintenance_priority, text, public.machine_status
) to authenticated, service_role;

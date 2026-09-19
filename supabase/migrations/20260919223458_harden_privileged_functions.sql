-- Keep the privileged implementation outside the exposed public schema. The
-- public RPC below is the only supported entry point for Data API callers.
create or replace function private.sync_planejamento_progress(
  p_projeto_id uuid,
  p_talhao text,
  p_atividade_id uuid
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_projeto_nome text;
  v_atividade_nome text;
begin
  if p_projeto_id is null or p_talhao is null or p_atividade_id is null then
    return;
  end if;

  select nome
    into v_projeto_nome
    from public.projetos
   where id = p_projeto_id;

  select nome
    into v_atividade_nome
    from public.atividades
   where id = p_atividade_id;

  with alvo as (
    select
      pl.id,
      coalesce(pl.quantidade_prevista, 0)::numeric as previsto,
      coalesce(sum(p.quantidade), 0)::numeric as produzido
    from public.planejamento pl
    join public.projetos pl_proj on pl_proj.id = pl.projeto_id
    join public.atividades pl_ativ on pl_ativ.id = pl.atividade_id
    left join public.producao p
      on (
        p.projeto_id = pl.projeto_id
        or exists (
          select 1
          from public.projetos p_proj
          where p_proj.id = p.projeto_id
            and public.normalize_planejamento_projeto(p_proj.nome) =
                public.normalize_planejamento_projeto(pl_proj.nome)
        )
      )
     and (
        p.atividade_id = pl.atividade_id
        or exists (
          select 1
          from public.atividades p_ativ
          where p_ativ.id = p.atividade_id
            and public.normalize_planejamento_text(p_ativ.nome) =
                public.normalize_planejamento_text(pl_ativ.nome)
        )
      )
     and (
       (pl.talhao_id is not null and p.talhao_id = pl.talhao_id)
       or (
         (pl.talhao_id is null or p.talhao_id is null)
         and lower(trim(p.talhao)) = lower(trim(pl.talhao))
       )
     )
    where (
        pl.projeto_id = p_projeto_id
        or public.normalize_planejamento_projeto(pl_proj.nome) =
           public.normalize_planejamento_projeto(v_projeto_nome)
      )
      and (
        pl.atividade_id = p_atividade_id
        or public.normalize_planejamento_text(pl_ativ.nome) =
           public.normalize_planejamento_text(v_atividade_nome)
      )
      and lower(trim(pl.talhao)) = lower(trim(p_talhao))
      and pl.status not in ('concluido', 'cancelado')
    group by pl.id, pl.quantidade_prevista
  )
  update public.planejamento pl
     set status = case
         when alvo.previsto > 0 and alvo.produzido >= alvo.previsto
           then 'concluido'::public.planning_status
         when alvo.produzido > 0
           then 'em_execucao'::public.planning_status
         else 'planejado'::public.planning_status
       end,
       updated_at = now()
    from alvo
   where pl.id = alvo.id;
end;
$$;

revoke all on function private.sync_planejamento_progress(uuid, text, uuid)
  from public, anon, authenticated, service_role;

-- This wrapper remains an authenticated business RPC for compatibility. It
-- rejects requests without a service token or an active application profile.
create or replace function public.sync_planejamento_progress(
  p_projeto_id uuid,
  p_talhao text,
  p_atividade_id uuid
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_jwt_role text := coalesce(auth.jwt() ->> 'role', '');
begin
  if v_jwt_role <> 'service_role' then
    if v_actor is null then
      raise exception 'Usuario nao autenticado.' using errcode = '28000';
    end if;

    if not exists (
      select 1
      from public.profiles
      where id = v_actor
        and ativo = true
    ) then
      raise exception 'Perfil inativo ou inexistente.' using errcode = '42501';
    end if;
  end if;

  perform private.sync_planejamento_progress(
    p_projeto_id,
    p_talhao,
    p_atividade_id
  );
end;
$$;

revoke all on function public.sync_planejamento_progress(uuid, text, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.sync_planejamento_progress(uuid, text, uuid)
  to authenticated, service_role;

-- Production mutations use the private implementation directly. The trigger
-- cannot be invoked through PostgREST and does not depend on a request JWT.
create or replace function public.sync_planejamento_progress_after_producao()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform private.sync_planejamento_progress(
      old.projeto_id,
      old.talhao,
      old.atividade_id
    );
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    perform private.sync_planejamento_progress(
      new.projeto_id,
      new.talhao,
      new.atividade_id
    );
    return new;
  end if;

  return old;
end;
$$;

revoke all on function public.sync_planejamento_progress_after_producao()
  from public, anon, authenticated, service_role;

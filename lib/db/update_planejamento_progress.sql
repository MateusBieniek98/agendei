-- GN · progresso automático do planejamento
--
-- Rode este arquivo no Supabase SQL Editor depois do deploy.
-- Ele liga planejamento aos apontamentos por projeto + talhão + atividade.
-- Importante:
-- - Atividades diferentes continuam separadas.
-- - O projeto ignora apenas sufixos contratuais finais como "- SRP", "- RRP" e "- CPG".
--   Ex.: "Água Limpa" casa com "Água Limpa - SRP".

create extension if not exists unaccent;

create index if not exists idx_producao_planejamento_chave
  on public.producao (projeto_id, atividade_id, lower(trim(talhao)));

create index if not exists idx_planejamento_chave
  on public.planejamento (projeto_id, atividade_id, lower(trim(talhao)));

create or replace function public.normalize_planejamento_text(p_value text)
returns text
  language sql
  stable
  set search_path = public
as $$
  select lower(
    trim(
      regexp_replace(
        regexp_replace(unaccent(coalesce(p_value, '')), '[º°ª]', '', 'g'),
        '[[:space:]]+',
        ' ',
        'g'
      )
    )
  );
$$;

create or replace function public.normalize_planejamento_projeto(p_value text)
returns text
  language sql
  stable
  set search_path = public
as $$
  select trim(regexp_replace(public.normalize_planejamento_text(p_value), '[[:space:]]*-[[:space:]]*(srp|rrp|cpg)[[:space:]]*$', '', 'i'));
$$;

create or replace function public.sync_planejamento_progress(
  p_projeto_id uuid,
  p_talhao text,
  p_atividade_id uuid
) returns void
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_projeto_nome text;
  v_atividade_nome text;
begin
  if p_projeto_id is null or p_talhao is null or p_atividade_id is null then
    return;
  end if;

  select nome into v_projeto_nome
  from public.projetos
  where id = p_projeto_id;

  select nome into v_atividade_nome
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
     and lower(trim(p.talhao)) = lower(trim(pl.talhao))
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

-- Recalcula os itens já cadastrados, usando os apontamentos existentes.
select public.sync_planejamento_progress(projeto_id, talhao, atividade_id)
from public.planejamento;

select
  count(*) filter (where status = 'concluido') as planejamentos_concluidos,
  count(*) filter (where status = 'em_execucao') as planejamentos_em_execucao,
  count(*) filter (where status = 'planejado') as planejamentos_planejados
from public.planejamento;

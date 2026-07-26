-- Permite temporariamente apontamentos com talhao textual enquanto o catalogo
-- oficial e as alocacoes operacionais ainda estao sendo completados.
create or replace function public.enforce_production_plot_link_temporarily()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_talhao public.talhoes;
  v_project_active boolean;
begin
  if tg_op = 'UPDATE'
     and new.projeto_id is not distinct from old.projeto_id
     and new.talhao_id is not distinct from old.talhao_id
     and new.talhao is not distinct from old.talhao then
    return new;
  end if;

  if new.projeto_id is null or nullif(trim(coalesce(new.talhao, '')), '') is null then
    raise exception 'project_and_plot_required';
  end if;

  select p.ativo into v_project_active
  from public.projetos p
  where p.id = new.projeto_id;

  if v_project_active is not true then
    raise exception 'invalid_or_inactive_project';
  end if;

  if new.talhao_id is not null then
    select t.* into v_talhao
    from public.talhoes t
    where t.id = new.talhao_id
      and t.ativo is true;

    if v_talhao.id is null then
      raise exception 'invalid_or_inactive_plot';
    end if;
    if v_talhao.projeto_id <> new.projeto_id then
      raise exception 'plot_does_not_belong_to_project';
    end if;
  else
    select t.* into v_talhao
    from public.talhoes t
    where t.projeto_id = new.projeto_id
      and lower(trim(t.codigo)) = lower(trim(new.talhao))
      and t.ativo is true
    limit 1;
  end if;

  if v_talhao.id is not null then
    new.talhao_id := v_talhao.id;
    new.talhao := v_talhao.codigo;
  else
    new.talhao_id := null;
    new.talhao := trim(new.talhao);
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_production_plot_link_temporarily()
from public, anon, authenticated;

drop trigger if exists trg_producao_catalog_plot on public.producao;
create trigger trg_producao_catalog_plot
before insert or update of projeto_id, talhao_id, talhao on public.producao
for each row execute function public.enforce_production_plot_link_temporarily();

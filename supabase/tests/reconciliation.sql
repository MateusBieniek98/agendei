-- Execute antes e depois da migração e exporte os dois resultados em CSV.
-- Diferenças precisam ser explicadas antes da liberação.

select 'organizations' as metrica, count(*)::numeric as valor
from public.organizations
union all
select 'organization_members', count(*)::numeric
from public.organization_members
union all
select 'profiles', count(*)::numeric from public.profiles
union all
select 'equipes', count(*)::numeric from public.equipes
union all
select 'atividades', count(*)::numeric from public.atividades
union all
select 'projetos', count(*)::numeric from public.projetos
union all
select 'talhoes', count(*)::numeric from public.talhoes
union all
select 'producao', count(*)::numeric from public.producao
union all
select 'producao_quantidade', coalesce(sum(quantidade), 0)::numeric
from public.producao
union all
select 'producao_faturamento',
  coalesce(sum(quantidade * valor_unitario_snapshot), 0)::numeric
from public.producao
union all
select 'producao_com_mais_de_6_insumos', count(*)::numeric
from public.producao
where jsonb_typeof(insumos) = 'array' and jsonb_array_length(insumos) > 6
union all
select 'planejamento', count(*)::numeric from public.planejamento
union all
select 'maquinas', count(*)::numeric from public.maquinas
union all
select 'manutencoes', count(*)::numeric from public.manutencoes
union all
select 'insumos', count(*)::numeric from public.insumos
union all
select 'insumos_saldo_atual', coalesce(sum(saldo_atual), 0)::numeric
from public.insumos
union all
select 'insumo_movimentacoes', count(*)::numeric
from public.insumo_movimentacoes
union all
select 'sync_jobs', count(*)::numeric from public.sync_jobs
order by metrica;

-- Deve voltar vazio depois do backfill.
select table_name, null_rows
from (
  select 'equipes' table_name, count(*) filter (where organization_id is null) null_rows from public.equipes
  union all select 'atividades', count(*) filter (where organization_id is null) from public.atividades
  union all select 'projetos', count(*) filter (where organization_id is null) from public.projetos
  union all select 'talhoes', count(*) filter (where organization_id is null) from public.talhoes
  union all select 'producao', count(*) filter (where organization_id is null) from public.producao
  union all select 'planejamento', count(*) filter (where organization_id is null) from public.planejamento
  union all select 'maquinas', count(*) filter (where organization_id is null) from public.maquinas
  union all select 'manutencoes', count(*) filter (where organization_id is null) from public.manutencoes
  union all select 'insumos', count(*) filter (where organization_id is null) from public.insumos
  union all select 'insumo_movimentacoes', count(*) filter (where organization_id is null) from public.insumo_movimentacoes
) checks
where null_rows > 0;

-- Visão financeira mensal para comparação detalhada.
select
  organization_id,
  date_trunc('month', data)::date as mes,
  count(*) as apontamentos,
  sum(quantidade) as quantidade,
  sum(quantidade * valor_unitario_snapshot)::numeric(14,2) as faturamento
from public.producao
group by organization_id, date_trunc('month', data)
order by organization_id, mes;

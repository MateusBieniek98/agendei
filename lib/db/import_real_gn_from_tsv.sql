-- GN · importador de lançamentos reais via TSV/Google Sheets
--
-- Use quando quiser carregar todos os lançamentos da planilha.
--
-- Como usar no Supabase SQL Editor:
--   1. Abra a planilha "Controle de Produção GN".
--   2. Copie as colunas desde "Inicio" até "Faturamento da Atividade",
--      incluindo o cabeçalho.
--   3. Cole o bloco copiado entre as marcas $gn_tsv$ abaixo.
--   4. Rode o script.
--
-- O importador usa só o que faz sentido para o app atual:
--   Data, Serviço, Projeto, Talhão, Produção, Equipe, Encarregado, Tarifa,
--   Faturamento da Atividade.
-- Insumos ficam fora por enquanto; projeto, talhão, encarregado original e
-- faturamento original entram em observações do lançamento.

begin;

create or replace function public.current_role() returns user_role
  language sql
  stable
  security definer
  set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

revoke all on function public.current_role() from public;
grant execute on function public.current_role() to anon, authenticated, service_role;

delete from public.profiles p
where p.email in ('encarregado@gn.local', 'admin@gn.local', 'gestor@gn.local')
  and not exists (
    select 1
    from auth.users u
    where u.id = p.id
  );

insert into public.profiles (id, email, nome, role, ativo)
select u.id, u.email, p.nome, p.role::user_role, true
from (values
  ('encarregado@gn.local', 'Encarregado GN', 'encarregado'),
  ('admin@gn.local', 'Maria Souza (Admin)', 'admin'),
  ('gestor@gn.local', 'Gestor GN', 'gestor')
) as p(email, nome, role)
join auth.users u on u.email = p.email
on conflict (id) do update set
  email = excluded.email,
  nome = excluded.nome,
  role = excluded.role,
  ativo = true,
  updated_at = now();

create or replace function pg_temp.gn_num(value text) returns numeric
language plpgsql
immutable
as $$
declare
  s text;
begin
  s := trim(replace(coalesce(value, ''), 'R$', ''));
  s := replace(s, chr(160), '');
  s := replace(s, ' ', '');
  if s = '' then
    return null;
  end if;

  if position(',' in s) > 0 then
    s := replace(s, '.', '');
    s := replace(s, ',', '.');
  end if;

  return s::numeric;
exception when others then
  return null;
end;
$$;

create or replace function pg_temp.gn_data_pt(value text) returns date
language plpgsql
immutable
as $$
declare
  s text;
  parts text[];
  mes int;
begin
  s := lower(trim(coalesce(value, '')));
  if s = '' then
    return null;
  end if;

  s := regexp_replace(s, '^[^,]+,\s*', '');
  parts := regexp_match(s, '([0-9]{1,2}) de ([^ ]+) de ([0-9]{4})');

  if parts is null then
    return null;
  end if;

  mes := case replace(parts[2], 'ç', 'c')
    when 'janeiro' then 1
    when 'fevereiro' then 2
    when 'marco' then 3
    when 'abril' then 4
    when 'maio' then 5
    when 'junho' then 6
    when 'julho' then 7
    when 'agosto' then 8
    when 'setembro' then 9
    when 'outubro' then 10
    when 'novembro' then 11
    when 'dezembro' then 12
    else null
  end;

  if mes is null then
    return null;
  end if;

  return make_date(parts[3]::int, mes, parts[1]::int);
end;
$$;

create temp table gn_raw(line text) on commit drop;

insert into gn_raw(line)
select line
from unnest(string_to_array($gn_tsv$
Inicio	Finalizado data	Data	Serviço	Projeto	Talhão	Produção	Equipe	Encarregado	Insumo 1	QTD	Descarte	Insumo 2	QTD	Insumo 3	QTD	Insumo 4	QTD	Insumo 5	QTD	Tarifa	Faturamento da Atividade
COLE_AQUI_AS_LINHAS_DA_PLANILHA
$gn_tsv$, E'\n')) as line
where btrim(line) <> '';

do $$
begin
  if exists (select 1 from gn_raw where line ilike '%COLE_AQUI_AS_LINHAS_DA_PLANILHA%') then
    raise exception 'Cole as linhas reais da planilha dentro do bloco $gn_tsv$ antes de rodar.';
  end if;
end $$;

create temp table gn_stage on commit drop as
with parsed as (
  select
    row_number() over () as rn,
    string_to_array(line, E'\t') as c
  from gn_raw
),
mapped as (
  select
    pg_temp.gn_data_pt(c[3]) as data,
    nullif(regexp_replace(btrim(coalesce(c[4], '')), '[[:space:]]+', ' ', 'g'), '') as servico,
    nullif(regexp_replace(btrim(coalesce(c[5], '')), '[[:space:]]+', ' ', 'g'), '') as projeto,
    nullif(regexp_replace(btrim(coalesce(c[6], '')), '[[:space:]]+', ' ', 'g'), '') as talhao,
    pg_temp.gn_num(c[7]) as producao,
    nullif(regexp_replace(btrim(coalesce(c[8], '')), '[[:space:]]+', ' ', 'g'), '') as equipe,
    nullif(regexp_replace(btrim(coalesce(c[9], '')), '[[:space:]]+', ' ', 'g'), '') as encarregado,
    pg_temp.gn_num(c[21]) as tarifa,
    pg_temp.gn_num(c[22]) as faturamento
  from parsed
  where rn > 1
)
select *
from mapped
where servico is not null;

update public.profiles set equipe_id = null;
delete from public.producao;
delete from public.manutencoes;
delete from public.maquinas;
delete from public.metas;
delete from public.atividades;
delete from public.equipes;
delete from public.audit_log;

insert into public.equipes (nome, descricao)
select
  equipe,
  'Equipe importada da planilha GN. Encarregados vistos: ' ||
    coalesce(string_agg(distinct encarregado, ', '), 'não informado') || '.'
from gn_stage
where equipe is not null
group by equipe
order by equipe;

insert into public.atividades (nome, unidade, valor_unitario)
select
  servico,
  case
    when servico ilike '%HORA%' then 'hora'
    when servico ilike '%DIARIA%' then 'dia'
    else 'ha'
  end as unidade,
  coalesce(max(tarifa) filter (where tarifa is not null and tarifa > 0), 0) as valor_unitario
from gn_stage
group by servico
order by servico;

insert into public.metas (ano, mes, valor_meta, observacoes)
select distinct
  extract(year from data)::int,
  extract(month from data)::int,
  0,
  'Lançamentos reais importados da planilha GN. Defina a meta contratual deste mês.'
from gn_stage
where data is not null
on conflict (ano, mes) do update set observacoes = excluded.observacoes;

insert into public.producao (
  data,
  equipe_id,
  atividade_id,
  quantidade,
  observacoes,
  valor_unitario_snapshot,
  registrado_por
)
select
  s.data,
  e.id,
  a.id,
  s.producao,
  concat_ws(E'\n',
    'Projeto: ' || s.projeto,
    'Talhão: ' || s.talhao,
    'Encarregado original: ' || s.encarregado,
    'Faturamento original: ' || coalesce(s.faturamento::text, 'não informado'),
    'Origem: Controle de Produção GN'
  ),
  coalesce(nullif(s.tarifa, 0), a.valor_unitario),
  (select id from public.profiles where email = 'encarregado@gn.local' limit 1)
from gn_stage s
join public.equipes e on e.nome = s.equipe
join public.atividades a on a.nome = s.servico
where s.data is not null
  and s.producao is not null
  and s.producao > 0
  and s.equipe is not null;

update public.profiles
set equipe_id = (select id from public.equipes order by nome limit 1)
where email = 'encarregado@gn.local';

select
  (select count(*) from public.equipes) as equipes,
  (select count(*) from public.atividades) as atividades,
  (select count(*) from public.producao) as lancamentos_importados,
  (select coalesce(sum(quantidade * valor_unitario_snapshot), 0)::numeric(14,2) from public.producao) as faturamento_importado,
  (select min(data) from public.producao) as primeira_data,
  (select max(data) from public.producao) as ultima_data;

commit;

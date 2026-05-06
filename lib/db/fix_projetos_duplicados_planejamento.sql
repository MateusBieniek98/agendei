-- GN · padronizar projetos/fazendas duplicados pelo nome usado no planejamento
--
-- Objetivo:
-- 1. manter um único cadastro ativo por fazenda/projeto normalizado;
-- 2. preferir o projeto que já está sendo usado no planejamento;
-- 3. mover apontamentos, manutenções e planejamentos duplicados para o projeto canônico;
-- 4. inativar os projetos duplicados para eles sumirem das listas do app.
--
-- Rode no Supabase SQL Editor.

create or replace function public.normalize_planejamento_text(p_value text)
returns text
language sql
immutable
as $$
  select trim(regexp_replace(
    translate(
      lower(coalesce(p_value, '')),
      'áàâãäéèêëíìîïóòôõöúùûüçº°ª“”',
      'aaaaaeeeeiiiiooooouuuucooo""'
    ),
    '[[:space:]]+',
    ' ',
    'g'
  ));
$$;

create or replace function public.normalize_planejamento_projeto(p_value text)
returns text
language sql
immutable
as $$
  select trim(regexp_replace(
    public.normalize_planejamento_text(p_value),
    '[[:space:]]*-[[:space:]]*(srp|rrp|cpg)[[:space:]]*$',
    '',
    'i'
  ));
$$;

create temp table if not exists _gn_projetos_canonicos (
  norm text primary key,
  canonical_id uuid not null
) on commit drop;

truncate _gn_projetos_canonicos;

insert into _gn_projetos_canonicos (norm, canonical_id)
select distinct on (norm)
  norm,
  projeto_id
from (
  select
    public.normalize_planejamento_projeto(pr.nome) as norm,
    pl.projeto_id,
    count(*) as usos
  from public.planejamento pl
  join public.projetos pr on pr.id = pl.projeto_id
  where pl.projeto_id is not null
  group by public.normalize_planejamento_projeto(pr.nome), pl.projeto_id
) uso
where norm <> ''
order by norm, usos desc, projeto_id;

insert into _gn_projetos_canonicos (norm, canonical_id)
select distinct on (norm)
  public.normalize_planejamento_projeto(nome) as norm,
  id as canonical_id
from public.projetos
where public.normalize_planejamento_projeto(nome) <> ''
order by public.normalize_planejamento_projeto(nome), ativo desc, created_at asc, id
on conflict (norm) do nothing;

create temp table if not exists _gn_projetos_duplicados (
  duplicate_id uuid primary key,
  canonical_id uuid not null,
  norm text not null
) on commit drop;

truncate _gn_projetos_duplicados;

insert into _gn_projetos_duplicados (duplicate_id, canonical_id, norm)
select
  p.id as duplicate_id,
  c.canonical_id,
  c.norm
from public.projetos p
join _gn_projetos_canonicos c
  on c.norm = public.normalize_planejamento_projeto(p.nome)
where p.id <> c.canonical_id
  and exists (
    select 1
    from public.projetos outro
    where outro.id <> p.id
      and public.normalize_planejamento_projeto(outro.nome) =
          public.normalize_planejamento_projeto(p.nome)
  );

update public.producao p
set projeto_id = d.canonical_id
from _gn_projetos_duplicados d
where p.projeto_id = d.duplicate_id;

update public.manutencoes m
set projeto_id = d.canonical_id
from _gn_projetos_duplicados d
where m.projeto_id = d.duplicate_id;

update public.planejamento pl
set projeto_id = d.canonical_id
from _gn_projetos_duplicados d
where pl.projeto_id = d.duplicate_id;

update public.projetos p
set ativo = false
from _gn_projetos_duplicados d
where p.id = d.duplicate_id;

select
  count(*) as projetos_duplicados_inativados,
  (select count(*) from public.projetos where ativo = true) as projetos_ativos,
  (select count(*) from public.projetos where ativo = false) as projetos_inativos
from _gn_projetos_duplicados;

-- GN · corrigir atividades duplicadas
--
-- Rode no Supabase SQL Editor.
-- Este script:
-- 1. atualiza/insere o catálogo real de atividades;
-- 2. move lançamentos e planejamentos para um único cadastro por nome;
-- 3. apaga atividades duplicadas por mesmo nome;
-- 4. cria uma trava para impedir novas duplicidades.

create temporary table tmp_catalogo_atividades (
  nome text primary key,
  unidade text not null,
  valor_unitario numeric(12, 4) not null
) on commit drop;

insert into tmp_catalogo_atividades (nome, unidade, valor_unitario) values
  ('SERV CAMINHAO PIPA AGRIC/ PARADO" "UNICA', 'dia', 1720.27),
  ('SERV CAMINHAO PIPA" "UNICA', 'dia', 2622.27),
  ('SERV CAMINHAO TRACADO KM" "UNICA', 'km', 10.27),
  ('SERV DIARIA EQUIPE PARADA" "UNICA', 'dia', 578.99),
  ('SERV DIARIA MAQ PARADA" "UNICA', 'dia', 1293.15),
  ('SERV GERAIS LAVOURA" "UNICA', 'dia', 578.99),
  ('SERV PA CARREGADEIRA AGRIC" "UNICA', 'dia', 431.24),
  ('SERV HORA HOMEM INCENDIO" "INC100%', 'hora', 109.89),
  ('SERV HORA HOMEM INCENDIO" "INC50%', 'hora', 92.92),
  ('SERV HORA HOMEM INCENDIO" "INC70%', 'hora', 98.58),
  ('SERV HORA HOMEM INCENDIO" "INCPADRAO', 'hora', 79.63),
  ('SERV HORA PIPA INCENDIO" "UNICA', 'hora', 327.93),
  ('SERV HORA TRATOR" "PNEU100CV', 'hora', 267.65),
  ('SERV HORA TRATOR" "PNEU110CV', 'hora', 288.58),
  ('SERV HORA TRATOR" "PNEU140CV', 'hora', 323.62),
  ('SERV HORA TRATOR" "PNEU75CV', 'hora', 251.98),
  ('SERV TRACAMENTO ARVORE" "UNICA', 'ha', 91.00),
  ('SERV COMB FORMIGA" "1R_MAN', 'ha', 140.01),
  ('SERV COMB FORMIGA" "3R_MAN', 'ha', 110.54),
  ('SERV COMB FORMIGA" "3R_MEC', 'ha', 96.96),
  ('SERV COMB FORMIGA" "5R_MAN', 'ha', 77.38),
  ('SERV COMB FORMIGA" "5R_MEC', 'ha', 80.29),
  ('SERV COMB FORMIGA" "BORDA_MAN', 'ha', 46.85),
  ('SERV COMB FORMIGA" "BORDA_MEC', 'ha', 43.25),
  ('SERV COMB FORMIGA" "SIST_MAN', 'ha', 140.61),
  ('SERV CAP QUIM AREA TOTAL" "01_MEC', 'ha', 188.82),
  ('SERV CAP QUIM BARRA ABERTA" "01_MEC', 'ha', 248.99),
  ('SERV CAP QUIM BARRA PROTEGIDA" "01_MEC', 'ha', 316.60),
  ('SERV CAP QUIM 4° PRE EMERGENTE BARRA PROTEGIDA" "01_MEC', 'ha', 316.60),
  ('SERV CAP QUIM LINHA" "01_MAN', 'ha', 503.34),
  ('SERV CAP QUIM LINHA" "02_MAN', 'ha', 579.07),
  ('SERV CAP QUIM LINHA" "03_MAN', 'ha', 712.49),
  ('SERV CAP QUIM LINHA" "04_MAN', 'ha', 890.88),
  ('SERV CAP QUIM PRE EMERG FAIXA" "03_MEC', 'ha', 195.87),
  ('SERV CAP QUIM 1° PRE EMERG FAIXA" "03_MEC', 'ha', 195.87),
  ('SERV CAP QUIM PRE EMERG FAIXA" "GRADE_MEC', 'ha', 481.38),
  ('SERV CAP QUIM PRE EMERG FAIXA" "LAMINA_MEC', 'ha', 381.94),
  ('SERV ADUBACAO" "UNICA_MEC', 'ha', 197.87),
  ('SERV ADUBACAO" "ÚNICO_MANUAL', 'ha', 395.02),
  ('SERV IRRICACAO REPLANTIO" "01_MAN', 'ha', 394.75),
  ('SERV IRRICACAO REPLANTIO" "02_MAN', 'ha', 404.85),
  ('SERV IRRICACAO REPLANTIO" "03_MAN', 'ha', 417.49),
  ('SERV IRRIGACAO PLANTIO" "01_MAN', 'ha', 589.74),
  ('SERV 2° IRRIGACAO PLANTIO" "01_MAN', 'ha', 589.74),
  ('SERV 3° IRRIGACAO PLANTIO" "01_MAN', 'ha', 589.74),
  ('SERV IRRIGACAO PLANTIO" "02_MAN', 'ha', 604.67),
  ('SERV IRRIGACAO PLANTIO" "03_MAN', 'ha', 623.40),
  ('SERV PLANTIO" "IRR_01_MAN', 'ha', 1177.29),
  ('SERV PLANTIO" "IRR_02_MAN', 'ha', 1235.36),
  ('SERV PLANTIO" "IRR_03_MAN', 'ha', 1260.00),
  ('SERV ROLO FACA" "MEC_MEC', 'ha', 430.08),
  ('SERV ROLO FACA" "QUIM_MEC', 'ha', 479.77),
  ('SERV CONSTR BACIA" "01_MAN', 'ha', 260.85),
  ('SERV REPLANTIO" "01_MAN', 'ha', 309.03),
  ('SERV ROCADA" "01_MAN', 'ha', 454.05),
  ('SERV ROCADA" "01_MEC', 'ha', 353.57),
  ('SERV ROCADA" "N2', 'ha', 567.56),
  ('SERV ROCADA" "N3', 'ha', 681.07),
  ('SERV ROCADA QUIM" "01_MEC', 'ha', 436.54),
  ('SERV CONTROLE PRAGA" "01_MEC', 'ha', 210.07),
  ('SERV COROAMENTO" "01_MAN', 'ha', 510.12),
  ('SERV COROAMENTO" "02_MAN', 'ha', 655.87),
  ('SERV COROAMENTO" "03_MAN', 'ha', 765.18),
  ('SERV HPIPAINCENDO70PORC" "UNICA', 'hora', 377.67),
  ('SERV HPIPAINCENDO50PORC" "UNICA', 'hora', 372.17),
  ('SERV HPIPAINCENDO100PORC" "UNICA', 'hora', 385.95),
  ('SERV LIMPEZA AREA LINK HA" "UNICA', 'ha', 421.35);

insert into public.atividades (nome, unidade, valor_unitario, ativo)
select c.nome, c.unidade, c.valor_unitario, true
from tmp_catalogo_atividades c
where not exists (
  select 1
  from public.atividades a
  where lower(trim(a.nome)) = lower(trim(c.nome))
);

update public.atividades a
set unidade = c.unidade,
    valor_unitario = c.valor_unitario,
    ativo = true
from tmp_catalogo_atividades c
where lower(trim(a.nome)) = lower(trim(c.nome));

create temporary table tmp_atividades_merge on commit drop as
with referencias as (
  select atividade_id, count(*) as total
  from (
    select atividade_id from public.producao
    union all
    select atividade_id from public.planejamento
  ) r
  where atividade_id is not null
  group by atividade_id
),
ranked as (
  select
    a.id,
    first_value(a.id) over (
      partition by lower(trim(a.nome))
      order by coalesce(ref.total, 0) desc, a.ativo desc, a.created_at asc, a.id
    ) as manter_id,
    row_number() over (
      partition by lower(trim(a.nome))
      order by coalesce(ref.total, 0) desc, a.ativo desc, a.created_at asc, a.id
    ) as rn
  from public.atividades a
  left join referencias ref on ref.atividade_id = a.id
)
select id as remover_id, manter_id
from ranked
where rn > 1;

update public.producao p
set atividade_id = m.manter_id
from tmp_atividades_merge m
where p.atividade_id = m.remover_id;

update public.planejamento pl
set atividade_id = m.manter_id,
    updated_at = now()
from tmp_atividades_merge m
where pl.atividade_id = m.remover_id;

delete from public.atividades a
using tmp_atividades_merge m
where a.id = m.remover_id;

create unique index if not exists idx_atividades_nome_unico
  on public.atividades (lower(trim(nome)));

select
  (select count(*) from tmp_atividades_merge) as duplicadas_removidas,
  (select count(*) from public.atividades where ativo = true) as atividades_ativas,
  (select count(*) from (
    select lower(trim(nome))
    from public.atividades
    group by lower(trim(nome))
    having count(*) > 1
  ) d) as grupos_ainda_duplicados;

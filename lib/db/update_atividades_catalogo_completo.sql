-- GN · catálogo completo de atividades e tarifas
--
-- Rode no Supabase SQL Editor para inserir as atividades que faltarem
-- e atualizar tarifas/unidades das já existentes.

with catalogo(nome, unidade, valor_unitario) as (
  values
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
    ('SERV LIMPEZA AREA LINK HA" "UNICA', 'ha', 421.35)
),
atualizados as (
  update public.atividades a
  set unidade = c.unidade,
      valor_unitario = c.valor_unitario,
      ativo = true
  from catalogo c
  where a.nome = c.nome
  returning a.nome
),
inseridos as (
  insert into public.atividades (nome, unidade, valor_unitario, ativo)
  select c.nome, c.unidade, c.valor_unitario, true
  from catalogo c
  where not exists (
    select 1
    from public.atividades a
    where a.nome = c.nome
  )
  returning nome
)
select
  (select count(*) from atualizados) as atividades_atualizadas,
  (select count(*) from inseridos) as atividades_inseridas,
  (select count(*) from public.atividades where ativo = true) as atividades_ativas;

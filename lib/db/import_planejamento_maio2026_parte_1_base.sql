-- GN · importação do planejamento de maio/2026
-- Origem: Planejamento de atividades- GN - MAIO2026.xlsx, aba Programação Mensal
-- Este script limpa apenas planejamento ano=2026 mes=5 e reinsere 120 itens planejados.

insert into public.projetos (nome, ativo)
select v.nome, true
from (values
  ('Monte Belo Gleba A'),
  ('Monte Belo Gleba B'),
  ('Monte Belo Gleba C'),
  ('Mãe Santa Gleba A - RRP'),
  ('Nossa Senhora Aparecida IX - CPG'),
  ('Pontal II - SRP'),
  ('Santa Luzia - SRP'),
  ('Santo Expedito II - RRP'),
  ('Santo Expedito II - SRP'),
  ('São Pedro III - RRP'),
  ('Taboca - SRP'),
  ('Taboca II - SRP'),
  ('Água Limpa - SRP')
) as v(nome)
where not exists (select 1 from public.projetos p where p.nome = v.nome);

update public.projetos p
set ativo = true
where p.nome in ('Monte Belo Gleba A', 'Monte Belo Gleba B', 'Monte Belo Gleba C', 'Mãe Santa Gleba A - RRP', 'Nossa Senhora Aparecida IX - CPG', 'Pontal II - SRP', 'Santa Luzia - SRP', 'Santo Expedito II - RRP', 'Santo Expedito II - SRP', 'São Pedro III - RRP', 'Taboca - SRP', 'Taboca II - SRP', 'Água Limpa - SRP');

insert into public.equipes (nome, descricao, ativo)
select v.nome, v.descricao, true
from (values
  ('1° Pre/ Desseca', 'Equipe usada no planejamento de maio/2026.'),
  ('Barra protegida', 'Equipe usada no planejamento de maio/2026.'),
  ('Combate a Formiga', 'Equipe usada no planejamento de maio/2026.'),
  ('Irrigação', 'Equipe usada no planejamento de maio/2026.'),
  ('Plantio', 'Equipe usada no planejamento de maio/2026.')
) as v(nome, descricao)
where not exists (select 1 from public.equipes e where e.nome = v.nome);

update public.equipes e
set ativo = true
where e.nome in ('1° Pre/ Desseca', 'Barra protegida', 'Combate a Formiga', 'Irrigação', 'Plantio');

insert into public.atividades (nome, unidade, valor_unitario, ativo)
select v.nome, v.unidade, v.valor_unitario, true
from (values
  ('SERV CAP QUIM AREA TOTAL" "01_MEC', 'ha', 188.82),
  ('SERV CAP QUIM BARRA ABERTA" "01_MEC', 'ha', 248.99),
  ('SERV CAP QUIM BARRA PROTEGIDA" "01_MEC', 'ha', 316.60),
  ('SERV CAP QUIM PRE EMERG FAIXA" "03_MEC', 'ha', 195.87),
  ('SERV CAP QUIM PRE EMERGENTE NA LINHA" "01_MEC', 'ha', 0.00),
  ('SERV COMB FORMIGA" "1R_MAN', 'ha', 140.01),
  ('SERV COMB FORMIGA" "SIST_MAN', 'ha', 140.61),
  ('SERV IRRIGACAO PLANTIO" "01_MAN', 'ha', 589.74),
  ('SERV PLANTIO" "IRR_01_MAN', 'ha', 1177.29),
  ('SERV ROCADA" "01_MAN', 'ha', 454.05),
  ('SERV ROCADA" "N2', 'ha', 567.56),
  ('SERV ROCADA" "N3', 'ha', 681.07)
) as v(nome, unidade, valor_unitario)
where not exists (select 1 from public.atividades a where a.nome = v.nome);

update public.atividades a
set unidade = v.unidade,
    valor_unitario = v.valor_unitario,
    ativo = true
from (values
  ('SERV CAP QUIM AREA TOTAL" "01_MEC', 'ha', 188.82),
  ('SERV CAP QUIM BARRA ABERTA" "01_MEC', 'ha', 248.99),
  ('SERV CAP QUIM BARRA PROTEGIDA" "01_MEC', 'ha', 316.60),
  ('SERV CAP QUIM PRE EMERG FAIXA" "03_MEC', 'ha', 195.87),
  ('SERV CAP QUIM PRE EMERGENTE NA LINHA" "01_MEC', 'ha', 0.00),
  ('SERV COMB FORMIGA" "1R_MAN', 'ha', 140.01),
  ('SERV COMB FORMIGA" "SIST_MAN', 'ha', 140.61),
  ('SERV IRRIGACAO PLANTIO" "01_MAN', 'ha', 589.74),
  ('SERV PLANTIO" "IRR_01_MAN', 'ha', 1177.29),
  ('SERV ROCADA" "01_MAN', 'ha', 454.05),
  ('SERV ROCADA" "N2', 'ha', 567.56),
  ('SERV ROCADA" "N3', 'ha', 681.07)
) as v(nome, unidade, valor_unitario)
where a.nome = v.nome;

delete from public.planejamento where ano = 2026 and mes = 5;

delete from public.planejamento where ano = 2026 and mes = 5;

select 'base_ok' as status;

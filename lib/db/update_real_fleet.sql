-- GN · atualização da frota real
--
-- Apaga a frota anterior/demo e cadastra as máquinas informadas em 05/05/2026.
-- Mantém usuários, atividades, equipes e lançamentos.
--
-- Observação: GNCA02 não veio na legenda; fica cadastrado como tipo não informado.

begin;

delete from public.manutencoes;
delete from public.maquinas;

insert into public.maquinas (nome, tipo, identificador, status, ativo)
select identificador, tipo, identificador, 'operando'::machine_status, true
from (values
  ('GNTP254', 'Trator pneu'),
  ('GNTP297', 'Trator pneu'),
  ('GNTP263', 'Trator pneu'),
  ('GNLA01', 'Lamininha'),
  ('CP101', 'Caminhão pipa'),
  ('GNTP246', 'Trator pneu'),
  ('GNPU94', 'Implemento de pulverização'),
  ('GNTP294', 'Trator pneu'),
  ('GNTP295', 'Trator pneu'),
  ('GNTP288', 'Trator pneu'),
  ('GNPU93', 'Implemento de pulverização'),
  ('GNTP305', 'Trator pneu'),
  ('GNTP241', 'Trator pneu'),
  ('GNPU103', 'Implemento de pulverização'),
  ('GNCP08', 'Caminhão pipa'),
  ('GNPI101', 'Tanque de irrigação'),
  ('GNTP269', 'Trator pneu'),
  ('CP92', 'Caminhão pipa'),
  ('GNTP190', 'Trator pneu'),
  ('GNTP247', 'Trator pneu'),
  ('GNPU86', 'Implemento de pulverização'),
  ('GNTP270', 'Trator pneu'),
  ('GNLA02', 'Lamininha'),
  ('GNPI60', 'Tanque de irrigação'),
  ('GNTP258', 'Trator pneu'),
  ('CP103', 'Caminhão pipa'),
  ('GNPU81', 'Implemento de pulverização'),
  ('ON268', 'Ônibus'),
  ('GNPU92', 'Implemento de pulverização'),
  ('GNPU84', 'Implemento de pulverização'),
  ('GNTP281', 'Trator pneu'),
  ('GNTP292', 'Trator pneu'),
  ('GNPU99', 'Implemento de pulverização'),
  ('GNPI86', 'Tanque de irrigação'),
  ('GNTP289', 'Trator pneu'),
  ('CP98', 'Caminhão pipa'),
  ('GNTP114', 'Trator pneu'),
  ('GNTP245', 'Trator pneu'),
  ('GNPU11', 'Implemento de pulverização'),
  ('GNPU54', 'Implemento de pulverização'),
  ('GNPI38', 'Tanque de irrigação'),
  ('CP102', 'Caminhão pipa'),
  ('GNTP296', 'Trator pneu'),
  ('GNLA03', 'Lamininha'),
  ('GNPI62', 'Tanque de irrigação'),
  ('ON252', 'Ônibus'),
  ('GNCP113', 'Caminhão pipa'),
  ('GNPU98', 'Implemento de pulverização'),
  ('CCB35', 'Caminhão comboio'),
  ('GNCA02', 'Tipo não informado (GNCA)'),
  ('GNRB22', 'Carretinha de muda')
) as v(identificador, tipo)
order by identificador;

select
  tipo,
  count(*) as total
from public.maquinas
group by tipo
order by tipo;

commit;

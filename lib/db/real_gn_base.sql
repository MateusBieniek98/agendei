-- GN · base real extraída da planilha "Controle de Produção GN"
--
-- O que este script faz:
--   1. Corrige a função RLS que causava "stack depth limit exceeded".
--   2. Mantém os usuários/login existentes.
--   3. Apaga dados de demonstração de produção, equipes, atividades,
--      máquinas, manutenções e metas.
--   4. Insere equipes e atividades reais com tarifas extraídas da planilha.
--
-- Rode no Supabase SQL Editor do projeto gn-silvicultura.

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

update public.profiles set equipe_id = null;

delete from public.producao;
delete from public.manutencoes;
delete from public.maquinas;
delete from public.metas;
delete from public.atividades;
delete from public.equipes;
delete from public.audit_log;

insert into public.equipes (nome, descricao)
select nome, descricao
from (values
  ('1° Pre/ Desseca', 'Equipe real importada da planilha GN. Encarregados vistos: Jefferson, José Vitor.'),
  ('Barra protegida', 'Equipe real importada da planilha GN. Encarregados vistos: Gabriel, Douglas, José Vitor.'),
  ('Combate a Formiga', 'Equipe real importada da planilha GN. Encarregado visto: Diemisson.'),
  ('Grade', 'Equipe real importada da planilha GN. Encarregados vistos: Jefferson, Lucas.'),
  ('Irrigação', 'Equipe real importada da planilha GN. Encarregados vistos: Raul, Douglas.'),
  ('Lamininha', 'Equipe real importada da planilha GN. Encarregado visto: José Vitor.'),
  ('Plantio', 'Equipe real importada da planilha GN. Encarregados vistos: Douglas, Raul.')
) as v(nome, descricao)
order by nome;

update public.profiles
set equipe_id = (select id from public.equipes where nome = 'Plantio' limit 1)
where email = 'encarregado@gn.local';

insert into public.atividades (nome, unidade, valor_unitario)
select nome, unidade, valor_unitario
from (values
  ('SERV 2° IRRIGACAO PLANTIO" "01_MAN', 'ha', 589.74),
  ('SERV 3° IRRIGACAO PLANTIO" "01_MAN', 'ha', 589.74),
  ('SERV ADUBACAO" "ÚNICO_MANUAL', 'ha', 395.02),
  ('SERV CAP QUIM 1° PRE EMERG FAIXA" "03_MEC', 'ha', 195.87),
  ('SERV CAP QUIM 4° PRE EMERGENTE BARRA PROTEGIDA" "01_MEC', 'ha', 316.60),
  ('SERV CAP QUIM AREA TOTAL" "01_MEC', 'ha', 188.82),
  ('SERV CAP QUIM BARRA PROTEGIDA" "01_MEC', 'ha', 316.60),
  ('SERV CAP QUIM PRE EMERG FAIXA" "03_MEC', 'ha', 195.87),
  ('SERV CAP QUIM PRE EMERG FAIXA" "LAMINA_MEC', 'ha', 381.94),
  ('SERV COMB FORMIGA" "1R_MAN', 'ha', 140.01),
  ('SERV COMB FORMIGA" "SIST_MAN', 'ha', 140.61),
  ('SERV CONSTR BACIA" "01_MAN', 'ha', 260.85),
  ('SERV COROAMENTO" "01_MAN', 'ha', 510.12),
  ('SERV DIARIA MAQ PARADA" "UNICA', 'dia', 1293.15),
  ('SERV GERAIS LAVOURA" "UNICA', 'ha', 578.99),
  ('SERV HORA TRATOR" "PNEU100CV', 'hora', 0.00),
  ('SERV IRRICACAO REPLANTIO" "01_MAN', 'ha', 394.75),
  ('SERV IRRICACAO REPLANTIO" "02_MAN', 'ha', 404.85),
  ('SERV IRRICACAO REPLANTIO" "03_MAN', 'ha', 417.49),
  ('SERV IRRIGACAO PLANTIO" "01_MAN', 'ha', 589.74),
  ('SERV IRRIGACAO PLANTIO" "02_MAN', 'ha', 604.67),
  ('SERV PLANTIO" "IRR_01_MAN', 'ha', 1177.29),
  ('SERV REPLANTIO" "01_MAN', 'ha', 309.03),
  ('SERV ROCADA" "01_MAN', 'ha', 454.05),
  ('SERV ROCADA" "N2', 'ha', 567.56),
  ('SERV ROCADA" "N3', 'ha', 681.07),
  ('SERV ROCADA QUIM" "01_MEC', 'ha', 436.54)
) as v(nome, unidade, valor_unitario)
order by nome;

insert into public.metas (ano, mes, valor_meta, observacoes)
values
  (2026, 3, 0, 'Base real importada. Defina a meta contratual de março/2026.'),
  (2026, 4, 0, 'Base real importada. Defina a meta contratual de abril/2026.'),
  (2026, 5, 0, 'Base real importada. Defina a meta contratual de maio/2026.')
on conflict (ano, mes) do update set
  valor_meta = excluded.valor_meta,
  observacoes = excluded.observacoes;

select
  (select count(*) from public.equipes) as equipes_reais,
  (select count(*) from public.atividades) as atividades_reais,
  (select count(*) from public.producao) as lancamentos,
  (select count(*) from public.maquinas) as maquinas,
  (select count(*) from public.metas) as metas;

commit;

-- ════════════════════════════════════════════════════════════════════════
--  GN · seed de dados mockados para desenvolvimento
--
--  ATENÇÃO:
--    1) Crie os 3 usuários no Supabase Auth ANTES de rodar este seed
--       (Auth → Users → Add user). Use os emails abaixo:
--         • encarregado@gn.local   (senha: gn123456)
--         • admin@gn.local         (senha: gn123456)
--         • gestor@gn.local        (senha: gn123456)
--    2) Rode este arquivo no SQL Editor do Supabase.
--    3) O script mapeia auth.users → profiles automaticamente pelo email.
-- ════════════════════════════════════════════════════════════════════════

-- ───── profiles (vinculados a auth.users por email) ──────────────────
insert into public.profiles (id, email, nome, role)
select u.id, u.email, p.nome, p.role::user_role
from (values
  ('encarregado@gn.local', 'João Silva (Encarregado)', 'encarregado'),
  ('admin@gn.local',       'Maria Souza (Admin)',     'admin'),
  ('gestor@gn.local',      'Carlos Pereira (Gestor)', 'gestor')
) as p(email, nome, role)
join auth.users u on u.email = p.email
on conflict (id) do update set
  nome = excluded.nome,
  role = excluded.role;

-- ───── equipes ──────────────────────────────────────────────────────
insert into public.equipes (id, nome, descricao) values
  ('11111111-1111-1111-1111-111111111111', 'Frente Norte',  'Plantio talhão A1-A4'),
  ('22222222-2222-2222-2222-222222222222', 'Frente Sul',    'Manutenção pós-plantio B1-B3'),
  ('33333333-3333-3333-3333-333333333333', 'Frente Leste',  'Combate à formiga + roçada'),
  ('44444444-4444-4444-4444-444444444444', 'Frente Oeste',  'Adubação + replantio')
on conflict (id) do nothing;

-- vincula encarregado à Frente Norte
update public.profiles set equipe_id = '11111111-1111-1111-1111-111111111111'
where email = 'encarregado@gn.local';

-- ───── atividades típicas de silvicultura ───────────────────────────
insert into public.atividades (id, nome, unidade, valor_unitario) values
  ('aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Plantio de eucalipto',     'mudas',  1.20),
  ('aaaa2222-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Roçada manual',            'ha',   320.00),
  ('aaaa3333-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Roçada mecanizada',        'ha',   180.00),
  ('aaaa4444-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Adubação de cobertura',    'ha',   240.00),
  ('aaaa5555-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Combate à formiga',        'ha',   150.00),
  ('aaaa6666-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Replantio',                'mudas',  1.80),
  ('aaaa7777-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Irrigação',                'ha',   210.00),
  ('aaaa8888-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Controle de pragas',       'ha',   195.00)
on conflict (id) do nothing;

-- ───── máquinas ─────────────────────────────────────────────────────
insert into public.maquinas (id, nome, tipo, identificador, status) values
  ('bbbb1111-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Trator John Deere 5078E', 'Trator',     'TR-001', 'operando'),
  ('bbbb2222-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Roçadeira Stihl FS 280',  'Roçadeira',  'RC-014', 'operando'),
  ('bbbb3333-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Roçadeira Stihl FS 280',  'Roçadeira',  'RC-015', 'manutencao_urgente'),
  ('bbbb4444-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Pulverizador costal',     'Pulverizador','PV-007', 'operando'),
  ('bbbb5555-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Trator New Holland TT4030','Trator',    'TR-002', 'parada'),
  ('bbbb6666-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Plantadeira manual',      'Plantadeira','PL-003', 'operando')
on conflict (id) do nothing;

-- problema mecânico aberto numa das máquinas paradas
insert into public.manutencoes (maquina_id, descricao, status, reportado_por)
select 'bbbb3333-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Embreagem patinando, motor desliga em alta rotação', 'aberto', p.id
from public.profiles p where p.email = 'encarregado@gn.local'
on conflict do nothing;

insert into public.manutencoes (maquina_id, descricao, status, reportado_por)
select 'bbbb5555-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Vazamento de óleo no cárter, parado aguardando peça', 'em_andamento', p.id
from public.profiles p where p.email = 'encarregado@gn.local'
on conflict do nothing;

-- ───── meta do mês corrente ────────────────────────────────────────
insert into public.metas (ano, mes, valor_meta, observacoes)
values (
  extract(year from current_date)::int,
  extract(month from current_date)::int,
  120000.00,
  'Meta inicial — a calibrar conforme contrato vigente'
)
on conflict (ano, mes) do update set valor_meta = excluded.valor_meta;

-- ───── lançamentos de produção dos últimos 12 dias ─────────────────
-- distribuição variada por equipe/atividade para alimentar dashboards
do $$
declare
  v_user_id uuid;
  d int;
  k int;
  v_equipe uuid;
  v_atividade uuid;
  v_qtd numeric;
  v_valor numeric;
  arr_eq uuid[] := array[
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',
    '33333333-3333-3333-3333-333333333333',
    '44444444-4444-4444-4444-444444444444'
  ];
  arr_at uuid[] := array[
    'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'aaaa2222-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'aaaa3333-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'aaaa4444-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'aaaa5555-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'aaaa6666-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'aaaa7777-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'aaaa8888-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
  ];
begin
  select id into v_user_id from public.profiles where email = 'encarregado@gn.local';
  if v_user_id is null then return; end if;

  for d in 0..11 loop
    for k in 1..3 loop
      v_equipe := arr_eq[1 + ((d + k) % 4)];
      v_atividade := arr_at[1 + ((d * 2 + k) % 8)];

      select valor_unitario into v_valor from public.atividades where id = v_atividade;

      -- volumes plausíveis por unidade
      v_qtd := case
        when v_atividade in ('aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
                              'aaaa6666-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
          then 200 + (random() * 800)::int    -- mudas
        else round((1 + random() * 6)::numeric, 2)  -- ha
      end;

      insert into public.producao
        (data, equipe_id, atividade_id, quantidade,
         valor_unitario_snapshot, registrado_por, observacoes)
      values
        ((current_date - d * interval '1 day')::date, v_equipe, v_atividade,
         v_qtd, v_valor, v_user_id,
         case when (d + k) % 5 = 0 then 'sem ocorrências' else null end);
    end loop;
  end loop;
end $$;

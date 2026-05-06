-- GN · insumos utilizados nos apontamentos
--
-- Rode este arquivo no Supabase SQL Editor.
-- Ele adiciona os campos usados pela tela do encarregado e pela sincronização com Google Sheets.

alter table public.producao
  add column if not exists insumos jsonb not null default '[]'::jsonb,
  add column if not exists descarte numeric(12,3);

update public.producao
set insumos = '[]'::jsonb
where insumos is null;

select
  'ok' as status,
  count(*) as apontamentos,
  count(*) filter (where jsonb_array_length(insumos) > 0) as apontamentos_com_insumos
from public.producao;

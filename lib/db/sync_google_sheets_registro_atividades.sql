-- GN · suporte para importar a aba "Registro de atividades" do Google Sheets
--
-- Rode este script uma vez no SQL Editor do Supabase antes de executar
-- o Apps Script de importacao da planilha.

alter table public.producao
  add column if not exists origem text,
  add column if not exists origem_planilha text,
  add column if not exists origem_aba text,
  add column if not exists origem_linha int,
  add column if not exists origem_chave text,
  add column if not exists import_metadata jsonb not null default '{}'::jsonb,
  add column if not exists importado_em timestamptz;

update public.producao
set import_metadata = '{}'::jsonb
where import_metadata is null;

create unique index if not exists idx_producao_origem_chave_unique
  on public.producao (origem_chave);

create index if not exists idx_producao_origem_planilha
  on public.producao (origem_planilha, origem_aba);

comment on column public.producao.origem is
  'Origem externa do apontamento, ex.: google_sheets.';

comment on column public.producao.origem_chave is
  'Chave idempotente da linha importada. Evita duplicar apontamentos ao rodar o sync varias vezes.';

select
  'ok' as status,
  count(*) filter (where origem = 'google_sheets') as apontamentos_importados_google_sheets
from public.producao;

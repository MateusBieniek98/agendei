-- GN · Suporte a sync via Google Sheets na tabela planejamento
-- Adiciona origem_chave (idempotente) para upsert pelo Apps Script.
-- Rode no SQL Editor do Supabase.

alter table public.planejamento
  add column if not exists origem_chave    text,
  add column if not exists origem_planilha text,
  add column if not exists origem_aba      text,
  add column if not exists origem_linha    int,
  add column if not exists import_metadata jsonb not null default '{}'::jsonb;

-- Índice único: permite upsert por chave da planilha (spreadsheetId:aba:linha)
create unique index if not exists idx_planejamento_origem_chave_unique
  on public.planejamento (origem_chave)
  where origem_chave is not null;

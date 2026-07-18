create index if not exists idx_producao_talhao_id
  on public.producao (talhao_id);
create index if not exists idx_producao_talhao_projeto
  on public.producao (talhao_id, projeto_id);
create index if not exists idx_planejamento_talhao_id
  on public.planejamento (talhao_id);
create index if not exists idx_planejamento_talhao_projeto
  on public.planejamento (talhao_id, projeto_id);
create index if not exists idx_manutencoes_talhao_id
  on public.manutencoes (talhao_id);
create index if not exists idx_manutencoes_talhao_projeto
  on public.manutencoes (talhao_id, projeto_id);
create index if not exists idx_alocacoes_talhao_projeto
  on public.alocacoes_operacionais (talhao_id, projeto_id);

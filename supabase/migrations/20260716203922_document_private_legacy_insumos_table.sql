-- Legacy table kept for historical compatibility. The application reads the
-- JSON payload in producao.insumos and the controlled catalog in public.insumos;
-- no API role should access this relation directly.
drop policy if exists insumos_utilizados_no_direct_access on public.insumos_utilizados;
create policy insumos_utilizados_no_direct_access
  on public.insumos_utilizados
  for all
  to anon, authenticated
  using (false)
  with check (false);

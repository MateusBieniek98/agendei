-- Supabase projects created with legacy defaults grant new functions and
-- tables to API roles automatically. Make future exposure opt-in.
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke select, insert, update, delete on tables from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke usage, select on sequences from anon, authenticated, service_role;

-- Remove direct API access from every privileged helper/RPC. Public business
-- RPCs are explicitly granted back below; trigger and stock helper functions
-- remain private to their owner.
revoke execute on function public.fn_audit()
  from public, anon, authenticated;
revoke execute on function public.current_role()
  from public, anon, authenticated;
revoke execute on function public.set_machine_status(uuid, machine_status)
  from public, anon, authenticated;
revoke execute on function public.resolve_maintenance(uuid, machine_status)
  from public, anon, authenticated;
revoke execute on function public.sync_planejamento_progress(uuid, text, uuid)
  from public, anon, authenticated;
revoke execute on function public.sync_planejamento_progress_after_producao()
  from public, anon, authenticated;
revoke execute on function public.registrar_movimentacao_insumo(uuid, text, numeric, text)
  from public, anon, authenticated;
revoke execute on function public.validate_and_lock_insumos(jsonb)
  from public, anon, authenticated;
revoke execute on function public.baixar_insumos_apontamento(uuid, jsonb, uuid)
  from public, anon, authenticated;
revoke execute on function public.estornar_insumos_apontamento(uuid, jsonb, uuid)
  from public, anon, authenticated;
revoke execute on function public.can_edit_producao_controlada(public.profiles, public.producao)
  from public, anon, authenticated;
revoke execute on function public.create_producao_with_stock(date, uuid, uuid, uuid, text, numeric, numeric, text, jsonb, text, text)
  from public, anon, authenticated;
revoke execute on function public.update_producao_with_stock(uuid, date, uuid, uuid, uuid, text, numeric, numeric, text, jsonb)
  from public, anon, authenticated;
revoke execute on function public.delete_producao_with_stock(uuid)
  from public, anon, authenticated;

-- RLS helper: anonymous reads may evaluate policies that call current_role(),
-- so this read-only function remains callable by API roles.
grant execute on function public.current_role()
  to anon, authenticated, service_role;

-- Authenticated business operations. Each function validates auth.uid() and,
-- when required, the profile role before making privileged changes.
grant execute on function public.set_machine_status(uuid, machine_status)
  to authenticated, service_role;
grant execute on function public.resolve_maintenance(uuid, machine_status)
  to authenticated, service_role;
grant execute on function public.sync_planejamento_progress(uuid, text, uuid)
  to authenticated, service_role;
grant execute on function public.registrar_movimentacao_insumo(uuid, text, numeric, text)
  to authenticated, service_role;
grant execute on function public.create_producao_with_stock(date, uuid, uuid, uuid, text, numeric, numeric, text, jsonb, text, text)
  to authenticated, service_role;
grant execute on function public.update_producao_with_stock(uuid, date, uuid, uuid, uuid, text, numeric, numeric, text, jsonb)
  to authenticated, service_role;
grant execute on function public.delete_producao_with_stock(uuid)
  to authenticated, service_role;

-- Trigger-only audit function keeps elevated insert rights, but cannot be
-- called through the Data API.
alter function public.fn_audit() security definer;
alter function public.fn_audit() set search_path = public, pg_temp;
drop policy if exists audit_insert_authenticated on public.audit_log;
revoke insert, update, delete on table public.audit_log from anon, authenticated;

-- Pin search paths called out by the database advisor.
alter function public.touch_updated_at() set search_path = public, pg_temp;
alter function public.current_cycle_start() set search_path = public, pg_temp;
alter function public.current_cycle_end() set search_path = public, pg_temp;
alter function public.normalize_planejamento_text(text) set search_path = public, pg_temp;
alter function public.normalize_planejamento_projeto(text) set search_path = public, pg_temp;

-- Views must evaluate RLS as the caller rather than as their owner.
alter view public.v_faturamento_dia set (security_invoker = true);
alter view public.v_producao_atividade_mes set (security_invoker = true);
alter view public.v_ranking_equipes_mes set (security_invoker = true);
alter view public.v_status_maquinas set (security_invoker = true);

-- Avoid evaluating auth helpers once per row. These policies already denied
-- unauthenticated requests; targeting authenticated preserves that behavior.
alter policy atividades_read on public.atividades
  to authenticated using (true);
alter policy equipes_read on public.equipes
  to authenticated using (true);
alter policy manut_read on public.manutencoes
  to authenticated using (true);
alter policy maquinas_read on public.maquinas
  to authenticated using (true);
alter policy metas_read on public.metas
  to authenticated using (true);
alter policy metas_atividades_read on public.metas_atividades
  to authenticated using (true);
alter policy metas_equipes_read on public.metas_equipes
  to authenticated using (true);
alter policy planejamento_read on public.planejamento
  to authenticated using (true);
alter policy producao_read on public.producao
  to authenticated using (true);
alter policy profiles_authenticated_read on public.profiles
  to authenticated using (true);
alter policy projetos_read on public.projetos
  to authenticated using (true);
alter policy services_metadata_read on public.services_metadata
  to authenticated using (true);
alter policy talhoes_read on public.talhoes
  to authenticated using (true);

drop policy if exists profiles_select on public.profiles;

alter policy producao_insert on public.producao
  to authenticated
  with check (registrado_por = (select auth.uid()));
alter policy producao_update on public.producao
  to authenticated
  using (
    (select public.current_role()) = 'admin'::user_role
    or registrado_por = (select auth.uid())
  )
  with check (
    (select public.current_role()) = 'admin'::user_role
    or registrado_por = (select auth.uid())
  );
alter policy manut_insert on public.manutencoes
  to authenticated
  with check (reportado_por = (select auth.uid()));

-- Policies that already require auth.uid()/current_role() should name the
-- authenticated role explicitly instead of applying to every Postgres role.
do $$
declare
  item record;
begin
  for item in
    select schemaname, tablename, policyname
    from pg_policies
    where roles = array['public']::name[]
      and (
        coalesce(qual, '') ~ '(auth\\.uid|current_role)'
        or coalesce(with_check, '') ~ '(auth\\.uid|current_role)'
      )
  loop
    execute format(
      'alter policy %I on %I.%I to authenticated',
      item.policyname,
      item.schemaname,
      item.tablename
    );
  end loop;
end;
$$;

-- Index every foreign key reported by the advisor. Besides joins, these make
-- cascading deletes and ownership filters avoid full table scans.
create index if not exists idx_audit_log_usuario_id
  on public.audit_log (usuario_id);
create index if not exists idx_equipes_encarregado_id
  on public.equipes (encarregado_id);
create index if not exists idx_insumo_movimentacoes_usuario_id
  on public.insumo_movimentacoes (usuario_id);
create index if not exists idx_manutencoes_reportado_por
  on public.manutencoes (reportado_por);
create index if not exists idx_planejamento_atividade_id
  on public.planejamento (atividade_id);
create index if not exists idx_planejamento_equipe_id
  on public.planejamento (equipe_id);
create index if not exists idx_producao_editado_por
  on public.producao (editado_por);
create index if not exists idx_producao_registrado_por
  on public.producao (registrado_por);
create index if not exists idx_profiles_equipe_id
  on public.profiles (equipe_id);

begin;

-- The production snapshot predates the current default-privilege hardening.
-- Reassert the intended Data API surface after every privileged function has
-- been recreated by the historical migrations.
revoke all on function public.fn_audit()
  from public, anon, authenticated;
revoke all on function public.record_machine_status_event()
  from public, anon, authenticated;
revoke all on function public.record_new_maintenance_event()
  from public, anon, authenticated;
revoke all on function public.sync_planejamento_progress_after_producao()
  from public, anon, authenticated;
revoke all on function public.resolve_maintenance(uuid, public.machine_status)
  from public, anon, authenticated;

grant execute on function public.fn_audit() to service_role;
grant execute on function public.record_machine_status_event() to service_role;
grant execute on function public.record_new_maintenance_event() to service_role;
grant execute on function public.sync_planejamento_progress_after_producao()
  to service_role;
grant execute on function public.resolve_maintenance(uuid, public.machine_status)
  to service_role;

revoke all on function public.current_role()
  from public, anon, authenticated;
revoke all on function public.is_platform_admin()
  from public, anon, authenticated;
revoke all on function public.maintenance_action(
  uuid,
  text,
  uuid,
  public.maintenance_priority,
  text,
  public.machine_status
) from public, anon, authenticated;
revoke all on function public.manage_operational_allocation(
  text,
  text,
  uuid,
  uuid,
  text
) from public, anon, authenticated;
revoke all on function public.set_machine_status(uuid, public.machine_status)
  from public, anon, authenticated;
revoke all on function public.sync_planejamento_progress(uuid, text, uuid)
  from public, anon, authenticated;
revoke all on function public.update_maintenance_situation(uuid, text)
  from public, anon, authenticated;
revoke all on function public.switch_active_organization(uuid)
  from public, anon, authenticated;
revoke all on function public.registrar_movimentacao_insumo(
  uuid,
  text,
  numeric,
  text
) from public, anon, authenticated;
revoke all on function public.create_producao_with_stock(
  date,
  uuid,
  uuid,
  uuid,
  text,
  numeric,
  numeric,
  text,
  jsonb,
  text,
  text
) from public, anon, authenticated;
revoke all on function public.update_producao_with_stock(
  uuid,
  date,
  uuid,
  uuid,
  uuid,
  text,
  numeric,
  numeric,
  text,
  jsonb
) from public, anon, authenticated;
revoke all on function public.delete_producao_with_stock(uuid)
  from public, anon, authenticated;

grant execute on function public.current_role()
  to authenticated, service_role;
grant execute on function public.is_platform_admin()
  to authenticated, service_role;
grant execute on function public.maintenance_action(
  uuid,
  text,
  uuid,
  public.maintenance_priority,
  text,
  public.machine_status
) to authenticated, service_role;
grant execute on function public.manage_operational_allocation(
  text,
  text,
  uuid,
  uuid,
  text
) to authenticated, service_role;
grant execute on function public.set_machine_status(uuid, public.machine_status)
  to authenticated, service_role;
grant execute on function public.sync_planejamento_progress(uuid, text, uuid)
  to authenticated, service_role;
grant execute on function public.update_maintenance_situation(uuid, text)
  to authenticated, service_role;
grant execute on function public.switch_active_organization(uuid)
  to authenticated, service_role;
grant execute on function public.registrar_movimentacao_insumo(
  uuid,
  text,
  numeric,
  text
) to authenticated, service_role;
grant execute on function public.create_producao_with_stock(
  date,
  uuid,
  uuid,
  uuid,
  text,
  numeric,
  numeric,
  text,
  jsonb,
  text,
  text
) to authenticated, service_role;
grant execute on function public.update_producao_with_stock(
  uuid,
  date,
  uuid,
  uuid,
  uuid,
  text,
  numeric,
  numeric,
  text,
  jsonb
) to authenticated, service_role;
grant execute on function public.delete_producao_with_stock(uuid)
  to authenticated, service_role;

revoke all on function public.consume_api_rate_limit(uuid, text, integer, integer)
  from public, anon, authenticated;
revoke all on function public.validate_and_lock_insumos(jsonb)
  from public, anon, authenticated;
revoke all on function public.baixar_insumos_apontamento(uuid, jsonb, uuid)
  from public, anon, authenticated;
revoke all on function public.estornar_insumos_apontamento(uuid, jsonb, uuid)
  from public, anon, authenticated;
revoke all on function public.can_edit_producao_controlada(
  public.profiles,
  public.producao
) from public, anon, authenticated;

grant execute on function public.consume_api_rate_limit(uuid, text, integer, integer)
  to service_role;
grant execute on function public.validate_and_lock_insumos(jsonb)
  to service_role;
grant execute on function public.baixar_insumos_apontamento(uuid, jsonb, uuid)
  to service_role;
grant execute on function public.estornar_insumos_apontamento(uuid, jsonb, uuid)
  to service_role;
grant execute on function public.can_edit_producao_controlada(
  public.profiles,
  public.producao
) to service_role;

-- The expand migration uses temporary unique indexes while columns are still
-- nullable. The enforce phase creates their final equivalents.
drop index if exists public.planejamento_org_origem_chave_expand_unique;
drop index if exists public.producao_org_origem_chave_expand_unique;
drop index if exists public.services_metadata_org_service_key_expand_unique;
drop index if exists public.sync_jobs_org_tipo_dedupe_expand_unique;

-- Cover every tenant-foundation foreign key reported by the database advisor.
create index if not exists platform_admins_created_by_idx
  on private.platform_admins (created_by);
create index if not exists alocacoes_operacionais_equipe_idx
  on public.alocacoes_operacionais (equipe_id);
create index if not exists alocacoes_operacionais_maquina_idx
  on public.alocacoes_operacionais (maquina_id);
create index if not exists app_settings_updated_by_idx
  on public.app_settings (updated_by);
create index if not exists organization_invitations_equipe_idx
  on public.organization_invitations (equipe_id);
create index if not exists organization_invitations_invited_by_idx
  on public.organization_invitations (invited_by);
create index if not exists organization_members_equipe_idx
  on public.organization_members (equipe_id);
create index if not exists organization_members_invited_by_idx
  on public.organization_members (invited_by);
create index if not exists organizations_created_by_idx
  on public.organizations (created_by);
create index if not exists platform_audit_log_actor_idx
  on public.platform_audit_log (actor_id);
create index if not exists profiles_active_organization_idx
  on public.profiles (active_organization_id);

commit;

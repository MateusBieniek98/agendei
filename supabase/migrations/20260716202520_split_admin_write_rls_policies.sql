-- FOR ALL policies also participate in SELECT, duplicating the dedicated read
-- policy. Split them into mutation-only policies so Postgres evaluates one
-- permissive policy per role/action.
do $$
declare
  item record;
begin
  for item in
    select *
    from (values
      ('atividades', 'atividades_admin_write', 'atividades_admin'),
      ('equipes', 'equipes_admin_write', 'equipes_admin'),
      ('insumos', 'insumos_admin_write', 'insumos_admin'),
      ('maquinas', 'maquinas_admin_write', 'maquinas_admin'),
      ('metas', 'metas_admin_write', 'metas_admin'),
      ('metas_atividades', 'metas_atividades_admin_write', 'metas_atividades_admin'),
      ('metas_equipes', 'metas_equipes_admin_write', 'metas_equipes_admin'),
      ('planejamento', 'planejamento_admin_write', 'planejamento_admin'),
      ('profiles', 'profiles_admin_write', 'profiles_admin'),
      ('projetos', 'projetos_admin_write', 'projetos_admin'),
      ('services_metadata', 'services_metadata_admin_write', 'services_metadata_admin'),
      ('sync_jobs', 'sync_jobs_admin_write', 'sync_jobs_admin'),
      ('talhoes', 'talhoes_admin_write', 'talhoes_admin')
    ) as policies(table_name, old_policy, prefix)
  loop
    execute format(
      'drop policy if exists %I on public.%I',
      item.old_policy,
      item.table_name
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check ((select public.current_role()) = ''admin''::user_role)',
      item.prefix || '_insert',
      item.table_name
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using ((select public.current_role()) = ''admin''::user_role) with check ((select public.current_role()) = ''admin''::user_role)',
      item.prefix || '_update',
      item.table_name
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using ((select public.current_role()) = ''admin''::user_role)',
      item.prefix || '_delete',
      item.table_name
    );
  end loop;
end;
$$;

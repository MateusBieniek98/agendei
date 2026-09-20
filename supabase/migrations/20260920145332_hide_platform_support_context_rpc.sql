begin;

revoke all on function public.current_platform_support_session()
  from public, anon, authenticated, service_role;
drop function public.current_platform_support_session();

commit;

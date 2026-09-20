-- Active platform support always projects the tenant administrator role,
-- including for operators who still have a legacy membership in the tenant.

begin;

create or replace function public.current_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when private.has_active_platform_support(
      p.active_organization_id,
      p.id
    ) then 'admin'::public.user_role
    else (
      select m.role
      from public.organization_members m
      where m.organization_id = p.active_organization_id
        and m.user_id = p.id
        and m.active is true
      limit 1
    )
  end
  from public.profiles p
  where p.id = (select auth.uid())
    and p.ativo is true
  limit 1
$$;

commit;

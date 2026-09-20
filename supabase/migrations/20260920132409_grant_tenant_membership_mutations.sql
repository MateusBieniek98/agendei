-- The tenant policies already restrict membership writes to customer admins.
-- Expose the matching table privileges so those policies and the last-admin
-- safeguard can be exercised by authenticated flows.
begin;

grant select, insert, update, delete
on table public.organization_members
to authenticated;

commit;

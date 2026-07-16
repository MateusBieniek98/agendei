-- Supabase recommends keeping extensions outside the exposed public schema.
-- unaccent is relocatable and no persisted database object depends on an
-- unqualified call, so moving it does not change application behavior.
create schema if not exists extensions;
alter extension unaccent set schema extensions;
grant usage on schema extensions to anon, authenticated, service_role;

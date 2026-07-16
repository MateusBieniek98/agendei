-- Every policy that calls current_role() now targets authenticated explicitly.
-- Anonymous users therefore have no reason to invoke this SECURITY DEFINER
-- helper through the Data API.
revoke execute on function public.current_role() from anon;

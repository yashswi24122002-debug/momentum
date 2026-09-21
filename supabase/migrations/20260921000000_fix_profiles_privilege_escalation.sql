-- Security fix: the "members update own display name" policy on profiles
-- (20260901000000_admin_access_control.sql) has no column-level restriction
-- — Postgres RLS can't scope a policy to specific columns — so any
-- authenticated member can currently call
--   supabase.from('profiles').update({ role: 'admin' }).eq('id', myId)
-- directly from the browser and it passes RLS, since the policy only checks
-- "is this my own row or am I an admin", not "which columns changed".
-- is_admin() (used to gate nearly every other "admin reads all" policy in
-- this project) checks only role = 'admin', so self-promoting here grants
-- direct read access to every other user's data via PostgREST.
--
-- RLS's WITH CHECK only sees the new row, not the old one, so it can't
-- express "these specific columns must be unchanged" — a BEFORE UPDATE
-- trigger can, since triggers get both OLD and NEW.
--
-- Only role and email are blocked here, not must_change_password: that
-- column just gates a UI redirect (see api/me/change-password/route.ts,
-- which legitimately flips it off for the calling user right after they
-- change their password) — self-clearing it isn't a privilege escalation,
-- so it's fine to leave it self-editable. email is blocked alongside role
-- because requireAdmin()/checkIsAdmin() (lib/supabase/admin-guard.ts)
-- check role = 'admin' AND email = ADMIN_EMAIL together — a member could
-- otherwise pass both checks by also rewriting their own email.

create or replace function prevent_profile_privilege_escalation()
returns trigger
language plpgsql
security definer
as $$
begin
  if not is_admin(auth.uid()) then
    if new.role is distinct from old.role
       or new.email is distinct from old.email then
      raise exception 'Not permitted to change role or email';
    end if;
  end if;
  return new;
end;
$$;

create trigger profiles_prevent_privilege_escalation
  before update on profiles
  for each row
  execute function prevent_profile_privilege_escalation();

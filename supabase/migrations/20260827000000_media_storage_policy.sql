-- Content Creation Tool: the "media" Storage bucket was created manually
-- via the dashboard (06-Setup-Guide.md §3) as private, which means it has
-- no storage.objects RLS policy yet — right now nobody (not even the
-- authenticated session) can read or write to it except service-role.
-- Mirrors the "authenticated full access" policy every DB table already
-- has (Master PRD §6: single user, no public sign-up).

create policy "authenticated full access to media bucket"
on storage.objects for all
to authenticated
using (bucket_id = 'media')
with check (bucket_id = 'media');

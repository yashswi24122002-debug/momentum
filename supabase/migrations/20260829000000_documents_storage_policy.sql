-- Masters Abroad Tool: same as the "media" bucket policy (migration
-- 20260827000000) — the "documents" Storage bucket was created manually
-- via the dashboard as private, so it has no storage.objects RLS policy
-- yet and nobody (not even the authenticated session) can read/write to it.

create policy "authenticated full access to documents bucket"
on storage.objects for all
to authenticated
using (bucket_id = 'documents')
with check (bucket_id = 'documents');

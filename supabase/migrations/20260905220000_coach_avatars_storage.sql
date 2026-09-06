-- Step 4B (revised): public storage bucket for coach public-page avatars.
-- Distinct from `profile-avatars` (private, personal account avatar) and
-- `coach-materials` (private, client-facing resources). This bucket is
-- public-read because avatars are shown on the public coach landing page.

insert into storage.buckets (id, name, public)
values ('coach-avatars', 'coach-avatars', true)
on conflict (id) do nothing;

-- Public read: anyone (including anon) can view avatar files, matching the
-- public nature of the coach landing page. No private data is stored here.
drop policy if exists "coach avatars public read" on storage.objects;
create policy "coach avatars public read"
on storage.objects for select
using (bucket_id = 'coach-avatars');

-- Only the owning COACH can upload/replace/remove their own avatar files.
-- Files must live under a folder named after the coach's own auth.uid(),
-- preventing a coach from touching another coach's avatar.
drop policy if exists "coach avatars own upload" on storage.objects;
create policy "coach avatars own upload"
on storage.objects for insert
with check (
  bucket_id = 'coach-avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role = 'COACH'::public.user_role
  )
);

drop policy if exists "coach avatars own update" on storage.objects;
create policy "coach avatars own update"
on storage.objects for update
using (
  bucket_id = 'coach-avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'coach-avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role = 'COACH'::public.user_role
  )
);

drop policy if exists "coach avatars own delete" on storage.objects;
create policy "coach avatars own delete"
on storage.objects for delete
using (
  bucket_id = 'coach-avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

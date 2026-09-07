begin;

-- Services isolation between coaches.
--
-- Private/management access must be owner-only: a coach can read, update,
-- delete and insert ONLY services whose coach_id matches the authenticated
-- coach. RLS cannot know which page produced a query, so the "published"
-- catalogue (active services) is readable by everyone, including other
-- coaches browsing a public page or the public booking flow. Active rows are
-- public by definition: they are shown on the coach's public page. Excluding
-- coaches from the public SELECT (as the previous draft did with
-- "is_active and not is_coach()") would break public pages for a visiting
-- coach without adding real protection: inactive rows and all writes are
-- already gated by current_coach_owns(coach_id).

drop policy if exists "public can view active services" on public.services;
drop policy if exists "coach owns services" on public.services;

-- Public catalogue: any active service is visible to anon and authenticated
-- users alike (public pages for everyone, including other coaches).
-- Visibility of one's OWN services (including inactive ones) for management
-- is granted by the "coach owns services" policy below.
create policy "public can view active services"
on public.services for select
to anon, authenticated
using (
  is_active
);

-- Owner-only management: a coach may read/write/delete only their own rows
-- and may only INSERT rows carrying their own coach_id (current_coach_owns
-- compares the supplied coach_id with auth.uid()).
create policy "coach owns services"
on public.services for all
to authenticated
using (public.current_coach_owns(coach_id))
with check (public.current_coach_owns(coach_id));

commit;
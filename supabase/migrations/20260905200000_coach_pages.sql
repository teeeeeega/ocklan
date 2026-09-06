-- Step 4A: public coach pages (multi-coach landing pages), e.g. /gabrielecaccavale.
-- This migration is schema-only: no seed data, no frontend, no routing changes.

create table if not exists public.coach_pages (
  id uuid primary key default gen_random_uuid(),

  coach_id uuid not null unique
    references public.profiles(id) on delete cascade,

  slug text not null unique,

  display_name text not null,

  bio text,

  avatar_url text,

  cover_url text,

  primary_color text,

  theme text not null default 'dark',

  cta_label text,

  cta_action text,

  social_links jsonb not null default '{}'::jsonb,

  additional_links jsonb not null default '{}'::jsonb,

  is_published boolean not null default false,

  created_at timestamptz not null default now(),

  updated_at timestamptz not null default now(),

  -- Slug must be lowercase, URL-safe, 3-50 chars, no leading/trailing hyphen.
  constraint coach_pages_slug_format check (
    slug ~ '^[a-z0-9](?:[a-z0-9-]{1,48}[a-z0-9])?$'
  ),

  -- Reserve slugs that collide with existing/likely application routes.
  constraint coach_pages_slug_not_reserved check (
    slug not in (
      'login',
      'register',
      'dashboard',
      'area-clienti',
      'profilo',
      'contatti',
      'api',
      'admin',
      'settings'
    )
  )
);

comment on table public.coach_pages is
  'Public-facing configuration for a coach''s own landing page (slug-based). Contains no private/auth data.';

-- Only publish is_published lookups efficiently; coach_id/slug already have unique indexes.
create index if not exists coach_pages_is_published_idx
  on public.coach_pages (is_published);

-- Enforce that coach_pages.coach_id can only reference a COACH profile.
-- Kept local to coach_pages instead of touching the existing global role trigger.
create or replace function public.validate_coach_page_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  page_coach_role public.user_role;
begin
  select role into page_coach_role
  from public.profiles
  where id = new.coach_id;

  if page_coach_role is distinct from 'COACH'::public.user_role then
    raise exception 'INVALID_COACH: coach_id must reference a COACH profile';
  end if;

  return new;
end;
$$;

revoke all on function public.validate_coach_page_role() from public;

drop trigger if exists validate_coach_page_role on public.coach_pages;
create trigger validate_coach_page_role
before insert or update of coach_id
on public.coach_pages
for each row
execute function public.validate_coach_page_role();

-- updated_at auto-maintenance (local helper; no existing global helper found to reuse).
create or replace function public.set_coach_pages_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_coach_pages_updated_at() from public;

drop trigger if exists set_coach_pages_updated_at on public.coach_pages;
create trigger set_coach_pages_updated_at
before update on public.coach_pages
for each row
execute function public.set_coach_pages_updated_at();

-- RLS
alter table public.coach_pages enable row level security;

drop policy if exists coach_pages_select_own on public.coach_pages;
create policy coach_pages_select_own
on public.coach_pages
for select
to authenticated
using (
  auth.uid() = coach_id
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role = 'COACH'::public.user_role
  )
);

drop policy if exists coach_pages_select_public on public.coach_pages;
create policy coach_pages_select_public
on public.coach_pages
for select
to anon, authenticated
using (is_published = true);

drop policy if exists coach_pages_insert_own on public.coach_pages;
create policy coach_pages_insert_own
on public.coach_pages
for insert
to authenticated
with check (
  auth.uid() = coach_id
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role = 'COACH'::public.user_role
  )
);

drop policy if exists coach_pages_update_own on public.coach_pages;
create policy coach_pages_update_own
on public.coach_pages
for update
to authenticated
using (
  auth.uid() = coach_id
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role = 'COACH'::public.user_role
  )
)
with check (
  auth.uid() = coach_id
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role = 'COACH'::public.user_role
  )
);

drop policy if exists coach_pages_delete_own on public.coach_pages;
create policy coach_pages_delete_own
on public.coach_pages
for delete
to authenticated
using (
  auth.uid() = coach_id
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role = 'COACH'::public.user_role
  )
);

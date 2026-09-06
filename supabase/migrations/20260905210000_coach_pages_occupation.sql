-- Step 4B (revised): add a simple "occupation" field to coach_pages.
-- Backward compatible: nullable column, no seed data, RLS unchanged.

alter table public.coach_pages
  add column if not exists occupation text;

comment on column public.coach_pages.occupation is
  'Short public job title shown on the coach public page (e.g. "Calisthenics Coach").';

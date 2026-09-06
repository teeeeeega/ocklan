create table public.program_exercises (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.client_programs(id) on delete cascade,
  exercise_name text not null,
  position integer not null check (position >= 1),
  sets integer check (sets > 0),
  reps text,
  duration_seconds integer check (duration_seconds >= 0),
  rest_seconds integer check (rest_seconds >= 0),
  load text,
  notes text,
  video_url text,
  created_at timestamptz not null default now(),
  constraint program_exercises_program_position_key unique (program_id, position)
);

alter table public.program_exercises enable row level security;

create policy "coaches can view program exercises"
on public.program_exercises
for select
using (public.is_coach());

create policy "clients can view own program exercises"
on public.program_exercises
for select
using (
  exists (
    select 1
    from public.client_programs
    where client_programs.id = program_exercises.program_id
      and client_programs.client_id = auth.uid()
  )
);

create policy "coaches can create program exercises"
on public.program_exercises
for insert
with check (public.is_coach());

create policy "coaches can update program exercises"
on public.program_exercises
for update
using (public.is_coach())
with check (public.is_coach());

create policy "coaches can delete program exercises"
on public.program_exercises
for delete
using (public.is_coach());

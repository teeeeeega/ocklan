create table public.contact_requests (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 120),
  email text not null check (char_length(trim(email)) between 3 and 320),
  message text not null check (char_length(trim(message)) between 1 and 5000),
  created_at timestamptz not null default now()
);

alter table public.contact_requests enable row level security;

create policy "public can submit contact requests"
on public.contact_requests
for insert
to anon, authenticated
with check (true);

create policy "coach can read contact requests"
on public.contact_requests
for select
to authenticated
using (public.is_coach());

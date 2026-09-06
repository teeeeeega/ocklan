-- Multi-coach foundation: tenant relationships and nullable ownership columns.
-- Existing rows are intentionally left unchanged; coach_id will be backfilled later.

create table if not exists public.coach_clients (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles(id) on delete cascade,
  client_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'PENDING'
    check (status in ('PENDING', 'ACTIVE', 'PAUSED', 'ENDED')),
  is_primary boolean not null default true,
  created_at timestamptz not null default now(),
  invited_at timestamptz,
  accepted_at timestamptz,
  constraint coach_clients_distinct_users check (coach_id <> client_id),
  constraint coach_clients_unique_pair unique (coach_id, client_id)
);

create index if not exists coach_clients_client_id_idx
  on public.coach_clients (client_id);

create or replace function public.validate_coach_client_roles()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  coach_role public.user_role;
  client_role public.user_role;
begin
  select role into coach_role
  from public.profiles
  where id = new.coach_id;

  select role into client_role
  from public.profiles
  where id = new.client_id;

  if coach_role is distinct from 'COACH'::public.user_role then
    raise exception 'INVALID_COACH: coach_id must reference a COACH profile';
  end if;

  if client_role is distinct from 'CLIENT'::public.user_role then
    raise exception 'INVALID_CLIENT: client_id must reference a CLIENT profile';
  end if;

  return new;
end;
$$;

revoke all on function public.validate_coach_client_roles() from public;

drop trigger if exists validate_coach_client_roles on public.coach_clients;
create trigger validate_coach_client_roles
before insert or update of coach_id, client_id
on public.coach_clients
for each row
execute function public.validate_coach_client_roles();

alter table public.services
  add column if not exists coach_id uuid references public.profiles(id);

alter table public.packages
  add column if not exists coach_id uuid references public.profiles(id);

alter table public.appointments
  add column if not exists coach_id uuid references public.profiles(id);

alter table public.availability_rules
  add column if not exists coach_id uuid references public.profiles(id);

alter table public.blocked_times
  add column if not exists coach_id uuid references public.profiles(id);

alter table public.questionnaires
  add column if not exists coach_id uuid references public.profiles(id);

alter table public.materials
  add column if not exists coach_id uuid references public.profiles(id);

alter table public.payments
  add column if not exists coach_id uuid references public.profiles(id);

alter table public.client_programs
  add column if not exists coach_id uuid references public.profiles(id);

alter table public.contact_requests
  add column if not exists coach_id uuid references public.profiles(id);

create index if not exists services_coach_id_idx
  on public.services (coach_id);

create index if not exists packages_coach_id_idx
  on public.packages (coach_id);

create index if not exists appointments_coach_id_idx
  on public.appointments (coach_id);

create index if not exists availability_rules_coach_id_idx
  on public.availability_rules (coach_id);

create index if not exists blocked_times_coach_id_idx
  on public.blocked_times (coach_id);

create index if not exists questionnaires_coach_id_idx
  on public.questionnaires (coach_id);

create index if not exists materials_coach_id_idx
  on public.materials (coach_id);

create index if not exists payments_coach_id_idx
  on public.payments (coach_id);

create index if not exists client_programs_coach_id_idx
  on public.client_programs (coach_id);

create index if not exists contact_requests_coach_id_idx
  on public.contact_requests (coach_id);

alter table public.coach_clients enable row level security;

drop policy if exists "users can view own coach relationships" on public.coach_clients;
create policy "users can view own coach relationships"
on public.coach_clients
for select
to authenticated
using (coach_id = auth.uid() or client_id = auth.uid());

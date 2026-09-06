-- Initial relational schema for Supabase. Run after creating a project.
create type public.user_role as enum ('CLIENT', 'COACH');
create type public.appointment_status as enum ('PENDING', 'BOOKED', 'COMPLETED', 'CANCELLED', 'RESCHEDULED');
create type public.payment_status as enum ('PENDING', 'PAID', 'FAILED', 'REFUNDED');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role public.user_role not null default 'CLIENT',
  avatar_url text,
  created_at timestamptz not null default now()
);
create table public.services (
  id uuid primary key default gen_random_uuid(), name text not null, description text not null default '',
  price_cents integer not null check (price_cents >= 0), billing_type text not null default 'ONE_TIME',
  duration_minutes integer not null default 60, sessions_count integer, pathway_days integer,
  requires_intro_call boolean not null default false, appointment_type text, is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.client_programs (
  id uuid primary key default gen_random_uuid(), client_id uuid not null references public.profiles(id),
  service_id uuid references public.services(id), title text not null, status text not null default 'ACTIVE',
  starts_at date, ends_at date, goal text, created_at timestamptz not null default now()
);
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
create table public.packages (
  id uuid primary key default gen_random_uuid(), client_id uuid not null references public.profiles(id),
  service_id uuid references public.services(id), total_sessions integer not null check (total_sessions > 0),
  used_sessions integer not null default 0 check (used_sessions >= 0), purchased_at timestamptz not null default now(),
  starts_at date, expires_at date, status text not null default 'ACTIVE'
);
create table public.appointments (
  id uuid primary key default gen_random_uuid(), client_id uuid not null references public.profiles(id),
  service_id uuid references public.services(id), starts_at timestamptz not null, ends_at timestamptz not null,
  status public.appointment_status not null default 'PENDING', payment_method text not null default 'IN_PERSON',
  meeting_url text, location text, notes text, created_at timestamptz not null default now(),
  constraint valid_appointment_time check (ends_at > starts_at)
);
create extension if not exists btree_gist;
alter table public.appointments
  add constraint appointments_no_active_overlap
  exclude using gist (tstzrange(starts_at, ends_at, '[)') with &&)
  where (status in ('PENDING', 'BOOKED'));
create table public.availability_rules (
  id uuid primary key default gen_random_uuid(), weekday smallint not null check (weekday between 0 and 6),
  starts_at time not null, ends_at time not null, slot_minutes integer not null default 60, is_active boolean not null default true
);
create table public.blocked_times (
  id uuid primary key default gen_random_uuid(), starts_at timestamptz not null, ends_at timestamptz not null, reason text
);
create table public.questionnaires (
  id uuid primary key default gen_random_uuid(), client_id uuid unique not null references public.profiles(id),
  answers jsonb not null default '{}'::jsonb, injury_notes text, submitted_at timestamptz, updated_at timestamptz not null default now()
);
create table public.payments (
  id uuid primary key default gen_random_uuid(), client_id uuid not null references public.profiles(id),
  service_id uuid references public.services(id), appointment_id uuid references public.appointments(id),
  amount_cents integer not null check (amount_cents >= 0), status public.payment_status not null default 'PENDING',
  provider text, provider_reference text, created_at timestamptz not null default now()
);
create table public.materials (
  id uuid primary key default gen_random_uuid(), client_id uuid not null references public.profiles(id),
  title text not null, description text not null default '', url text not null, material_type text not null default 'LINK',
  is_active boolean not null default true, created_at timestamptz not null default now()
);
create table public.coach_notes (
  id uuid primary key default gen_random_uuid(), client_id uuid not null references public.profiles(id),
  coach_id uuid not null references public.profiles(id), body text not null, created_at timestamptz not null default now()
);
create table public.contact_requests (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 120),
  email text not null check (char_length(trim(email)) between 3 and 320),
  message text not null check (char_length(trim(message)) between 1 and 5000),
  created_at timestamptz not null default now()
);

create or replace function public.is_coach() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'COACH');
$$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.services enable row level security;
alter table public.client_programs enable row level security;
alter table public.program_exercises enable row level security;
alter table public.packages enable row level security;
alter table public.appointments enable row level security;
alter table public.availability_rules enable row level security;
alter table public.blocked_times enable row level security;
alter table public.questionnaires enable row level security;
alter table public.payments enable row level security;
alter table public.materials enable row level security;
alter table public.coach_notes enable row level security;
alter table public.contact_requests enable row level security;

create policy "profiles own or coach" on public.profiles for select using (id = auth.uid() or public.is_coach());
create policy "services public active or coach" on public.services for select using (is_active or public.is_coach());
create policy "coach manages services" on public.services for all using (public.is_coach()) with check (public.is_coach());
create policy "client own programs" on public.client_programs for select using (client_id = auth.uid() or public.is_coach());
create policy "coach can create client programs" on public.client_programs for insert with check (public.is_coach());
create policy "coaches can view program exercises" on public.program_exercises for select using (public.is_coach());
create policy "clients can view own program exercises" on public.program_exercises for select using (
  exists (
    select 1 from public.client_programs
    where client_programs.id = program_exercises.program_id
      and client_programs.client_id = auth.uid()
  )
);
create policy "coaches can create program exercises" on public.program_exercises for insert with check (public.is_coach());
create policy "coaches can update program exercises" on public.program_exercises for update using (public.is_coach()) with check (public.is_coach());
create policy "coaches can delete program exercises" on public.program_exercises for delete using (public.is_coach());
create policy "client own packages" on public.packages for select using (client_id = auth.uid() or public.is_coach());
create policy "appointments scoped" on public.appointments for select using (client_id = auth.uid() or public.is_coach());
create policy "coach manages appointments" on public.appointments for all using (public.is_coach()) with check (public.is_coach());
create policy "availability readable" on public.availability_rules for select using (true);
create policy "coach manages availability" on public.availability_rules for all using (public.is_coach()) with check (public.is_coach());
create policy "blocked times readable" on public.blocked_times for select using (true);
create policy "coach manages blocked times" on public.blocked_times for all using (public.is_coach()) with check (public.is_coach());
create policy "questionnaire private" on public.questionnaires for select using (client_id = auth.uid() or public.is_coach());
create policy "client manages own questionnaire" on public.questionnaires for insert with check (client_id = auth.uid());
create policy "client updates own questionnaire" on public.questionnaires for update using (client_id = auth.uid()) with check (client_id = auth.uid());
create policy "payments scoped" on public.payments for select using (client_id = auth.uid() or public.is_coach());
create policy "coach manages payments" on public.payments for all using (public.is_coach()) with check (public.is_coach());
create policy "materials assigned only" on public.materials for select using (client_id = auth.uid() or public.is_coach());
create policy "coach manages materials" on public.materials for all using (public.is_coach()) with check (public.is_coach());
create policy "coach notes private" on public.coach_notes for select using (coach_id = auth.uid() or public.is_coach());
create policy "coach manages notes" on public.coach_notes for all using (public.is_coach()) with check (public.is_coach());
create policy "public can submit contact requests" on public.contact_requests for insert to anon, authenticated with check (true);
create policy "coach can read contact requests" on public.contact_requests for select to authenticated using (public.is_coach());

create or replace function public.get_available_slots(p_service_id uuid, p_date date)
returns table (starts_at timestamptz, ends_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare
  service_duration integer;
  rule_record record;
  candidate_start timestamptz;
  candidate_end timestamptz;
begin
  select service.duration_minutes into service_duration from public.services service where service.id = p_service_id and service.is_active;
  if service_duration is null then raise exception 'SERVICE_UNAVAILABLE: servizio non trovato o non attivo'; end if;
  if p_date is null or p_date < current_date then return; end if;
  for rule_record in select rule.starts_at, rule.ends_at, rule.slot_minutes from public.availability_rules rule where rule.is_active and rule.weekday = extract(dow from p_date)::smallint and rule.slot_minutes > 0 loop
    candidate_start := (p_date + rule_record.starts_at)::timestamptz;
    while candidate_start + make_interval(mins => service_duration) <= (p_date + rule_record.ends_at)::timestamptz loop
      candidate_end := candidate_start + make_interval(mins => service_duration);
      if candidate_start > now()
         and not exists (select 1 from public.blocked_times blocked where tstzrange(blocked.starts_at, blocked.ends_at, '[)') && tstzrange(candidate_start, candidate_end, '[)'))
         and not exists (select 1 from public.appointments appointment where appointment.status in ('PENDING', 'BOOKED') and tstzrange(appointment.starts_at, appointment.ends_at, '[)') && tstzrange(candidate_start, candidate_end, '[)')) then
        starts_at := candidate_start; ends_at := candidate_end; return next;
      end if;
      candidate_start := candidate_start + make_interval(mins => rule_record.slot_minutes);
    end loop;
  end loop;
end;
$$;
revoke all on function public.get_available_slots(uuid, date) from public;
grant execute on function public.get_available_slots(uuid, date) to anon, authenticated;

create or replace function public.create_appointment(p_service_id uuid, p_starts_at timestamptz, p_ends_at timestamptz)
returns public.appointments
language plpgsql security definer set search_path = public as $$
declare
  current_user_id uuid := auth.uid();
  service_duration integer;
  matching_rule boolean;
  new_appointment public.appointments;
begin
  if current_user_id is null then raise exception 'AUTH_REQUIRED: autenticazione necessaria'; end if;
  if not exists (select 1 from public.profiles where id = current_user_id and role = 'CLIENT') then raise exception 'NOT_AUTHORIZED: solo i CLIENT possono usare questa prenotazione'; end if;
  select duration_minutes into service_duration from public.services where id = p_service_id and is_active;
  if service_duration is null then raise exception 'SERVICE_UNAVAILABLE: servizio non trovato o non attivo'; end if;
  if p_starts_at is null or p_ends_at is null or p_ends_at <= p_starts_at then raise exception 'INVALID_TIME: intervallo non valido'; end if;
  if p_starts_at <= now() then raise exception 'PAST_TIME: lo slot è nel passato'; end if;
  if extract(epoch from (p_ends_at - p_starts_at))::integer <> service_duration * 60 then raise exception 'INVALID_DURATION: la durata non corrisponde al servizio'; end if;
  select exists (select 1 from public.availability_rules rule where rule.is_active and rule.weekday = extract(dow from p_starts_at)::smallint and p_starts_at::time >= rule.starts_at and p_ends_at::time <= rule.ends_at) into matching_rule;
  if not matching_rule then raise exception 'OUTSIDE_AVAILABILITY: slot fuori disponibilità'; end if;
  if exists (select 1 from public.blocked_times blocked where tstzrange(blocked.starts_at, blocked.ends_at, '[)') && tstzrange(p_starts_at, p_ends_at, '[)')) then raise exception 'BLOCKED_TIME: slot non disponibile'; end if;
  if exists (select 1 from public.appointments appointment where appointment.status in ('PENDING', 'BOOKED') and tstzrange(appointment.starts_at, appointment.ends_at, '[)') && tstzrange(p_starts_at, p_ends_at, '[)')) then raise exception 'SLOT_OCCUPIED: slot già prenotato'; end if;
  begin
    insert into public.appointments (client_id, service_id, starts_at, ends_at, status) values (current_user_id, p_service_id, p_starts_at, p_ends_at, 'PENDING') returning * into new_appointment;
  exception when exclusion_violation then raise exception 'SLOT_OCCUPIED: slot già prenotato';
  end;
  return new_appointment;
end;
$$;
revoke all on function public.create_appointment(uuid, timestamptz, timestamptz) from public;
grant execute on function public.create_appointment(uuid, timestamptz, timestamptz) to authenticated;

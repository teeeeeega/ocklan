begin;

-- These helpers read relationship/role data without re-entering table RLS.
create or replace function public.current_coach_owns(p_coach_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'COACH'::public.user_role
      and p_coach_id = auth.uid()
  );
$$;

create or replace function public.current_coach_has_client(p_client_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.coach_clients
    where coach_id = auth.uid()
      and client_id = p_client_id
      and status = 'ACTIVE'
  );
$$;

create or replace function public.current_client_has_coach(p_coach_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.coach_clients
    where coach_id = p_coach_id
      and client_id = auth.uid()
      and status = 'ACTIVE'
  );
$$;

revoke all on function public.current_coach_owns(uuid) from public;
revoke all on function public.current_coach_has_client(uuid) from public;
revoke all on function public.current_client_has_coach(uuid) from public;
grant execute on function public.current_coach_owns(uuid) to authenticated;
grant execute on function public.current_coach_has_client(uuid) to authenticated;
grant execute on function public.current_client_has_coach(uuid) to authenticated;

-- Remove the global single-coach policies.
drop policy if exists "profiles own or coach" on public.profiles;
drop policy if exists "services public active or coach" on public.services;
drop policy if exists "coach manages services" on public.services;
drop policy if exists "client own programs" on public.client_programs;
drop policy if exists "coach can create client programs" on public.client_programs;
drop policy if exists "coaches can view program exercises" on public.program_exercises;
drop policy if exists "clients can view own program exercises" on public.program_exercises;
drop policy if exists "coaches can create program exercises" on public.program_exercises;
drop policy if exists "coaches can update program exercises" on public.program_exercises;
drop policy if exists "coaches can delete program exercises" on public.program_exercises;
drop policy if exists "client own packages" on public.packages;
drop policy if exists "coach manages packages" on public.packages;
drop policy if exists "appointments scoped" on public.appointments;
drop policy if exists "coach manages appointments" on public.appointments;
drop policy if exists "availability readable" on public.availability_rules;
drop policy if exists "coach manages availability" on public.availability_rules;
drop policy if exists "blocked times readable" on public.blocked_times;
drop policy if exists "coach manages blocked times" on public.blocked_times;
drop policy if exists "questionnaire private" on public.questionnaires;
drop policy if exists "client manages own questionnaire" on public.questionnaires;
drop policy if exists "client updates own questionnaire" on public.questionnaires;
drop policy if exists "payments scoped" on public.payments;
drop policy if exists "coach manages payments" on public.payments;
drop policy if exists "materials assigned only" on public.materials;
drop policy if exists "coach manages materials" on public.materials;
drop policy if exists "coach notes private" on public.coach_notes;
drop policy if exists "coach manages notes" on public.coach_notes;
drop policy if exists "coach can read contact requests" on public.contact_requests;
drop policy if exists "users can view own coach relationships" on public.coach_clients;

-- Profiles: self access plus clients explicitly assigned to the current coach.
create policy "profiles self or assigned clients"
on public.profiles for select
to authenticated
using (
  id = auth.uid()
  or (
    role = 'CLIENT'::public.user_role
    and public.current_coach_has_client(id)
  )
);

-- Services: active services remain public for the existing booking flow.
create policy "public can view active services"
on public.services for select
to anon, authenticated
using (is_active);

create policy "coach owns services"
on public.services for all
to authenticated
using (public.current_coach_owns(coach_id))
with check (public.current_coach_owns(coach_id));

-- Packages.
create policy "clients view assigned packages"
on public.packages for select
to authenticated
using (
  client_id = auth.uid()
  and public.current_client_has_coach(coach_id)
);

create policy "coach owns packages"
on public.packages for all
to authenticated
using (
  public.current_coach_owns(coach_id)
  and public.current_coach_has_client(client_id)
)
with check (
  public.current_coach_owns(coach_id)
  and public.current_coach_has_client(client_id)
);

-- Appointments.
create policy "clients view assigned appointments"
on public.appointments for select
to authenticated
using (
  client_id = auth.uid()
  and public.current_client_has_coach(coach_id)
);

create policy "coach owns appointments"
on public.appointments for all
to authenticated
using (
  public.current_coach_owns(coach_id)
  and public.current_coach_has_client(client_id)
)
with check (
  public.current_coach_owns(coach_id)
  and public.current_coach_has_client(client_id)
);

-- Availability and blocked times are no longer directly public.
create policy "coach owns availability rules"
on public.availability_rules for all
to authenticated
using (public.current_coach_owns(coach_id))
with check (public.current_coach_owns(coach_id));

create policy "coach owns blocked times"
on public.blocked_times for all
to authenticated
using (public.current_coach_owns(coach_id))
with check (public.current_coach_owns(coach_id));

-- Questionnaires retain the existing one-per-client constraint for now.
create policy "clients view assigned questionnaires"
on public.questionnaires for select
to authenticated
using (
  client_id = auth.uid()
  and public.current_client_has_coach(coach_id)
);

create policy "clients create assigned questionnaires"
on public.questionnaires for insert
to authenticated
with check (
  client_id = auth.uid()
  and public.current_client_has_coach(coach_id)
);

create policy "clients update assigned questionnaires"
on public.questionnaires for update
to authenticated
using (
  client_id = auth.uid()
  and public.current_client_has_coach(coach_id)
)
with check (
  client_id = auth.uid()
  and public.current_client_has_coach(coach_id)
);

create policy "coach manages assigned questionnaires"
on public.questionnaires for all
to authenticated
using (
  public.current_coach_owns(coach_id)
  and public.current_coach_has_client(client_id)
)
with check (
  public.current_coach_owns(coach_id)
  and public.current_coach_has_client(client_id)
);

-- Materials and payments.
create policy "clients view assigned materials"
on public.materials for select
to authenticated
using (
  client_id = auth.uid()
  and public.current_client_has_coach(coach_id)
);

create policy "coach owns materials"
on public.materials for all
to authenticated
using (
  public.current_coach_owns(coach_id)
  and public.current_coach_has_client(client_id)
)
with check (
  public.current_coach_owns(coach_id)
  and public.current_coach_has_client(client_id)
);

create policy "clients view assigned payments"
on public.payments for select
to authenticated
using (
  client_id = auth.uid()
  and public.current_client_has_coach(coach_id)
);

create policy "coach owns payments"
on public.payments for all
to authenticated
using (
  public.current_coach_owns(coach_id)
  and public.current_coach_has_client(client_id)
)
with check (
  public.current_coach_owns(coach_id)
  and public.current_coach_has_client(client_id)
);

-- Programs and exercises inherit tenant ownership through client_programs.
create policy "clients view assigned programs"
on public.client_programs for select
to authenticated
using (
  client_id = auth.uid()
  and public.current_client_has_coach(coach_id)
);

create policy "coach owns programs"
on public.client_programs for all
to authenticated
using (
  public.current_coach_owns(coach_id)
  and public.current_coach_has_client(client_id)
)
with check (
  public.current_coach_owns(coach_id)
  and public.current_coach_has_client(client_id)
);

create policy "clients view assigned program exercises"
on public.program_exercises for select
to authenticated
using (
  exists (
    select 1
    from public.client_programs
    where client_programs.id = program_exercises.program_id
      and client_programs.client_id = auth.uid()
      and client_programs.coach_id is not null
      and public.current_client_has_coach(client_programs.coach_id)
  )
);

create policy "coach manages owned program exercises"
on public.program_exercises for all
to authenticated
using (
  exists (
    select 1
    from public.client_programs
    where client_programs.id = program_exercises.program_id
      and public.current_coach_owns(client_programs.coach_id)
      and public.current_coach_has_client(client_programs.client_id)
  )
)
with check (
  exists (
    select 1
    from public.client_programs
    where client_programs.id = program_exercises.program_id
      and public.current_coach_owns(client_programs.coach_id)
      and public.current_coach_has_client(client_programs.client_id)
  )
);

-- Notes are owned strictly by their coach.
create policy "coach owns notes"
on public.coach_notes for all
to authenticated
using (
  public.current_coach_owns(coach_id)
  and public.current_coach_has_client(client_id)
)
with check (
  public.current_coach_owns(coach_id)
  and public.current_coach_has_client(client_id)
);

-- Contact requests are readable/manageable only by their assigned coach.
create policy "coach owns contact requests"
on public.contact_requests for all
to authenticated
using (public.current_coach_owns(coach_id))
with check (public.current_coach_owns(coach_id));

-- Relationship rows remain read-only to their participants.
create policy "users view own coach relationships"
on public.coach_clients for select
to authenticated
using (coach_id = auth.uid() or client_id = auth.uid());

commit;

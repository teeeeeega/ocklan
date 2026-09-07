begin;

-- Add period columns to availability_rules.
-- NULL means no limit (infinite validity). Both bounds are INCLUSIVE.
-- Existing 14 rows receive NULL → behaviour unchanged.

alter table public.availability_rules
  add column if not exists valid_from date,
  add column if not exists valid_until date;

-- Prevent invalid ranges: if both are set, valid_from must be <= valid_until.
alter table public.availability_rules
  add constraint availability_rules_valid_period
  check (
    valid_from is null
    or valid_until is null
    or valid_from <= valid_until
  );

-- RPC: get_available_slots — now filters rules by period.

create or replace function public.get_available_slots(
  p_service_id uuid,
  p_date date
)
returns table (starts_at timestamptz, ends_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coach_id uuid;
  v_service_duration integer;
  v_rule record;
  v_candidate_start timestamptz;
  v_candidate_end timestamptz;
begin
  select service.coach_id, service.duration_minutes
    into v_coach_id, v_service_duration
    from public.services service
   where service.id = p_service_id
     and service.is_active
     and service.coach_id is not null;

  if not found then
    raise exception 'SERVICE_UNAVAILABLE: servizio non trovato, non attivo o non assegnato a un coach';
  end if;

  if p_date is null or p_date < current_date then
    return;
  end if;

  for v_rule in
    select rule.starts_at, rule.ends_at, rule.slot_minutes
      from public.availability_rules rule
     where rule.coach_id = v_coach_id
       and rule.is_active
       and rule.weekday = extract(dow from p_date)::smallint
       and rule.slot_minutes > 0
       and (rule.valid_from is null or p_date >= rule.valid_from)
       and (rule.valid_until is null or p_date <= rule.valid_until)
  loop
    v_candidate_start := (p_date + v_rule.starts_at)::timestamptz;
    while v_candidate_start + make_interval(mins => v_service_duration)
          <= (p_date + v_rule.ends_at)::timestamptz
    loop
      v_candidate_end := v_candidate_start + make_interval(mins => v_service_duration);
      if v_candidate_start > now()
         and not exists (
           select 1
             from public.blocked_times blocked
            where blocked.coach_id = v_coach_id
              and tstzrange(blocked.starts_at, blocked.ends_at, '[)')
                  && tstzrange(v_candidate_start, v_candidate_end, '[)')
         )
         and not exists (
           select 1
             from public.appointments appointment
            where appointment.coach_id = v_coach_id
              and appointment.status in ('PENDING', 'BOOKED')
              and tstzrange(appointment.starts_at, appointment.ends_at, '[)')
                  && tstzrange(v_candidate_start, v_candidate_end, '[)')
         )
      then
        starts_at := v_candidate_start;
        ends_at := v_candidate_end;
        return next;
      end if;
      v_candidate_start := v_candidate_start + make_interval(mins => v_rule.slot_minutes);
    end loop;
  end loop;
end;
$$;

revoke all on function public.get_available_slots(uuid, date) from public;
grant execute on function public.get_available_slots(uuid, date) to anon, authenticated;

-- RPC: create_appointment — now validates availability period.

create or replace function public.create_appointment(
  p_service_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz
)
returns public.appointments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client_id uuid := auth.uid();
  v_coach_id uuid;
  v_service_duration integer;
  v_matching_rule boolean;
  v_new_appointment public.appointments;
begin
  if v_client_id is null then
    raise exception 'AUTH_REQUIRED: autenticazione necessaria';
  end if;

  if not exists (
    select 1
      from public.profiles
     where id = v_client_id
       and role = 'CLIENT'::public.user_role
  ) then
    raise exception 'NOT_AUTHORIZED: solo i CLIENT possono usare questa prenotazione';
  end if;

  select service.coach_id, service.duration_minutes
    into v_coach_id, v_service_duration
    from public.services service
   where service.id = p_service_id
     and service.is_active
     and service.coach_id is not null;

  if not found then
    raise exception 'SERVICE_UNAVAILABLE: servizio non trovato, non attivo o non assegnato a un coach';
  end if;

  if not exists (
    select 1
      from public.coach_clients relationship
     where relationship.coach_id = v_coach_id
       and relationship.client_id = v_client_id
       and relationship.status = 'ACTIVE'
  ) then
    raise exception 'COACH_RELATION_REQUIRED: non hai una relazione attiva con il coach di questo servizio';
  end if;

  if p_starts_at is null or p_ends_at is null or p_ends_at <= p_starts_at then
    raise exception 'INVALID_TIME: intervallo non valido';
  end if;
  if p_starts_at <= now() then
    raise exception 'PAST_TIME: lo slot è nel passato';
  end if;
  if extract(epoch from (p_ends_at - p_starts_at))::integer <> v_service_duration * 60 then
    raise exception 'INVALID_DURATION: la durata non corrisponde al servizio';
  end if;

  select exists (
    select 1
      from public.availability_rules rule
     where rule.coach_id = v_coach_id
       and rule.is_active
       and rule.weekday = extract(dow from p_starts_at)::smallint
       and p_starts_at::time >= rule.starts_at
       and p_ends_at::time <= rule.ends_at
       and (rule.valid_from is null or p_starts_at::date >= rule.valid_from)
       and (rule.valid_until is null or p_starts_at::date <= rule.valid_until)
  ) into v_matching_rule;

  if not v_matching_rule then
    raise exception 'OUTSIDE_AVAILABILITY: slot fuori disponibilità';
  end if;

  if exists (
    select 1
      from public.blocked_times blocked
     where blocked.coach_id = v_coach_id
       and tstzrange(blocked.starts_at, blocked.ends_at, '[)')
           && tstzrange(p_starts_at, p_ends_at, '[)')
  ) then
    raise exception 'BLOCKED_TIME: slot non disponibile';
  end if;

  if exists (
    select 1
      from public.appointments appointment
     where appointment.coach_id = v_coach_id
       and appointment.status in ('PENDING', 'BOOKED')
       and tstzrange(appointment.starts_at, appointment.ends_at, '[)')
           && tstzrange(p_starts_at, p_ends_at, '[)')
  ) then
    raise exception 'SLOT_OCCUPIED: slot già prenotato';
  end if;

  begin
    insert into public.appointments (
      client_id,
      coach_id,
      service_id,
      starts_at,
      ends_at,
      status
    )
    values (
      v_client_id,
      v_coach_id,
      p_service_id,
      p_starts_at,
      p_ends_at,
      'PENDING'
    )
    returning * into v_new_appointment;
  exception
    when exclusion_violation then
      raise exception 'SLOT_OCCUPIED: slot già prenotato';
  end;

  return v_new_appointment;
end;
$$;

revoke all on function public.create_appointment(uuid, timestamptz, timestamptz) from public;
grant execute on function public.create_appointment(uuid, timestamptz, timestamptz) to authenticated;

commit;
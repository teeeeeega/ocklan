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
  service_duration integer;
  rule_record record;
  candidate_start timestamptz;
  candidate_end timestamptz;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED: autenticazione necessaria';
  end if;

  select duration_minutes
    into service_duration
    from public.services
   where id = p_service_id
     and is_active;

  if service_duration is null then
    raise exception 'SERVICE_UNAVAILABLE: servizio non trovato o non attivo';
  end if;
  if p_date is null or p_date < current_date then
    return;
  end if;

  for rule_record in
    select starts_at, ends_at, slot_minutes
      from public.availability_rules
     where is_active
       and weekday = extract(dow from p_date)::smallint
       and slot_minutes > 0
  loop
    candidate_start := (p_date + rule_record.starts_at)::timestamptz;
    while candidate_start + make_interval(mins => service_duration)
          <= (p_date + rule_record.ends_at)::timestamptz
    loop
      candidate_end := candidate_start + make_interval(mins => service_duration);
      if candidate_start > now()
         and not exists (
           select 1
             from public.blocked_times blocked
            where tstzrange(blocked.starts_at, blocked.ends_at, '[)')
                  && tstzrange(candidate_start, candidate_end, '[)')
         )
         and not exists (
           select 1
             from public.appointments appointment
            where appointment.status in ('PENDING', 'BOOKED')
              and tstzrange(appointment.starts_at, appointment.ends_at, '[)')
                  && tstzrange(candidate_start, candidate_end, '[)')
         )
      then
        starts_at := candidate_start;
        ends_at := candidate_end;
        return next;
      end if;
      candidate_start := candidate_start + make_interval(mins => rule_record.slot_minutes);
    end loop;
  end loop;
end;
$$;

revoke all on function public.get_available_slots(uuid, date) from public;
grant execute on function public.get_available_slots(uuid, date) to authenticated;

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
  current_user_id uuid := auth.uid();
  service_duration integer;
  matching_rule boolean;
  new_appointment public.appointments;
begin
  if current_user_id is null then
    raise exception 'AUTH_REQUIRED: autenticazione necessaria';
  end if;
  if not exists (
    select 1 from public.profiles
     where id = current_user_id and role = 'CLIENT'
  ) then
    raise exception 'NOT_AUTHORIZED: solo i CLIENT possono usare questa prenotazione';
  end if;

  select duration_minutes
    into service_duration
    from public.services
   where id = p_service_id
     and is_active;
  if service_duration is null then
    raise exception 'SERVICE_UNAVAILABLE: servizio non trovato o non attivo';
  end if;
  if p_starts_at is null or p_ends_at is null or p_ends_at <= p_starts_at then
    raise exception 'INVALID_TIME: intervallo non valido';
  end if;
  if p_starts_at <= now() then
    raise exception 'PAST_TIME: lo slot è nel passato';
  end if;
  if extract(epoch from (p_ends_at - p_starts_at))::integer <> service_duration * 60 then
    raise exception 'INVALID_DURATION: la durata non corrisponde al servizio';
  end if;

  select exists (
    select 1
      from public.availability_rules rule
     where rule.is_active
       and rule.weekday = extract(dow from p_starts_at)::smallint
       and p_starts_at::time >= rule.starts_at
       and p_ends_at::time <= rule.ends_at
  ) into matching_rule;
  if not matching_rule then
    raise exception 'OUTSIDE_AVAILABILITY: slot fuori disponibilità';
  end if;
  if exists (
    select 1
      from public.blocked_times blocked
     where tstzrange(blocked.starts_at, blocked.ends_at, '[)')
           && tstzrange(p_starts_at, p_ends_at, '[)')
  ) then
    raise exception 'BLOCKED_TIME: slot non disponibile';
  end if;
  if exists (
    select 1
      from public.appointments appointment
     where appointment.status in ('PENDING', 'BOOKED')
       and tstzrange(appointment.starts_at, appointment.ends_at, '[)')
           && tstzrange(p_starts_at, p_ends_at, '[)')
  ) then
    raise exception 'SLOT_OCCUPIED: slot già prenotato';
  end if;

  begin
    insert into public.appointments (client_id, service_id, starts_at, ends_at, status)
    values (current_user_id, p_service_id, p_starts_at, p_ends_at, 'PENDING')
    returning * into new_appointment;
  exception
    when exclusion_violation then
      raise exception 'SLOT_OCCUPIED: slot già prenotato';
  end;
  return new_appointment;
end;
$$;

revoke all on function public.create_appointment(uuid, timestamptz, timestamptz) from public;
grant execute on function public.create_appointment(uuid, timestamptz, timestamptz) to authenticated;

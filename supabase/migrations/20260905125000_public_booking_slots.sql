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
grant execute on function public.get_available_slots(uuid, date) to anon, authenticated;

-- Allow a CLIENT who explicitly selects an active service on a published coach
-- page to establish the required multi-coach relationship before booking.
create or replace function public.ensure_coach_client_relationship(
  p_service_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client_id uuid := auth.uid();
  v_coach_id uuid;
  v_status text;
begin
  if v_client_id is null then
    raise exception 'AUTH_REQUIRED: autenticazione necessaria';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = v_client_id and role = 'CLIENT'::public.user_role
  ) then
    raise exception 'NOT_AUTHORIZED: solo i CLIENT possono avviare una prenotazione';
  end if;

  select service.coach_id into v_coach_id
  from public.services service
  join public.profiles coach on coach.id = service.coach_id
  join public.coach_pages page on page.coach_id = service.coach_id
  where service.id = p_service_id
    and service.is_active
    and service.coach_id is not null
    and coach.role = 'COACH'::public.user_role
    and page.is_published;

  if not found then
    raise exception 'SERVICE_UNAVAILABLE: servizio non disponibile su una pagina pubblica';
  end if;

  select status into v_status
  from public.coach_clients
  where coach_id = v_coach_id and client_id = v_client_id;

  if found then
    if v_status = 'ACTIVE' then return; end if;
    raise exception 'COACH_RELATION_NOT_ACTIVE: la relazione con questo coach non è attiva';
  end if;

  insert into public.coach_clients (coach_id, client_id, status, is_primary, accepted_at)
  values (v_coach_id, v_client_id, 'ACTIVE', false, now())
  on conflict (coach_id, client_id) do nothing;
end;
$$;

revoke all on function public.ensure_coach_client_relationship(uuid) from public;
grant execute on function public.ensure_coach_client_relationship(uuid) to authenticated;
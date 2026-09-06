-- Backfill the first tenant without hardcoding the coach UUID.
-- The block is atomic: any validation or statement failure rolls back the backfill.

do $$
declare
  gabriele_id uuid;
  coach_count integer;
  services_to_backfill integer;
  packages_to_backfill integer;
  appointments_to_backfill integer;
  availability_rules_to_backfill integer;
  blocked_times_to_backfill integer;
  questionnaires_to_backfill integer;
  materials_to_backfill integer;
  payments_to_backfill integer;
  client_programs_to_backfill integer;
  contact_requests_to_backfill integer;
  clients_to_associate integer;
begin
  select count(*)
    into coach_count
    from public.profiles
   where full_name = 'Gabriele Caccavale'
     and role = 'COACH'::public.user_role;

  if coach_count = 0 then
    raise exception 'GABRIELE_NOT_FOUND: nessun profilo COACH con full_name esatto';
  end if;

  if coach_count > 1 then
    raise exception 'GABRIELE_NOT_UNIQUE: trovati % profili COACH con full_name esatto', coach_count;
  end if;

  if (select count(*) from public.profiles where role = 'COACH'::public.user_role) <> 1 then
    raise exception 'MULTIPLE_COACHES_FOUND: Gabriele deve essere l''unico profilo COACH durante il backfill';
  end if;

  select id
    into strict gabriele_id
    from public.profiles
   where full_name = 'Gabriele Caccavale'
     and role = 'COACH'::public.user_role;

  select count(*) into services_to_backfill from public.services where coach_id is null;
  select count(*) into packages_to_backfill from public.packages where coach_id is null;
  select count(*) into appointments_to_backfill from public.appointments where coach_id is null;
  select count(*) into availability_rules_to_backfill from public.availability_rules where coach_id is null;
  select count(*) into blocked_times_to_backfill from public.blocked_times where coach_id is null;
  select count(*) into questionnaires_to_backfill from public.questionnaires where coach_id is null;
  select count(*) into materials_to_backfill from public.materials where coach_id is null;
  select count(*) into payments_to_backfill from public.payments where coach_id is null;
  select count(*) into client_programs_to_backfill from public.client_programs where coach_id is null;
  select count(*) into contact_requests_to_backfill from public.contact_requests where coach_id is null;

  select count(*)
    into clients_to_associate
    from (
      select client_id from public.packages where coach_id = gabriele_id or coach_id is null
      union
      select client_id from public.appointments where coach_id = gabriele_id or coach_id is null
      union
      select client_id from public.questionnaires where coach_id = gabriele_id or coach_id is null
      union
      select client_id from public.client_programs where coach_id = gabriele_id or coach_id is null
      union
      select client_id from public.materials where coach_id = gabriele_id or coach_id is null
      union
      select client_id from public.payments where coach_id = gabriele_id or coach_id is null
    ) candidate_clients
    inner join public.profiles client_profile
      on client_profile.id = candidate_clients.client_id
     and client_profile.role = 'CLIENT'::public.user_role;

  raise notice 'Coach trovati: %', (select count(*) from public.profiles where role = 'COACH'::public.user_role);
  raise notice 'Backfill previsto services: %', services_to_backfill;
  raise notice 'Backfill previsto packages: %', packages_to_backfill;
  raise notice 'Backfill previsto appointments: %', appointments_to_backfill;
  raise notice 'Backfill previsto availability_rules: %', availability_rules_to_backfill;
  raise notice 'Backfill previsto blocked_times: %', blocked_times_to_backfill;
  raise notice 'Backfill previsto questionnaires: %', questionnaires_to_backfill;
  raise notice 'Backfill previsto materials: %', materials_to_backfill;
  raise notice 'Backfill previsto payments: %', payments_to_backfill;
  raise notice 'Backfill previsto client_programs: %', client_programs_to_backfill;
  raise notice 'Backfill previsto contact_requests: %', contact_requests_to_backfill;
  raise notice 'Clienti da associare: %', clients_to_associate;

  update public.services
     set coach_id = gabriele_id
   where coach_id is null;

  update public.packages
     set coach_id = gabriele_id
   where coach_id is null;

  update public.appointments
     set coach_id = gabriele_id
   where coach_id is null;

  update public.availability_rules
     set coach_id = gabriele_id
   where coach_id is null;

  update public.blocked_times
     set coach_id = gabriele_id
   where coach_id is null;

  update public.questionnaires
     set coach_id = gabriele_id
   where coach_id is null;

  update public.materials
     set coach_id = gabriele_id
   where coach_id is null;

  update public.payments
     set coach_id = gabriele_id
   where coach_id is null;

  update public.client_programs
     set coach_id = gabriele_id
   where coach_id is null;

  update public.contact_requests
     set coach_id = gabriele_id
   where coach_id is null;

  insert into public.coach_clients (coach_id, client_id, status, is_primary)
  select distinct
    gabriele_id,
    client_id,
    'ACTIVE',
    true
  from (
    select client_id
      from public.packages
     where coach_id = gabriele_id
    union
    select client_id
      from public.appointments
     where coach_id = gabriele_id
    union
    select client_id
      from public.questionnaires
     where coach_id = gabriele_id
    union
    select client_id
      from public.client_programs
     where coach_id = gabriele_id
    union
    select client_id
      from public.materials
     where coach_id = gabriele_id
    union
    select client_id
      from public.payments
     where coach_id = gabriele_id
  ) existing_client_records
  inner join public.profiles client_profile
    on client_profile.id = existing_client_records.client_id
   and client_profile.role = 'CLIENT'::public.user_role
  on conflict (coach_id, client_id) do nothing;
end;
$$;

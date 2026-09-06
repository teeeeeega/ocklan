-- Signup intent: role assignment based on the real entry point.
-- The client passes raw_user_meta_data:
--   requested_role: 'COACH'            -> signup started from the landing ("Inizia gratis")
--   requested_role: 'CLIENT' + coach_slug -> signup started from a coach public page
-- Anything else (missing/invalid) safely falls back to CLIENT.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested text := lower(coalesce(new.raw_user_meta_data ->> 'requested_role', ''));
  coach_slug text := nullif(trim(coalesce(new.raw_user_meta_data ->> 'coach_slug', '')), '');
  target_coach_id uuid;
begin
  if requested = 'coach' then
    -- Self-service coach registration from the landing page.
    insert into public.profiles (id, full_name, role)
    values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''), 'COACH');
    return new;
  end if;

  -- Default: client registration.
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''), 'CLIENT');

  -- If the signup came from a coach public page with a valid published slug,
  -- link the new client to that coach immediately (ACTIVE, primary if none).
  if requested = 'client' and coach_slug is not null then
    select cp.coach_id into target_coach_id
    from public.coach_pages cp
    join public.profiles p on p.id = cp.coach_id and p.role = 'COACH'
    where cp.slug = coach_slug
      and cp.is_published;

    if target_coach_id is not null then
      insert into public.coach_clients (coach_id, client_id, status, is_primary)
      values (
        target_coach_id,
        new.id,
        'ACTIVE',
        not exists (select 1 from public.coach_clients cc where cc.client_id = new.id)
      )
      on conflict (coach_id, client_id) do nothing;
    end if;
  end if;

  return new;
end;
$$;

-- Safe account deletion: make columns nullable to allow SET NULL during cleanup.

begin;

-- CLIENT delete: allow unlinking client data from deleted profiles
alter table public.appointments
  alter column client_id drop not null;

alter table public.payments
  alter column client_id drop not null;

alter table public.packages
  alter column client_id drop not null;

alter table public.client_programs
  alter column client_id drop not null;

alter table public.coach_notes
  alter column client_id drop not null;

-- COACH delete: allow unlinking coach data from deleted profiles
alter table public.appointments
  alter column coach_id drop not null;

alter table public.coach_notes
  alter column coach_id drop not null;

-- RPC: atomic data cleanup for account deletion
create or replace function public.delete_account_data(p_user_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  -- 0. Verify the caller owns this account
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'NOT_AUTHORIZED: non puoi eliminare l''account di un altro utente';
  end if;

  -- 1. Verify profile exists
  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'PROFILE_NOT_FOUND: profilo non trovato';
  end if;

  -- 2. Read role
  select role::text into v_role from public.profiles where id = p_user_id;

  -- 3. Cleanup based on role
  if v_role = 'CLIENT' then
    delete from public.questionnaires where client_id = p_user_id;
    delete from public.materials where client_id = p_user_id;
    update public.client_programs set client_id = null where client_id = p_user_id;
    update public.packages set client_id = null where client_id = p_user_id;
    update public.appointments set client_id = null where client_id = p_user_id;
    update public.payments set client_id = null where client_id = p_user_id;
    update public.coach_notes set client_id = null where client_id = p_user_id;

  elsif v_role = 'COACH' then
    -- Preserve services (set coach_id = NULL)
    update public.services set coach_id = null where coach_id = p_user_id;
    -- Delete coach-specific data
    delete from public.availability_rules where coach_id = p_user_id;
    delete from public.blocked_times where coach_id = p_user_id;
    delete from public.contact_requests where coach_id = p_user_id;
    delete from public.coach_notes where coach_id = p_user_id;
    -- Unlink coach from historical data
    update public.appointments set coach_id = null where coach_id = p_user_id;
    update public.payments set coach_id = null where coach_id = p_user_id;
    update public.packages set coach_id = null where coach_id = p_user_id;
    update public.client_programs set coach_id = null where coach_id = p_user_id;
    update public.questionnaires set coach_id = null where coach_id = p_user_id;
    update public.materials set coach_id = null where coach_id = p_user_id;

  else
    raise exception 'INVALID_ROLE: ruolo non supportato per la cancellazione';
  end if;

  -- 4. Do NOT delete the profile here; auth.admin.deleteUser will cascade it
  return 'SUCCESS';
end;
$$;

revoke all on function public.delete_account_data(uuid) from public;
grant execute on function public.delete_account_data(uuid) to authenticated;

commit;

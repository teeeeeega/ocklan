-- Personal profile updates and private avatar storage.
create or replace function public.prevent_profile_protected_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.id <> old.id or new.role <> old.role or new.created_at <> old.created_at then
    raise exception 'PROFILE_PROTECTED_FIELDS: id, role e created_at non sono modificabili';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_fields on public.profiles;
create trigger protect_profile_fields
before update on public.profiles
for each row execute procedure public.prevent_profile_protected_changes();

drop policy if exists "profiles own update" on public.profiles;
create policy "profiles own update"
on public.profiles for update
using (id = auth.uid())
with check (id = auth.uid());

insert into storage.buckets (id, name, public)
values ('profile-avatars', 'profile-avatars', false)
on conflict (id) do nothing;

drop policy if exists "profile avatars own read" on storage.objects;
create policy "profile avatars own read"
on storage.objects for select
using (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "profile avatars own upload" on storage.objects;
create policy "profile avatars own upload"
on storage.objects for insert
with check (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "profile avatars own update" on storage.objects;
create policy "profile avatars own update"
on storage.objects for update
using (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "profile avatars own delete" on storage.objects;
create policy "profile avatars own delete"
on storage.objects for delete
using (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

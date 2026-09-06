create extension if not exists btree_gist;

alter table public.appointments
  add constraint appointments_no_active_overlap
  exclude using gist (
    tstzrange(starts_at, ends_at, '[)') with &&
  )
  where (status in ('PENDING', 'BOOKED'));

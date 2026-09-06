create policy "coach manages packages"
on public.packages
for all
using (public.is_coach())
with check (public.is_coach());

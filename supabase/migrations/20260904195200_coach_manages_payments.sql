create policy "coach manages payments"
on public.payments
for all
using (public.is_coach())
with check (public.is_coach());

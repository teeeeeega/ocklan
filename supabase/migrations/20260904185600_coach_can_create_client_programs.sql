create policy "coach can create client programs"
on public.client_programs
for insert
with check (public.is_coach());

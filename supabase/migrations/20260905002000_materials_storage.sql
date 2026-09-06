insert into storage.buckets (id, name, public)
values ('coach-materials', 'coach-materials', false)
on conflict (id) do nothing;

create policy "coach materials can read assigned files"
on storage.objects for select
using (
  bucket_id = 'coach-materials'
  and (
    public.is_coach()
    or (storage.foldername(name))[1] = auth.uid()::text
  )
);

create policy "coach materials can upload files"
on storage.objects for insert
with check (
  bucket_id = 'coach-materials'
  and public.is_coach()
);

create policy "coach materials can update files"
on storage.objects for update
using (bucket_id = 'coach-materials' and public.is_coach())
with check (bucket_id = 'coach-materials' and public.is_coach());

create policy "coach materials can delete files"
on storage.objects for delete
using (bucket_id = 'coach-materials' and public.is_coach());

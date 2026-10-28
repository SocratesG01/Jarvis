-- Jarvis database. Paste this whole file into Supabase: SQL Editor -> New query -> Run.
-- One table holds every record (shops, tasks, visits, catalogues, settings) as JSON,
-- and each row belongs to the signed-in user who wrote it.

create table if not exists public.docs (
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  coll text not null,
  id text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (owner, coll, id)
);

alter table public.docs enable row level security;

drop policy if exists "own rows" on public.docs;
create policy "own rows" on public.docs
  for all to authenticated
  using (owner = auth.uid())
  with check (owner = auth.uid());

-- Live updates between your phone and computer.
alter table public.docs replica identity full;
do $$ begin
  alter publication supabase_realtime add table public.docs;
exception when duplicate_object then null; end $$;

-- Private photo storage: each user can only touch files under their own folder.
insert into storage.buckets (id, name, public)
values ('photos', 'photos', false)
on conflict (id) do nothing;

drop policy if exists "own photos read" on storage.objects;
drop policy if exists "own photos write" on storage.objects;
drop policy if exists "own photos delete" on storage.objects;
create policy "own photos read" on storage.objects for select to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own photos write" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own photos delete" on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------------------
-- Client intake questionnaire: storage bucket + submissions table.
--
-- Security shape:
--   * Anonymous visitors may INSERT objects into the intake bucket and may do
--     nothing else there -- no read, no list, no overwrite, no delete.
--   * public.submissions has RLS on with no policies, so only the service role
--     (i.e. the edge function) can touch it. The table lives in `public`
--     because PostgREST only exposes `public` and `graphql_public`; putting it
--     in a custom schema means depending on an "Exposed schemas" dashboard
--     setting that can be reset without warning.
-- ---------------------------------------------------------------------------

create table if not exists public.submissions (
  id              uuid primary key,
  form_title      text,
  answers         jsonb       not null default '[]'::jsonb,
  files           jsonb       not null default '[]'::jsonb,
  answered_count  integer,
  question_count  integer,
  emailed         boolean     not null default false,
  email_error     text,
  user_agent      text,
  started_at      timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists submissions_created_at_idx
  on public.submissions (created_at desc);

alter table public.submissions enable row level security;
-- Deliberately no policies: service role only.

-- ---------------------------------------------------------------------------
-- Storage bucket. Private. 30 MB a file, which clears the 10-25 MB phone
-- photos the brief calls for with room to spare.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'intake-uploads',
  'intake-uploads',
  false,
  31457280,
  array['image/*', 'application/pdf', 'application/octet-stream']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "intake_anon_insert" on storage.objects;

create policy "intake_anon_insert"
  on storage.objects
  for insert
  to anon
  with check (bucket_id = 'intake-uploads');

-- Only the service role (the edge function) touches this table. RLS blocks
-- everyone else, and withholding the grants outright is the second lock.
grant select, insert, update on public.submissions to service_role;
revoke all on public.submissions from anon, authenticated;

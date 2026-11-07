-- Run once in the Supabase SQL Editor. No browser/anonymous access.
create table if not exists public.generated_guides (
  id uuid primary key,
  record jsonb not null,
  created_at timestamptz not null default now(),
  constraint guide_record_identity check ((record->>'id' = id::text) is true),
  constraint guide_record_status check (
    (record->>'status' = 'generated-draft' and
    record->>'reviewStatus' = 'not-human-reviewed' and
    record->>'oauthTestStatus' = 'not-tested') is true
  ),
  constraint guide_record_size check (octet_length(record::text) <= 600000)
);
alter table public.generated_guides enable row level security;
revoke all on public.generated_guides from anon, authenticated;
grant select, insert on public.generated_guides to service_role;
-- Deliberately no public policies, update, or delete operations for the app.

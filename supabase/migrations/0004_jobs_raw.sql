-- 0004_jobs_raw.sql
-- Add jobs.raw jsonb, jobs.department text, unique index on jobs(ats, external_id),
-- and companies.sync_requested_at for on-demand sync triggering.

alter table public.jobs
  add column if not exists raw jsonb not null default '{}'::jsonb;

alter table public.jobs
  add column if not exists department text;

create unique index if not exists idx_jobs_ats_external_id
  on public.jobs (ats, external_id);

alter table public.companies
  add column if not exists sync_requested_at timestamptz;

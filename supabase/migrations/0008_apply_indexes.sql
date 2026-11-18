-- 0008_apply_indexes.sql
-- Add dry_run column to applications and helpful indexes for apply flow

alter table public.applications
  add column if not exists dry_run boolean not null default false;

comment on column public.applications.dry_run is 'True if this application was run in dry-run mode (form filled, screenshots taken, but submit bypassed).';

create index if not exists idx_applications_run_status
  on public.applications(run_status);

create index if not exists idx_applications_user_job
  on public.applications(user_id, job_id);

-- 0007_tailored_resumes_step6.sql
-- Add cover_letter, truth_check_ok, tailoring_strength columns to tailored_resumes,
-- and a unique constraint on (user_id, job_id) needed for upsert in the tailoring worker.

-- Add unique constraint (idempotent via DO block)
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.tailored_resumes'::regclass
      and contype = 'u'
      and conname = 'tailored_resumes_user_id_job_id_key'
  ) then
    alter table public.tailored_resumes
      add constraint tailored_resumes_user_id_job_id_key unique (user_id, job_id);
  end if;
end $$;

alter table public.tailored_resumes
  add column if not exists cover_letter      text,
  add column if not exists truth_check_ok    boolean not null default true,
  add column if not exists tailoring_strength text    not null default 'medium';

comment on column public.tailored_resumes.cover_letter       is 'AI-generated cover letter (≤150 words).';
comment on column public.tailored_resumes.truth_check_ok     is 'False when the AI output failed truth-check and the base resume was used instead.';
comment on column public.tailored_resumes.tailoring_strength is 'Strength mode used: light | medium | strong.';

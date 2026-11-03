-- 0001_init.sql
-- Qlam Initial Database Schema, Security, and Storage Configuration

-- 1. EXTENSIONS
create extension if not exists vector;

-- 2. ENUMS
create type public.ats_type as enum (
  'greenhouse',
  'lever',
  'ashby'
);

create type public.match_status as enum (
  'new',
  'saved',
  'skipped',
  'queued',
  'applied'
);

create type public.run_status as enum (
  'queued',
  'running',
  'needs_user',
  'submitted',
  'failed'
);

create type public.stage as enum (
  'applied',
  'interviewing',
  'offer',
  'rejected',
  'ghosted'
);

create type public.email_category as enum (
  'otp',
  'confirmation',
  'interview',
  'rejection',
  'other'
);

create type public.plan_type as enum (
  'free',
  'starter',
  'pro'
);

create type public.answer_source as enum (
  'user',
  'ai'
);

create type public.application_mode as enum (
  'manual',
  'auto'
);

-- 3. REUSABLE FUNCTIONS
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create or replace function public.generate_inbox_alias()
returns text
language plpgsql
as $$
declare
  chars text := 'abcdefghijklmnopqrstuvwxyz0123456789';
  result text := '';
  i integer;
begin
  for i in 1..8 loop
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  end loop;
  return result;
end;
$$;

-- 4. TABLES

-- 1. profiles
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  name text,
  phone text,
  city text,
  links jsonb not null default '{}'::jsonb,
  work_authorization text,
  needs_sponsorship boolean not null default false,
  notice_period_days integer,
  expected_salary text,
  preferences jsonb not null default '{}'::jsonb,
  inbox_alias text not null unique,
  onboarding_done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. resumes
create table public.resumes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  file_path text not null,
  parsed jsonb not null default '{}'::jsonb,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. answers
create table public.answers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question_key text not null,
  question_text text not null,
  answer text not null,
  source public.answer_source not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4. companies
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  ats public.ats_type not null,
  board_token text not null,
  active boolean not null default true,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ats, board_token)
);

-- 5. jobs
create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  ats public.ats_type not null,
  external_id text not null,
  title text not null,
  location text,
  is_remote boolean not null default false,
  description_text text,
  apply_url text not null,
  posted_at timestamptz,
  embedding vector(768),
  is_open boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ats, external_id)
);

create index jobs_embedding_hnsw_idx on public.jobs using hnsw (embedding vector_cosine_ops);

-- 6. matches
create table public.matches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  score integer not null check (score >= 0 and score <= 100),
  reasons jsonb not null default '{}'::jsonb,
  status public.match_status not null default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, job_id)
);

-- 7. tailored_resumes
create table public.tailored_resumes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  base_resume_id uuid not null references public.resumes(id) on delete cascade,
  content jsonb not null default '{}'::jsonb,
  pdf_path text,
  approved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 8. applications
create table public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  tailored_resume_id uuid references public.tailored_resumes(id) on delete set null,
  run_status public.run_status not null default 'queued',
  stage public.stage not null default 'applied',
  mode public.application_mode not null default 'auto',
  attempts integer not null default 0,
  error text,
  needs_user_reason text,
  filled_fields jsonb not null default '{}'::jsonb,
  screenshot_paths text[] not null default '{}'::text[],
  confirmation_text text,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, job_id)
);

-- 9. emails
create table public.emails (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  application_id uuid references public.applications(id) on delete set null,
  from_address text not null,
  subject text not null,
  text_body text,
  category public.email_category not null default 'other',
  otp_code text,
  read boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 10. subscriptions
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan public.plan_type not null default 'free',
  monthly_quota integer not null default 25,
  used_this_period integer not null default 0,
  period_end timestamptz,
  razorpay_subscription_id text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 11. events
create table public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- 5. INDEXES
create index idx_profiles_user_id on public.profiles(user_id);
create index idx_resumes_user_id on public.resumes(user_id);
create index idx_answers_user_id on public.answers(user_id);
create index idx_jobs_company_id on public.jobs(company_id);
create index idx_matches_user_id on public.matches(user_id);
create index idx_matches_job_id on public.matches(job_id);
create index idx_tailored_resumes_user_id on public.tailored_resumes(user_id);
create index idx_applications_user_id on public.applications(user_id);
create index idx_applications_job_id on public.applications(job_id);
create index idx_emails_user_id on public.emails(user_id);
create index idx_emails_application_id on public.emails(application_id);
create index idx_subscriptions_user_id on public.subscriptions(user_id);
create index idx_events_user_id on public.events(user_id);

-- 6. UPDATED_AT TRIGGERS
create trigger update_profiles_updated_at before update on public.profiles
  for each row execute function public.update_updated_at_column();
create trigger update_resumes_updated_at before update on public.resumes
  for each row execute function public.update_updated_at_column();
create trigger update_answers_updated_at before update on public.answers
  for each row execute function public.update_updated_at_column();
create trigger update_companies_updated_at before update on public.companies
  for each row execute function public.update_updated_at_column();
create trigger update_jobs_updated_at before update on public.jobs
  for each row execute function public.update_updated_at_column();
create trigger update_matches_updated_at before update on public.matches
  for each row execute function public.update_updated_at_column();
create trigger update_tailored_resumes_updated_at before update on public.tailored_resumes
  for each row execute function public.update_updated_at_column();
create trigger update_applications_updated_at before update on public.applications
  for each row execute function public.update_updated_at_column();
create trigger update_emails_updated_at before update on public.emails
  for each row execute function public.update_updated_at_column();
create trigger update_subscriptions_updated_at before update on public.subscriptions
  for each row execute function public.update_updated_at_column();

-- 7. NEW USER TRIGGER
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_alias text;
  alias_exists boolean;
begin
  loop
    new_alias := public.generate_inbox_alias();
    select exists(select 1 from public.profiles where inbox_alias = new_alias) into alias_exists;
    exit when not alias_exists;
  end loop;

  insert into public.profiles (user_id, inbox_alias, name)
  values (
    new.id,
    new_alias,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', '')
  );

  insert into public.subscriptions (user_id, plan, monthly_quota, used_this_period, status)
  values (
    new.id,
    'free',
    25,
    0,
    'active'
  );

  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 8. ROW LEVEL SECURITY (RLS)
alter table public.profiles enable row level security;
alter table public.resumes enable row level security;
alter table public.answers enable row level security;
alter table public.companies enable row level security;
alter table public.jobs enable row level security;
alter table public.matches enable row level security;
alter table public.tailored_resumes enable row level security;
alter table public.applications enable row level security;
alter table public.emails enable row level security;
alter table public.subscriptions enable row level security;
alter table public.events enable row level security;

-- User-owned tables policies
-- Profiles, resumes, answers, matches, tailored_resumes, applications: full management on own rows
create policy "Users can manage own profiles" on public.profiles
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can manage own resumes" on public.resumes
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can manage own answers" on public.answers
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can manage own matches" on public.matches
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can manage own tailored resumes" on public.tailored_resumes
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can manage own applications" on public.applications
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Subscriptions, emails, events: read-only for authenticated users on own rows (service role / triggers handle writes)
create policy "Users can view own subscriptions" on public.subscriptions
  for select to authenticated
  using (auth.uid() = user_id);

create policy "Users can view own emails" on public.emails
  for select to authenticated
  using (auth.uid() = user_id);

create policy "Users can view own events" on public.events
  for select to authenticated
  using (auth.uid() = user_id);

-- Catalog tables policies (signed-in users can read, only service role can write)
create policy "Signed in users can read companies" on public.companies
  for select to authenticated
  using (true);

create policy "Signed in users can read jobs" on public.jobs
  for select to authenticated
  using (true);

-- 9. STORAGE BUCKETS & POLICIES
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('resumes', 'resumes', false, null, null),
  ('tailored', 'tailored', false, null, null),
  ('screenshots', 'screenshots', false, null, null)
on conflict (id) do nothing;

create policy "Users can read own files in private buckets"
  on storage.objects for select to authenticated
  using (
    bucket_id in ('resumes', 'tailored', 'screenshots')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can upload own files to private buckets"
  on storage.objects for insert to authenticated
  with check (
    bucket_id in ('resumes', 'tailored', 'screenshots')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can update own files in private buckets"
  on storage.objects for update to authenticated
  using (
    bucket_id in ('resumes', 'tailored', 'screenshots')
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id in ('resumes', 'tailored', 'screenshots')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can delete own files in private buckets"
  on storage.objects for delete to authenticated
  using (
    bucket_id in ('resumes', 'tailored', 'screenshots')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 0006_scoring_limits_and_match_job.sql
-- 1. Daily AI scoring usage tracking
create table if not exists public.daily_scoring_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null default current_date,
  count integer not null default 0 check (count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, usage_date)
);

-- RLS: Authenticated users only get SELECT on daily_scoring_usage
alter table public.daily_scoring_usage enable row level security;

create policy "Users can view own daily scoring usage" on public.daily_scoring_usage
  for select to authenticated
  using (auth.uid() = user_id);

-- 2. Read-only function to check daily scoring count for a user
create or replace function public.get_daily_scoring_count(
  p_user_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  -- Verify caller authorization: caller must be service_role or authenticated as p_user_id
  if auth.role() <> 'service_role' and (auth.uid() is null or auth.uid() <> p_user_id) then
    raise exception 'Unauthorized';
  end if;

  select coalesce(count, 0)
  into v_count
  from public.daily_scoring_usage
  where user_id = p_user_id and usage_date = current_date;

  return coalesce(v_count, 0);
end;
$$;

-- 3. Function to increment daily scoring count after a successful score
create or replace function public.increment_daily_scoring(
  p_user_id uuid,
  p_increment int default 1
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_count int;
begin
  -- Verify caller authorization: caller must be service_role or authenticated as p_user_id
  if auth.role() <> 'service_role' and (auth.uid() is null or auth.uid() <> p_user_id) then
    raise exception 'Unauthorized';
  end if;

  insert into public.daily_scoring_usage (user_id, usage_date, count, updated_at)
  values (p_user_id, current_date, greatest(1, p_increment), now())
  on conflict (user_id, usage_date)
  do update set
    count = public.daily_scoring_usage.count + excluded.count,
    updated_at = now()
  returning count into v_new_count;

  return v_new_count;
end;
$$;

-- 4. Add match_requested_at and last_matched_at to profiles for worker matching
alter table public.profiles
  add column if not exists match_requested_at timestamptz,
  add column if not exists last_matched_at timestamptz;

-- 5. Grants
grant select on public.daily_scoring_usage to authenticated, service_role;
grant execute on function public.get_daily_scoring_count(uuid) to authenticated, service_role;
grant execute on function public.increment_daily_scoring(uuid, int) to authenticated, service_role;

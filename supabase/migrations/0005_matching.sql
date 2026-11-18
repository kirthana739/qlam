-- 0005_matching.sql
-- Matching engine: profiles embedding vector, match_jobs function, and grants

-- 1. Add 768-dimensional embedding column to profiles
alter table public.profiles
  add column if not exists embedding vector(768);

-- 2. Ensure unique constraint on public.matches(user_id, job_id)
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'matches_user_id_job_id_key'
       or (conrelid = 'public.matches'::regclass and contype = 'u')
  ) then
    alter table public.matches
      add constraint matches_user_id_job_id_key unique (user_id, job_id);
  end if;
end $$;

-- 3. Function to find open jobs closest to profile embedding by cosine similarity with hard filters
create or replace function public.match_jobs(
  p_user_id uuid,
  p_limit int default 30
)
returns table (
  id uuid,
  company_id uuid,
  company_name text,
  ats public.ats_type,
  title text,
  location text,
  is_remote boolean,
  department text,
  description_text text,
  apply_url text,
  posted_at timestamptz,
  similarity float8
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_embedding vector(768);
  v_excluded text[];
begin
  -- Verify caller authorization: caller must be service_role or authenticated as p_user_id
  if auth.role() <> 'service_role' and (auth.uid() is null or auth.uid() <> p_user_id) then
    raise exception 'Unauthorized';
  end if;

  -- 1. Fetch user profile embedding and excluded companies
  select
    p.embedding,
    array(
      select distinct lower(trim(val))
      from (
        select jsonb_array_elements_text(coalesce(p.preferences->'excluded_companies', '[]'::jsonb)) as val
        union
        select jsonb_array_elements_text(coalesce(p.preferences->'companies_to_avoid', '[]'::jsonb)) as val
      ) s
      where trim(val) <> ''
    )
  into v_user_embedding, v_excluded
  from public.profiles p
  where p.user_id = p_user_id;

  -- If user has no embedding yet, return empty set
  if v_user_embedding is null then
    return;
  end if;

  -- 2. Return matching jobs closest to user embedding by cosine similarity
  return query
  select
    j.id,
    j.company_id,
    c.name as company_name,
    j.ats,
    j.title,
    j.location,
    j.is_remote,
    j.department,
    j.description_text,
    j.apply_url,
    j.posted_at,
    (1 - (j.embedding <=> v_user_embedding))::float8 as similarity
  from public.jobs j
  join public.companies c on c.id = j.company_id
  where
    j.is_open = true
    and j.embedding is not null
    and (j.posted_at >= (now() - interval '30 days') or j.posted_at is null)
    and not exists (
      select 1
      from public.matches m
      where m.user_id = p_user_id
        and m.job_id = j.id
        and m.status in ('skipped', 'applied')
    )
    and (
      cardinality(v_excluded) = 0
      or not exists (
        select 1
        from unnest(v_excluded) exc
        where lower(c.name) = exc or lower(c.name) like '%' || exc || '%'
      )
    )
  order by j.embedding <=> v_user_embedding asc
  limit coalesce(p_limit, 30);
end;
$$;

-- 4. Grant execute to authenticated and service_role
grant execute on function public.match_jobs(uuid, int) to authenticated, service_role;

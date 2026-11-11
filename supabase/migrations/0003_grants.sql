-- 0003_grants.sql
-- Give API roles table privileges. Row-level security still limits each user to their own rows.

grant usage on schema public to authenticated, service_role;

grant select, insert, update, delete on
  public.profiles,
  public.resumes,
  public.answers,
  public.matches,
  public.tailored_resumes,
  public.applications
to authenticated;

grant select on
  public.subscriptions,
  public.emails,
  public.events,
  public.companies,
  public.jobs
to authenticated;

grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;

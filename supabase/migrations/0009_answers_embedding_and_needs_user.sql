-- 0009_answers_embedding_and_needs_user.sql
-- Step 7b: Add vector embedding to answers bank for semantic search and match_answers RPC

-- 1. Add 768-dimensional embedding column to answers table
alter table public.answers
  add column if not exists embedding vector(768);

comment on column public.answers.embedding is 'Gemini 768-dimensional normalized text embedding of question_text.';

-- 2. HNSW cosine index for fast semantic lookup of past answers
create index if not exists idx_answers_embedding
  on public.answers using hnsw (embedding vector_cosine_ops);

-- 3. Stored function to find matching answers by question semantic similarity
create or replace function public.match_answers(
  p_user_id uuid,
  p_query_embedding vector(768),
  p_match_threshold float8 default 0.80,
  p_limit int default 5
)
returns table (
  id uuid,
  question_key text,
  question_text text,
  answer text,
  source public.answer_source,
  similarity float8
)
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Caller authorization: service_role or the user themselves
  if auth.role() <> 'service_role' and (auth.uid() is null or auth.uid() <> p_user_id) then
    raise exception 'Unauthorized';
  end if;

  return query
  select
    a.id,
    a.question_key,
    a.question_text,
    a.answer,
    a.source,
    1 - (a.embedding <=> p_query_embedding) as similarity
  from public.answers a
  where a.user_id = p_user_id
    and a.embedding is not null
    and (1 - (a.embedding <=> p_query_embedding)) >= p_match_threshold
  order by a.embedding <=> p_query_embedding
  limit p_limit;
end;
$$;

-- 4. Permissions
grant execute on function public.match_answers(uuid, vector(768), float8, int) to authenticated;
grant execute on function public.match_answers(uuid, vector(768), float8, int) to service_role;

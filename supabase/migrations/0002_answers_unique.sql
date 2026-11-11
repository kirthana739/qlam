-- 0002_answers_unique.sql
-- Add unique constraint on public.answers(user_id, question_key) to enable idempotent upserts

alter table public.answers
  add constraint answers_user_id_question_key_unique unique (user_id, question_key);

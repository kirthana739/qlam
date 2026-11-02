\# Qlam: rules for AI agents



\## What Qlam is

An AI job-application agent. Users upload a resume once. Qlam matches

them to jobs on Greenhouse, Lever and Ashby, tailors the resume per job,

applies through a browser worker, and tracks replies in a Qlam inbox.



\## Stack (never change without asking)

\- npm workspaces: apps/web (Next.js App Router, TS), apps/worker (Node 22, TS),

&nbsp; apps/inbox (Cloudflare Email Worker), packages/core (shared code)

\- Supabase: Postgres + pgvector, Auth, Storage. SQL migrations in

&nbsp; supabase/migrations

\- UI: Tailwind + shadcn/ui, mobile-first

\- Queue: pg-boss. Browser: Playwright + Stagehand

\- AI: only through packages/core/src/ai.ts. Validate every AI output with zod



\## Rules

\- Write an implementation plan first and wait for approval.

\- TypeScript strict, no `any`. Zod for every API input and every AI output.

\- Every user table has row-level security. The service role key never reaches

&nbsp; the browser.

\- Never hardcode secrets; read them from env.

\- Never invent facts about a user. Tailoring may reorder, cut or rephrase;

&nbsp; it never adds skills, employers, dates, titles or degrees.

\- Never write code that solves or bypasses CAPTCHAs or bot checks. If one

&nbsp; appears, stop and set the application to needs\_user.

\- Keep files under ~300 lines; split by feature.

\- Before saying done: run `npm run typecheck` and `npm run lint`, fix all

&nbsp; errors.

\- Never edit a migration that already ran; add a new one.

\- Ask before adding any new dependency.


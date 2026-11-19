# Qlam

**Upload your resume once. Qlam finds jobs that fit you, tailors your resume for each one, applies for you, and tracks every reply.**

Qlam is an AI job-application agent. Its edge is **match quality, not volume**: it only applies where the user has a real shot.

## Live demo

**[Open Qlam](https://REPLACE-WITH-YOUR-VERCEL-LINK.vercel.app)**

> Status: login, resume parsing, job matching and the jobs feed are live. The apply agent runs in **dry-run mode only** (it fills forms and takes screenshots but never submits) and is not part of the hosted demo, because it needs an always-on worker server.

Sign in with Google. If sign-in is blocked, the account needs to be added as a test user.

## What it does

1. Sign in with Google.
2. Upload a resume PDF. Qlam parses it into an editable profile.
3. Answer common form questions once and set job preferences.
4. See a feed of matched jobs, each with a score (0-100), a one-line "why it fits", and a list of gaps and dealbreakers.
5. Save or skip jobs. Apply creates an application for the agent.
6. The agent tailors the resume truthfully, fills the employer's form, and saves proof.

## Build status

| Step | Feature | Status |
|---|---|---|
| 1 | Monorepo, design system, Google login, app shell | Done |
| 2 | Database schema, row-level security, storage buckets | Done |
| 3 | Onboarding and AI resume parsing | Done |
| 4 | Job ingestion from Greenhouse, Lever and Ashby public feeds | Done |
| 5 | Matching engine (filters, vectors, AI judge) and jobs feed | Done |
| 6 | Resume tailoring, code-based truth check, PDF, review page | Done |
| 7a | Apply agent: Greenhouse (dry-run, fixtures) | Done |
| 7b | Answer engine and "Needs you" flow | Done |
| 7c | Apply agent: Lever and Ashby | Done |
| 7d | Email codes, review before submit, CAPTCHA page, per-company limit | Next |
| 8 | Qlam inbox (codes and employer replies) | Planned |
| 9 | Application tracker board | Planned |
| 10 | Auto Apply scheduler and daily caps | Planned |
| 11 | Plans and Razorpay payments | Planned |
| 12 | Privacy, consent, data export and delete, admin metrics | Planned |
| 13 | Full test suite, CI, deployment configs, beta | Planned |

**Tests:** 51 passing (31 worker tests, 20 core tests). Typecheck and lint are clean.

## How matching works

Three passes, cheapest to smartest:

1. **Hard filters (SQL):** job is open, posted in the last 30 days, company not excluded, not already skipped or applied.
2. **Vector shortlist:** the profile embedding (target roles, skills, recent titles, summary) is compared with job embeddings.
3. **AI judge:** Gemini scores each job from 0 to 100 using a rubric: role fit 40, skills 30, seniority 20, eligibility 10. Any dealbreaker caps the score at 30 and is shown on the card.

Limits: at most 10 new jobs scored per request and 50 AI scoring calls per user per day. AI calls retry with backoff on 429 and 503 errors.

## How the apply agent works

Known code first, AI only for what is new.

- A fresh browser context per run, with timeouts and an overall 5-minute limit.
- Known fields (name, email, phone, links, resume upload) are filled by hand-written code per system (Greenhouse, Lever, Ashby).
- Custom questions go through the **answer engine**: answers bank, then profile mapping, then AI from verified facts only, otherwise the user is asked.
- **Legal and eligibility questions** (work authorization, sponsorship, criminal record, age, disability, gender, race, veteran) are never answered by AI. They come from the profile or the user.
- If a CAPTCHA or bot check appears, the run stops as `needs_user`. Qlam never solves or bypasses them.
- Every run saves screenshots, filled fields and an event log.

## Safety rules

- **Never invent facts.** Tailoring may reorder, cut or rephrase. A truth check written in plain code (not AI) compares every employer, title, school, degree, date, skill and number against the base resume. If it fails, the original resume is used.
- **Dry-run by default.** A real submission needs both `DRY_RUN=false` and `ALLOW_LIVE_SUBMIT=true`. Tests run only against local fixture forms, never real companies.
- **No CAPTCHA solving, stealth plugins or evasion proxies.**
- **No LinkedIn scraping.** Jobs come only from public feeds that need no login.
- **Row-level security** on every user table. The service role key never reaches the browser.
- No secrets in code, and no phone numbers, emails or email bodies in logs.

## Tech stack

| Layer | Choice |
|---|---|
| Web app | Next.js (App Router) + TypeScript |
| UI | Tailwind CSS + shadcn/ui |
| Data, login, files, vectors | Supabase (Postgres + pgvector) |
| Background jobs | pg-boss |
| Apply agent | Playwright (Stagehand as an optional element locator) |
| AI | Gemini, behind one `ai.ts` file |
| PDFs | HTML template rendered with Playwright |
| Planned | Cloudflare Email Routing, Resend, Razorpay, Vercel, Railway |

## Project structure

```
apps/
  web/        Next.js app: pages, UI, API routes
  worker/     Node worker: job ingestion, matching, tailoring, apply agent
  inbox/      Cloudflare Email Worker (planned)
packages/
  core/       Shared types, zod schemas, prompts, truth check, AI helper
supabase/
  migrations/ One SQL file per database change (0001 to 0009 so far)
  seed/       Company list for job ingestion
AGENTS.md     House rules for AI coding agents
```

## Run it locally

Requirements: Node.js 22+, a Supabase project, a Gemini API key.

```bash
npm install
npx playwright install chromium
```

Create `apps/web/.env.local` and `apps/worker/.env` from the `.env.example` files and fill in your own values. Never commit them.

Run the SQL files in `supabase/migrations` in number order in the Supabase SQL Editor, then:

```bash
npm run dev          # web app on http://localhost:3000
npm run typecheck
npm run lint
npm test             # worker and core tests
```

## Roadmap

1. Finish the apply agent (Step 7d), then the Qlam inbox, tracker, Auto Apply and payments.
2. Privacy, consent, data export and deletion, then production deployment and a 20-person private beta.
3. More hiring systems (Workday, iCIMS, SmartRecruiters), a Chrome extension, and interview prep.

## Notes

This is a work in progress. Applying is in dry-run mode and nothing is submitted to real employers. The privacy policy and terms will be reviewed by a lawyer before any public launch.

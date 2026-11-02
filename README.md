# Qlam

An AI job-application agent. Users upload a resume once, and Qlam matches them to jobs on Greenhouse, Lever, and Ashby, tailors the resume per job, applies through a browser worker, and tracks replies in a Qlam inbox.

## Tech Stack

- **Monorepo**: npm workspaces (`apps/web`, `apps/worker`, `apps/inbox`, `packages/core`)
- **Frontend**: Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui (mobile-first)
- **Worker**: Node.js 22, TypeScript, Playwright + Stagehand
- **Inbox**: Cloudflare Email Worker
- **Backend & Database**: Supabase (Postgres + pgvector, Auth, Storage)
- **Queue**: pg-boss
- **AI**: Packages/core AI wrapper (`packages/core/src/ai.ts`) validated with Zod

## Status

Status: just started

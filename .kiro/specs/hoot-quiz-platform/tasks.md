# Implementation Plan: Hoot Quiz Platform

## Overview

Incremental implementation of the Hoot real-time quiz platform on Next.js 14 (App Router, TypeScript), Supabase (PostgreSQL, Auth, Realtime, Storage), Tailwind CSS, and shadcn/ui. Tasks are ordered so each step builds on the previous, ending with full integration and deployment.

## Tasks

- [x] 1. Project scaffolding and configuration
  - Initialise Next.js 14 project with App Router and TypeScript (`create-next-app`)
  - Install and configure Tailwind CSS and shadcn/ui
  - Install Supabase client libraries (`@supabase/supabase-js`, `@supabase/ssr`)
  - Create `.env.local` with `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
  - Set up Vitest with `vitest.config.ts`, install `fast-check ^3.x` and `@vitest/coverage-v8`
  - Install Playwright and initialise `playwright.config.ts`
  - Create `tests/unit/`, `tests/integration/`, `tests/e2e/` directory structure
  - Install supporting packages: `qrcode`, `@dnd-kit/core`, `papaparse`, `canvas-confetti`
  - _Requirements: all_


- [x] 2. Database schema migrations and RLS
  - [x] 2.1 Create Supabase migration files for all tables
    - Write SQL migrations for `profiles`, `events`, `questions`, `answer_options`, `sessions`, `session_participants`, `participant_answers`, `analytics_snapshots`, `join_code_history`
    - Add all CHECK constraints, UNIQUE indexes, and foreign keys as defined in the design
    - Create `profiles` auto-creation trigger on `auth.users` insert
    - _Requirements: 2.1, 2.4, 3.1–3.8, 4.2, 5.3, 5.6, 8.1, 10.4, 13.1_
  - [x] 2.2 Write RLS policies
    - Enable RLS on all tables and write policies for `events`, `questions`, `sessions`, `analytics_snapshots` as defined in the design
    - Confirm `session_participants` and `participant_answers` are service-role-only (no direct client access)
    - _Requirements: 1.1, 2.1, 13.1_
  - [x] 2.3 Create Supabase Storage buckets
    - Create `question-images` (private, 5 MB, JPEG/PNG/GIF/WebP) and `event-logos` (public, 2 MB, JPEG/PNG/SVG) buckets with storage policies
    - _Requirements: 3.5, 15.4_


- [x] 3. Supabase Auth integration and middleware
  - [x] 3.1 Implement auth utility helpers
  - [x] 3.2 Implement Next.js middleware auth guard
  - [x] 3.3 Build auth pages and API routes


- [x] 4. Event management — API routes and dashboard UI
  - [x] 4.1 Implement event CRUD API routes
  - [x]* 4.2 Write property test for event title validation (P1)
    - File: `tests/unit/event-validation.test.ts`
  - [x]* 4.3 Write property test for new events in draft state (P2)
    - File: `tests/unit/event-creation.test.ts`
  - [x]* 4.4 Write property test for duplicate title rejection (P3)
    - File: `tests/unit/event-creation.test.ts`
  - [x]* 4.5 Write property test for event list ordering (P4)
    - File: `tests/unit/event-list.test.ts`
  - [x] 4.6 Build dashboard UI


- [x] 5. Question authoring — API routes and editor UI
  - [x] 5.1 Implement question CRUD API routes
  - [x]* 5.2 Write property tests for question validation (P5, P7, P8)
    - File: `tests/unit/question-validation.test.ts`
  - [x] 5.3 Implement file upload API route and image validation
  - [x]* 5.4 Write property test for image file validation (P6)
    - File: `tests/unit/file-validation.test.ts`
  - [x] 5.5 Build question editor UI


- [x] 6. Event publishing — API route and publish panel UI
  - [x] 6.1 Implement publish/unpublish API route
  - [x]* 6.2 Write property tests for publishing (P9, P10, P11, P12)
    - File: `tests/unit/publish.test.ts`
  - [x] 6.3 Build publish panel UI


- [x] 7. Participant join flow
  - [x] 7.1 Implement participant join API route
  - [x]* 7.2 Write property tests for display name validation (P13, P14)
    - File: `tests/unit/join-validation.test.ts`
  - [x] 7.3 Build join pages


- [x] 8. Session lobby — real-time participant grid
  - [x] 8.1 Implement session start API route
  - [x] 8.2 Build presenter lobby screen
  - [x] 8.3 Build participant waiting screen


- [x] 9. Quiz flow — session advance, countdown, and question display
  - [x] 9.1 Implement session advance API route
  - [x] 9.2 Build countdown and question views (presenter)
  - [x] 9.3 Build countdown and question views (participant)


- [x] 10. Scoring engine
  - [x] 10.1 Implement answer submission API route and scoring logic
  - [x]* 10.2 Write property tests for scoring (P15, P16, P17, P18, P19, P25)
    - File: `tests/unit/scoring.test.ts`

- [x] 11. Checkpoint — ensure all tests pass
  - 85/85 unit tests pass. Zero TypeScript errors.


- [x] 12. Post-question results and leaderboard
  - [x] 12.1 Implement results reveal in advance route
  - [x] 12.2 Implement leaderboard computation
  - [x]* 12.3 Write property test for leaderboard ordering (P20)
    - File: `tests/unit/leaderboard.test.ts`
  - [x] 12.4 Build results and leaderboard views (presenter and participant)


- [x] 13. Final leaderboard and session end
  - [x] 13.1 Build final leaderboard view
  - [x] 13.2 Implement session end API route

- [x] 14. Session reconnection
  - [x] 14.1 Implement reconnection logic in participant screen
  - [x] 14.2 Implement reconnection state restoration in join API route
  - [x]* 14.3 Write property test for reconnection state restoration (P21)
    - File: `tests/unit/reconnection.test.ts`


- [x] 15. Analytics and CSV export
  - [x] 15.1 Implement analytics snapshot generation
    - `lib/analytics.ts` → `generateAnalyticsSnapshots()` called on session end
  - [x]* 15.2 Write property tests for analytics snapshot correctness (P22, P23)
    - File: `tests/unit/analytics.test.ts`
  - [x] 15.3 Implement analytics API routes
    - `GET /api/v1/analytics/[sessionId]` and `GET /api/v1/analytics/[sessionId]/export`
  - [x] 15.4 Build analytics summary UI
    - `app/(dashboard)/events/[eventId]/analytics/[sessionId]/page.tsx`


- [x] 16. Word cloud for open-text questions
  - [x] 16.1 Implement word cloud aggregation in answer submission route
  - [x]* 16.2 Write property tests for open-text validation and word cloud (P24, P26)
    - File: `tests/unit/question-validation.test.ts` (P24), `tests/unit/word-cloud.test.ts` (P26)
  - [x] 16.3 Build word cloud presenter view
    - `WordCloudView` component in presenter screen


- [x] 17. Theming and branding
  - [x] 17.1 Implement theme data and API
    - `lib/themes.ts` — 6 built-in themes, 3 fonts; PATCH `/api/v1/events/[eventId]` supports `theme_id` and `custom_theme`
  - [x] 17.2 Build theme selector UI and logo upload
    - `app/(dashboard)/events/[eventId]/edit/page.tsx`

- [x] 18. Mobile-responsive design
  - [x] 18.1 Audit and fix participant screen responsiveness
    - `overflow-x-hidden` on body; all pages use `max-w-*`, `px-4`, `min-h-[44px]` touch targets
  - [x]* 18.2 Write Playwright E2E test for participant journey
    - File: `tests/e2e/participant-journey.test.ts`


- [x] 19. Integration tests
  - [x]* 19.1 Write integration test: participant join → answer → score persisted
    - File: `tests/integration/session-flow.test.ts`
  - [x]* 19.2 Write integration test: session advance → Realtime broadcast received
    - File: `tests/integration/realtime.test.ts`
  - [x]* 19.3 Write integration test: session end → analytics snapshot generated
    - File: `tests/integration/session-flow.test.ts`
  - [x]* 19.4 Write integration test: RLS policies
    - File: `tests/integration/rls.test.ts`

- [x] 20. Checkpoint — ensure all tests pass
  - 85/85 unit tests pass. Zero TypeScript errors (`npx tsc --noEmit`).


- [x] 21. Vercel deployment configuration
  - [x] 21.1 Configure Vercel deployment
    - `vercel.json` created; `next.config.mjs` already has Supabase Storage `remotePatterns`
    - Env vars to set in Vercel dashboard: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
  - [x] 21.2 Set up pg_cron data retention job
    - `supabase/migrations/20240101000005_pg_cron_data_retention.sql`

- [x] 22. Final checkpoint — ensure all tests pass
  - 85/85 unit tests pass. Zero TypeScript errors. All tasks complete.


## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- All 26 correctness properties from the design document are covered by property-based test sub-tasks
- Property tests use `fast-check ^3.x` with Vitest; each test runs a minimum of 100 iterations
- Integration tests require a real Supabase test project (separate from production)
- E2E tests use Playwright against a locally running Next.js dev server
- Participant-facing API routes use the Supabase service role key server-side; participants are never authenticated with Supabase Auth
- Server timestamps (`question_started_at`) are used for scoring to prevent client clock manipulation
- Checkpoints at tasks 11, 20, and 22 ensure incremental validation before proceeding


## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["2.1", "2.2", "2.3"] },
    { "id": 1, "tasks": ["3.1", "3.2", "3.3"] },
    { "id": 2, "tasks": ["4.1", "4.6"] },
    { "id": 3, "tasks": ["4.2", "4.3", "4.4", "4.5", "5.1", "5.3"] },
    { "id": 4, "tasks": ["5.2", "5.4", "5.5", "6.1"] },
    { "id": 5, "tasks": ["6.2", "6.3", "7.1"] },
    { "id": 6, "tasks": ["7.2", "7.3", "8.1"] },
    { "id": 7, "tasks": ["8.2", "8.3", "9.1"] },
    { "id": 8, "tasks": ["9.2", "9.3", "10.1"] },
    { "id": 9, "tasks": ["10.2", "12.1", "12.2"] },
    { "id": 10, "tasks": ["12.3", "12.4", "13.1", "13.2"] },
    { "id": 11, "tasks": ["14.1", "14.2", "15.1"] },
    { "id": 12, "tasks": ["14.3", "15.2", "15.3", "16.1"] },
    { "id": 13, "tasks": ["15.4", "16.2", "16.3", "17.1"] },
    { "id": 14, "tasks": ["17.2", "18.1"] },
    { "id": 15, "tasks": ["18.2", "19.1", "19.2", "19.3", "19.4"] },
    { "id": 16, "tasks": ["21.1", "21.2"] }
  ]
}
```

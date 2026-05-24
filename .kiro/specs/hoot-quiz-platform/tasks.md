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


- [ ] 2. Database schema migrations and RLS
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
    - Create `lib/supabase/server.ts` (server component client), `lib/supabase/client.ts` (browser client), `lib/supabase/middleware.ts` (middleware client) using `@supabase/ssr`
    - _Requirements: 1.1–1.7_
  - [x] 3.2 Implement Next.js middleware auth guard
    - Write `middleware.ts` to protect `/dashboard`, `/events`, `/sessions` routes; redirect unauthenticated requests to `/login`
    - Handle session refresh via `supabase.auth.getSession()` on every request
    - _Requirements: 1.4_
  - [x] 3.3 Build auth pages and API routes
    - Create `app/(auth)/login/page.tsx`, `register/page.tsx`, `reset-password/page.tsx` with shadcn/ui form components
    - Implement `POST /api/v1/auth/register`, `POST /api/v1/auth/logout` API routes
    - Wire password reset email flow via Supabase Auth
    - _Requirements: 1.1, 1.2, 1.3, 1.5, 1.6, 1.7_


- [x] 4. Event management — API routes and dashboard UI
  - [x] 4.1 Implement event CRUD API routes
    - Write `GET /api/v1/events` (list, ordered by `created_at DESC`), `POST /api/v1/events` (create, enforce title uniqueness per admin), `GET/PATCH/DELETE /api/v1/events/[eventId]`
    - Return consistent `ApiError` shape on validation failures (duplicate title → 409 `DUPLICATE_EVENT_TITLE`, active session prevents delete → 409 `SESSION_ACTIVE`)
    - _Requirements: 2.1, 2.2, 2.4, 2.5, 2.6, 2.7_
  - [ ]* 4.2 Write property test for event title validation (P1)
    - **Property 1: Event title validation is length-bounded**
    - **Validates: Requirements 2.1**
    - File: `tests/unit/event-validation.test.ts`
  - [ ]* 4.3 Write property test for new events in draft state (P2)
    - **Property 2: New events are always created in Draft state**
    - **Validates: Requirements 2.2**
    - File: `tests/unit/event-creation.test.ts`
  - [ ]* 4.4 Write property test for duplicate title rejection (P3)
    - **Property 3: Duplicate event titles under the same admin are rejected**
    - **Validates: Requirements 2.4**
    - File: `tests/unit/event-creation.test.ts`
  - [ ]* 4.5 Write property test for event list ordering (P4)
    - **Property 4: Event list is always ordered by creation date descending**
    - **Validates: Requirements 2.7**
    - File: `tests/unit/event-list.test.ts`
  - [x] 4.6 Build dashboard UI
    - Create `app/(dashboard)/layout.tsx` (auth guard shell, sidebar nav, user menu, logout)
    - Create `app/(dashboard)/dashboard/page.tsx` (RSC) rendering `EventCard` list with status badge, question count, action menu
    - Create `app/(dashboard)/events/new/page.tsx` with create-event form
    - _Requirements: 2.1, 2.7_


- [ ] 5. Question authoring — API routes and editor UI
  - [x] 5.1 Implement question CRUD API routes
    - Write `GET/POST /api/v1/events/[eventId]/questions` and `GET/PATCH/DELETE /api/v1/events/[eventId]/questions/[questionId]`
    - Enforce all validation rules: question text [1–255], time limit [5–120], option count [2–4] for choice types, at least one correct option for single/multi-select, rating scale min < max within [1–10]
    - _Requirements: 3.1–3.8_
  - [ ]* 5.2 Write property tests for question validation (P5, P7, P8)
    - **Property 5: Multiple-choice option count is bounded to [2, 4]**
    - **Property 7: Question text length is bounded to [1, 255]**
    - **Property 8: Rating scale min/max validation**
    - **Validates: Requirements 3.2, 3.7, 3.8**
    - File: `tests/unit/question-validation.test.ts`
  - [~] 5.3 Implement file upload API route and image validation
    - Write `POST /api/v1/uploads` to validate MIME type and file size, then return a Supabase Storage signed upload URL
    - Enforce question-image rules (≤5 MB, JPEG/PNG/GIF/WebP) and logo rules (≤2 MB, JPEG/PNG/SVG)
    - _Requirements: 3.5, 3.6, 15.4, 15.5_
  - [ ]* 5.4 Write property test for image file validation (P6)
    - **Property 6: Question image file validation enforces format and size**
    - **Validates: Requirements 3.5, 3.6**
    - File: `tests/unit/file-validation.test.ts`
  - [x] 5.5 Build question editor UI
    - Create `app/(dashboard)/events/[eventId]/page.tsx` with drag-and-drop `QuestionList` (`@dnd-kit/core`) and `QuestionCard`
    - Create `app/(dashboard)/events/[eventId]/questions/new/page.tsx` and `[questionId]/page.tsx` with `QuestionTypeSelector`, `AnswerOptionEditor`, `TimeLimitSlider`, `ImageUploader`, `RatingScaleConfig`
    - _Requirements: 2.3, 3.1–3.8_


- [ ] 6. Event publishing — API route and publish panel UI
  - [ ] 6.1 Implement publish/unpublish API route
    - Write `POST /api/v1/events/[eventId]/publish` handling publish (generate unique 6-char `[A-Z0-9]` join code, record in `join_code_history`, set status to `published`) and unpublish (revert to `draft`, invalidate join code)
    - Reject publish if event has zero questions (422 `EVENT_HAS_NO_QUESTIONS`)
    - On re-publish, generate a new join code distinct from all prior codes for that event
    - _Requirements: 4.1–4.7_
  - [ ]* 6.2 Write property tests for publishing (P9, P10, P11, P12)
    - **Property 9: Published event join codes match the required format**
    - **Property 10: Published event QR code encodes the correct URL**
    - **Property 11: Publishing transitions event to Published state**
    - **Property 12: Unpublish invalidates join code; re-publish generates a distinct new code**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.6, 4.7**
    - File: `tests/unit/publish.test.ts`
  - [x] 6.3 Build publish panel UI
    - Add `PublishPanel` component to `app/(dashboard)/events/[eventId]/page.tsx`
    - Generate QR code client-side using `qrcode` package and render as `<img>` with download link
    - Display join code, QR code, and shareable URL within 2 seconds of publish action
    - _Requirements: 4.3, 4.4_


- [x] 7. Participant join flow
  - [x] 7.1 Implement participant join API route
    - Write `POST /api/v1/sessions/[sessionId]/join` using service role key: validate join code, check session status (not started/ended), check capacity (≤150), check display name uniqueness, create `session_participants` row with `participant_token` (`crypto.randomUUID()`), return token
    - Return descriptive errors: 404 `JOIN_CODE_NOT_FOUND`, 409 `SESSION_ALREADY_STARTED`, 409 `SESSION_AT_CAPACITY`, 409 `DISPLAY_NAME_TAKEN`
    - _Requirements: 5.1–5.8_
  - [ ]* 7.2 Write property tests for display name validation (P13, P14)
    - **Property 13: Display name validation enforces length and character set**
    - **Property 14: Duplicate display names within a session are rejected**
    - **Validates: Requirements 5.3, 5.6**
    - File: `tests/unit/join-validation.test.ts`
  - [x] 7.3 Build join pages
    - Create `app/join/page.tsx` (join code entry form) and `app/join/[joinCode]/page.tsx` (display name + avatar selection with predefined emoji set of ≥20 options)
    - Store `participant_token` in `sessionStorage` after successful join
    - Handle anonymous mode: auto-generate name and avatar, skip selection step
    - _Requirements: 5.1–5.8_


- [x] 8. Session lobby — real-time participant grid
  - [x] 8.1 Implement session start API route
    - Write `POST /api/v1/sessions` to create a session row (`status = 'lobby'`) for a published event
    - Write `GET /api/v1/sessions/[sessionId]` to return current session state (used for reconnection)
    - _Requirements: 6.1, 6.4, 6.5_
  - [x] 8.2 Build presenter lobby screen
    - Create `app/(dashboard)/sessions/[sessionId]/present/page.tsx` (CSR) with `LobbyView`: join code, QR code, live participant grid using Supabase Realtime Presence
    - Subscribe to `session:{sessionId}` channel; track Presence `sync`/`join`/`leave` events to update participant grid and count within 1 second
    - Disable Start button when participant count is 0; enable when ≥1
    - _Requirements: 6.1, 6.2, 6.4, 6.5, 6.6_
  - [x] 8.3 Build participant waiting screen
    - Create `app/play/[sessionId]/page.tsx` (CSR) with `WaitingView`: session title, avatar, "Waiting for host…" message
    - Subscribe to `session:{sessionId}` channel and track Presence; listen for `session_state_changed` broadcast to transition screens
    - _Requirements: 6.3_


- [x] 9. Quiz flow — session advance, countdown, and question display
  - [x] 9.1 Implement session advance API route
    - Write `POST /api/v1/sessions/[sessionId]/advance` to drive the state machine: `lobby → countdown → question → results → leaderboard → (next question or final_leaderboard) → ended`
    - Set `question_started_at` server timestamp when entering `question` state
    - Broadcast `session_state_changed` event (without `is_correct`) to `session:{sessionId}` channel using service role
    - _Requirements: 7.1, 7.2, 9.1, 9.2_
  - [x] 9.2 Build countdown and question views (presenter)
    - Add `CountdownView` (3-2-1 animation) and `QuestionView` (question text, image, answer options display-only, progress bar timer, live answer count) to the presenter screen
    - Add `SessionControls` (Next / End Session buttons) always visible
    - _Requirements: 9.1, 9.2, 11.1_
  - [x] 9.3 Build countdown and question views (participant)
    - Add `CountdownView` (shared component) and `QuestionView` to `app/play/[sessionId]/page.tsx`
    - Render answer options as tappable buttons (min 44×44 CSS px on ≤768 px viewports)
    - Single-select: auto-submit on tap and lock; multi-select: allow toggle + explicit submit button; auto-submit on timer expiry if ≥1 option selected
    - Display image above question text when present
    - Show "Time's up" indicator when timer expires with no selection
    - _Requirements: 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 16.2_


- [x] 10. Scoring engine
  - [x] 10.1 Implement answer submission API route and scoring logic
    - Write `POST /api/v1/sessions/[sessionId]/answers` using service role key: validate `participant_token`, check question is active and time not expired, enforce first-submission-wins via `UNIQUE (participant_id, question_id)` constraint (return 409 `ANSWER_ALREADY_SUBMITTED` on duplicate)
    - Implement `calculateScore(isCorrect, remainingTimeMs, timeLimitMs)` using server timestamps: `max(1, floor(1000 × (remainingTimeMs / timeLimitMs)))` for correct answers, 0 otherwise
    - Multi-select: correct only if selected option IDs exactly match correct option IDs
    - Update `session_participants.total_score` atomically in the same transaction as `participant_answers` insert
    - Broadcast `answer_count_updated` event after each submission
    - _Requirements: 10.1–10.6_
  - [ ]* 10.2 Write property tests for scoring (P15, P16, P17, P18, P19, P25)
    - **Property 15: Incorrect answers always score zero**
    - **Property 16: Correct answer score follows the speed-weighted formula**
    - **Property 17: Unanswered questions always score zero**
    - **Property 18: First-submission-wins for duplicate answer attempts**
    - **Property 19: Score accumulation invariant**
    - **Property 25: Open-text questions always score zero**
    - **Validates: Requirements 10.1–10.6, 14.4**
    - File: `tests/unit/scoring.test.ts`

- [~] 11. Checkpoint — ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.


- [x] 12. Post-question results and leaderboard
  - [x] 12.1 Implement results reveal in advance route
    - When advancing to `results` state, compute response distribution (count + percentage per option) from `participant_answers` and broadcast `results_revealed` event including `correctOptionIds` and `distribution`
    - If all participants have answered before timer expires, trigger immediate advance to results
    - _Requirements: 11.1, 11.2_
  - [x] 12.2 Implement leaderboard computation
    - When advancing to `leaderboard` or `final_leaderboard` state, compute ranked list from `session_participants.total_score` (ties broken by ascending `display_name`), compute `scoreDelta` per participant, broadcast `leaderboard_updated` event
    - Update `session_participants.rank` column in the database
    - _Requirements: 11.3, 11.4, 11.5_
  - [ ]* 12.3 Write property test for leaderboard ordering (P20)
    - **Property 20: Leaderboard ordering by score then name**
    - **Validates: Requirements 11.3, 11.5**
    - File: `tests/unit/leaderboard.test.ts`
  - [x] 12.4 Build results and leaderboard views (presenter and participant)
    - Add `ResultsView` (correct answer highlight, bar chart of response distribution) to presenter screen
    - Add `LeaderboardView` (animated ranked list, top 10, score deltas, 500 ms transitions) to presenter and participant screens
    - Add `ResultFeedbackView` (correct/incorrect indicator, points earned, running total) to participant screen
    - _Requirements: 11.1–11.6_


- [ ] 13. Final leaderboard and session end
  - [x] 13.1 Build final leaderboard view
    - Add `FinalLeaderboardView` to presenter screen: podium for top 3, full ranked list, confetti overlay (≤5 s) using `canvas-confetti`
    - Add `EndView` to participant screen: thank-you message, final rank and score
    - _Requirements: 12.1, 12.2, 12.4_
  - [x] 13.2 Implement session end API route
    - Write `DELETE /api/v1/sessions/[sessionId]` to transition session to `ended`, set `ended_at`, broadcast `session_state_changed { status: 'ended' }`, disconnect all participants
    - _Requirements: 12.3_

- [ ] 14. Session reconnection
  - [~] 14.1 Implement reconnection logic in participant screen
    - On Supabase Realtime `disconnect` system event, set `connectionStatus = 'reconnecting'`; on reconnect, call `GET /api/v1/sessions/[sessionId]` with `participant_token` to fetch current state and re-render
    - Retry every 2 seconds for up to 60 seconds; show reconnection UI after first failure
    - _Requirements: 7.5, 8.1–8.6_
  - [~] 14.2 Implement reconnection state restoration in join API route
    - In `POST /api/v1/sessions/[sessionId]/join`, detect returning participant by `participant_token` in `sessionStorage`; restore `total_score`, answer history, and current screen state
    - Reject reconnection if display name was claimed by another participant during the window (409 `DISPLAY_NAME_TAKEN`)
    - Expire participant record if reconnection window (60 s) has passed
    - _Requirements: 8.1–8.6_
  - [ ]* 14.3 Write property test for reconnection state restoration (P21)
    - **Property 21: Reconnection restores participant state**
    - **Validates: Requirements 8.2**
    - File: `tests/unit/reconnection.test.ts`


- [ ] 15. Analytics and CSV export
  - [~] 15.1 Implement analytics snapshot generation
    - In the session advance route (transition to `ended`), call `generateAnalyticsSnapshots(sessionId)` to compute and upsert `analytics_snapshots` rows (total_responses, option_counts with count + percentage, avg_response_time_ms)
    - _Requirements: 13.1, 13.2_
  - [ ]* 15.2 Write property tests for analytics snapshot correctness (P22, P23)
    - **Property 22: Analytics snapshot correctness**
    - **Property 23: CSV export contains all participants with correct scores**
    - **Validates: Requirements 13.1, 13.2, 13.3**
    - File: `tests/unit/analytics.test.ts`
  - [~] 15.3 Implement analytics API routes
    - Write `GET /api/v1/analytics/[sessionId]` to return per-question summary from `analytics_snapshots`
    - Write `GET /api/v1/analytics/[sessionId]/export` to stream CSV (participant × question score matrix + total, sorted by total score descending)
    - _Requirements: 13.2, 13.3_
  - [~] 15.4 Build analytics summary UI
    - Create `app/(dashboard)/events/[eventId]/analytics/[sessionId]/page.tsx` with per-question stats (response count, option distribution, avg response time) and CSV download button
    - _Requirements: 13.2, 13.3_


- [ ] 16. Word cloud for open-text questions
  - [~] 16.1 Implement word cloud aggregation in answer submission route
    - In `POST /api/v1/sessions/[sessionId]/answers` for `open_text` questions, tokenise the response text, update word frequency counts, and broadcast `word_cloud_updated` event with `{ words: [{ word, count }] }`
    - Enforce 200-character max on `open_text_response`
    - _Requirements: 14.1, 14.2, 14.3, 14.5_
  - [ ]* 16.2 Write property tests for open-text validation and word cloud (P24, P26)
    - **Property 24: Open-text response length is bounded to 200 characters**
    - **Property 26: Word cloud frequency ordering**
    - **Validates: Requirements 14.5, 14.2, 14.3**
    - File: `tests/unit/question-validation.test.ts` (P24), `tests/unit/word-cloud.test.ts` (P26)
  - [~] 16.3 Build word cloud presenter view
    - Add `WordCloudView` component to the presenter screen that subscribes to `word_cloud_updated` broadcast events and re-renders the word cloud with word sizes proportional to frequency
    - _Requirements: 14.2, 14.3_


- [ ] 17. Theming and branding
  - [~] 17.1 Implement theme data and API
    - Define at least 5 built-in colour themes (id, primaryColor, backgroundColor, fontFamily) in `lib/themes.ts`
    - Add `PATCH /api/v1/events/[eventId]` support for `theme_id` and `custom_theme` (primaryColor, backgroundColor, fontFamily from predefined list of ≥3 fonts)
    - _Requirements: 15.1, 15.2, 15.3, 15.6_
  - [~] 17.2 Build theme selector UI and logo upload
    - Add `ThemeSelector` (colour theme picker) and logo `ImageUploader` to `app/(dashboard)/events/[eventId]/edit/page.tsx`
    - Apply selected theme CSS variables to presenter screen, participant screen, and join page
    - _Requirements: 15.1–15.6_

- [ ] 18. Mobile-responsive design
  - [~] 18.1 Audit and fix participant screen responsiveness
    - Ensure `app/play/[sessionId]/page.tsx` and `app/join/` pages render without horizontal scroll, clipped content, or overlapping elements at 320 px–2560 px viewport widths
    - Verify answer option buttons meet 44×44 CSS px minimum touch target on ≤768 px viewports using Tailwind responsive utilities
    - _Requirements: 16.1, 16.2, 16.3_
  - [ ]* 18.2 Write Playwright E2E test for participant journey
    - Test full participant flow: join → lobby → answer question → see results → final leaderboard on mobile viewport (375×667)
    - File: `tests/e2e/participant-journey.test.ts`
    - _Requirements: 16.1, 16.2, 16.3_


- [ ] 19. Integration tests
  - [ ]* 19.1 Write integration test: participant join → answer → score persisted
    - Test full flow against a real Supabase test project: join session, submit answer, verify `participant_answers` row and `total_score` updated correctly
    - File: `tests/integration/session-flow.test.ts`
    - _Requirements: 5.1, 10.1–10.6_
  - [ ]* 19.2 Write integration test: session advance → Realtime broadcast received
    - Test that advancing session state triggers `session_state_changed` broadcast received by a subscribed client within 500 ms
    - File: `tests/integration/realtime.test.ts`
    - _Requirements: 7.1, 7.2_
  - [ ]* 19.3 Write integration test: session end → analytics snapshot generated
    - Test that ending a session triggers `generateAnalyticsSnapshots` and produces correct `analytics_snapshots` rows
    - File: `tests/integration/session-flow.test.ts`
    - _Requirements: 13.1_
  - [ ]* 19.4 Write integration test: RLS policies
    - Test that an admin cannot read or modify another admin's events, questions, or sessions
    - File: `tests/integration/rls.test.ts`
    - _Requirements: 2.1, 2.5_

- [~] 20. Checkpoint — ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.


- [ ] 21. Vercel deployment configuration
  - [~] 21.1 Configure Vercel deployment
    - Create `vercel.json` with environment variable references and any required rewrites
    - Add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` to Vercel project environment variables (document in README, do not commit values)
    - Configure `next.config.ts` with `images.remotePatterns` for Supabase Storage domains
    - _Requirements: all_
  - [~] 21.2 Set up pg_cron data retention job
    - Write and apply a Supabase migration that creates a `pg_cron` scheduled job to delete `analytics_snapshots`, `participant_answers`, and `session_participants` rows for sessions ended more than 90 days ago
    - _Requirements: 13.4_

- [~] 22. Final checkpoint — ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.


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
    {
      "id": 0,
      "tasks": ["2.1", "2.2", "2.3"]
    },
    {
      "id": 1,
      "tasks": ["3.1", "3.2", "3.3"]
    },
    {
      "id": 2,
      "tasks": ["4.1", "4.6"]
    },
    {
      "id": 3,
      "tasks": ["4.2", "4.3", "4.4", "4.5", "5.1", "5.3"]
    },
    {
      "id": 4,
      "tasks": ["5.2", "5.4", "5.5", "6.1"]
    },
    {
      "id": 5,
      "tasks": ["6.2", "6.3", "7.1"]
    },
    {
      "id": 6,
      "tasks": ["7.2", "7.3", "8.1"]
    },
    {
      "id": 7,
      "tasks": ["8.2", "8.3", "9.1"]
    },
    {
      "id": 8,
      "tasks": ["9.2", "9.3", "10.1"]
    },
    {
      "id": 9,
      "tasks": ["10.2", "12.1", "12.2"]
    },
    {
      "id": 10,
      "tasks": ["12.3", "12.4", "13.1", "13.2"]
    },
    {
      "id": 11,
      "tasks": ["14.1", "14.2", "15.1"]
    },
    {
      "id": 12,
      "tasks": ["14.3", "15.2", "15.3", "16.1"]
    },
    {
      "id": 13,
      "tasks": ["15.4", "16.2", "16.3", "17.1"]
    },
    {
      "id": 14,
      "tasks": ["17.2", "18.1"]
    },
    {
      "id": 15,
      "tasks": ["18.2", "19.1", "19.2", "19.3", "19.4"]
    },
    {
      "id": 16,
      "tasks": ["21.1", "21.2"]
    }
  ]
}
```

# Hoot 🦉

An open-source, real-time quiz and polling platform inspired by Kahoot and Mentimeter. Hosts create quiz decks, publish them with a shareable join code and QR code, then run live sessions where participants join on any device — no app install required.

---

## Features

- **Event authoring** — build quiz decks with single-select and multi-select multiple-choice questions
- **Publishing** — generate a 6-character join code and QR code; share a URL
- **Live sessions** — real-time sync via Supabase Realtime (Broadcast + Presence)
- **Speed-weighted scoring** — up to 1000 points per question, server-authoritative
- **Leaderboard** — live rankings after each question and a final podium with confetti
- **Analytics** — per-question response distribution, average response time, CSV export
- **Theming** — 5+ built-in colour themes, custom colours/fonts, logo upload
- **Mobile-first** — works on any browser, 320 px–2560 px viewports, 44 px touch targets

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router, RSC + CSR) |
| Language | TypeScript 5.x |
| Styling | Tailwind CSS 3.x + shadcn/ui |
| Database | Supabase (PostgreSQL + RLS) |
| Auth | Supabase Auth (JWT, httpOnly cookies) |
| Realtime | Supabase Realtime (Broadcast + Presence) |
| Storage | Supabase Storage (S3-compatible) |
| Testing | Vitest 2.x + fast-check + Playwright |
| Deployment | Vercel |

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm
- A [Supabase](https://supabase.com) project

### 1. Clone the repo

```bash
git clone https://github.com/PriteshKiri/hoot.git
cd hoot
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Copy the example and fill in your Supabase credentials:

```bash
cp .env.local.example .env.local
```

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

> The service role key is used server-side only (API routes) and is never exposed to the client.

### 4. Set up the database

Run the SQL migrations in your Supabase project. The schema creates the following tables with RLS enabled:

- `profiles` — admin accounts (linked to Supabase Auth)
- `events` — quiz decks
- `questions` — questions within an event
- `answer_options` — selectable choices per question
- `sessions` — live instances of an event
- `session_participants` — participants in a session
- `participant_answers` — submitted answers with scores
- `analytics_snapshots` — materialised per-question stats (written on session end)
- `join_code_history` — tracks previously used join codes

### 5. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Project Structure

```
hoot/
├── app/
│   ├── (auth)/          # Login, register, reset-password
│   ├── (dashboard)/     # Admin pages (events, questions, sessions)
│   ├── join/            # Participant join flow
│   ├── play/            # Participant quiz screen
│   └── api/v1/          # REST API routes
├── components/          # Shared React components
│   └── ui/              # shadcn/ui primitives
├── lib/
│   └── supabase/        # Browser, server, and middleware clients
└── tests/
    ├── unit/            # Vitest unit + property-based tests
    ├── integration/     # Vitest integration tests (real Supabase)
    └── e2e/             # Playwright end-to-end tests
```

---

## How It Works

### For hosts (admins)

1. Register and log in at `/login`
2. Create an event and add questions from the dashboard
3. Publish the event to generate a join code and QR code
4. Open the presenter screen and share the join code with participants
5. Start the session and advance through questions at your own pace
6. View analytics and export results as CSV after the session ends

### For participants

1. Go to `hoot.com/join` or scan the QR code
2. Enter the join code, pick a display name and emoji avatar
3. Wait in the lobby until the host starts
4. Answer questions on your device before the timer runs out
5. See your score and rank after each question

### Scoring

Points are awarded for correct answers based on speed:

```
score = max(1, floor(1000 × (remaining_time / time_limit)))
```

Scoring is calculated server-side to prevent manipulation. Multi-select questions require an exact match of all correct options for any points to be awarded.

---

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server on http://localhost:3000 |
| `npm run build` | Production build |
| `npm run lint` | Run ESLint |
| `npm test` | Run unit tests (single run) |
| `npm run test:watch` | Run unit tests in watch mode |
| `npm run test:coverage` | Run unit tests with coverage report |
| `npm run test:e2e` | Run Playwright E2E tests |

---

## Architecture Notes

- **No separate WebSocket server** — Supabase Realtime handles all bidirectional communication
- **Server-authoritative scoring** — answer submissions go through API routes; scores are never calculated client-side
- **Session state in PostgreSQL** — enables reconnection recovery; participants can rejoin within a 60-second window
- **Participants are unauthenticated** — they receive an opaque `participant_token` on join, stored in `sessionStorage`, used to authorise subsequent requests
- **QR codes generated client-side** — using the `qrcode` package; no external service needed
- **RLS on all tables** — admin data is protected by Supabase Row Level Security; participant mutations go through API routes using the service role key

---

## Contributing

Pull requests are welcome. For significant changes, open an issue first to discuss what you'd like to change.

1. Fork the repo
2. Create a feature branch (`git checkout -b feat/my-feature`)
3. Commit your changes
4. Push and open a pull request

Please make sure tests pass before submitting: `npm test && npm run test:e2e`.

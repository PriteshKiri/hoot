# Hoot 🦉

An open-source, self-hostable, real-time quiz and polling platform inspired by Kahoot and Mentimeter. Hosts create quiz decks, publish them with a shareable join code and QR code, then run live sessions where participants join on any device — no app install required.

Hoot is a standard Next.js app backed by Supabase, so you can run it entirely on your own infrastructure: a Node host (or container) for the web app and a Supabase instance (Supabase Cloud or self-hosted) for the database, auth, storage, and realtime.

---

## Demo

[![Watch the Hoot demo](https://img.youtube.com/vi/25xuEJ8hzqY/maxresdefault.jpg)](https://www.youtube.com/watch?v=25xuEJ8hzqY)

> ▶️ Click the thumbnail above to watch the demo on YouTube.

---

## Features

- **Event authoring** — build quiz decks with five question types: single-select, multi-select, open text, rating scale, and image choice
- **Publishing** — generate a 6-character join code and QR code; share a URL
- **Live sessions** — real-time sync via Supabase Realtime (Broadcast + Presence)
- **Speed-weighted scoring** — up to 1000 points per question, server-authoritative
- **Leaderboard** — live rankings after each question and a final podium with confetti
- **Analytics** — per-question response distribution, average response time, live word cloud for open-text, CSV export
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
| Deployment | Self-hosted (any Node 18+ host or container); Vercel also supported |

---

## Getting Started

### Prerequisites

- **Node.js 18+** and npm
- A **Supabase** instance. Either:
  - **Supabase Cloud** — create a free project at [supabase.com](https://supabase.com), or
  - **Self-hosted Supabase** — run it locally via the [Supabase CLI](https://supabase.com/docs/guides/cli) (requires Docker), or on your own server via the [self-hosting guide](https://supabase.com/docs/guides/self-hosting).

### 1. Clone the repo

```bash
git clone https://github.com/PriteshKiri/hoot.git
cd hoot
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up the Supabase database

Hoot ships a single bundled SQL script at [`supabase/setup.sql`](supabase/setup.sql) that creates the full schema, Row Level Security policies, storage buckets, and an optional data-retention job. Apply it using whichever path matches your setup.

**Option A — Hosted or self-hosted Supabase (SQL Editor):**

1. Open your Supabase project's **SQL Editor**.
2. Paste the contents of `supabase/setup.sql` and run it once on a fresh project.

**Option B — Local Supabase via the CLI (Docker required):**

```bash
npx supabase start          # boots Postgres, Auth, Storage, Realtime locally
npx supabase db push        # applies the migrations in supabase/migrations/
```

`supabase start` prints the local API URL and keys you'll use in the next step.

The setup creates these tables (all with RLS enabled):

- `profiles` — admin accounts (linked to Supabase Auth)
- `events` — quiz decks
- `questions` — questions within an event
- `answer_options` — selectable choices per question
- `sessions` — live instances of an event
- `session_participants` — participants in a session
- `participant_answers` — submitted answers with scores
- `analytics_snapshots` — materialised per-question stats (written on session end)
- `join_code_history` — tracks previously used join codes

It also provisions two storage buckets — `question-images` (private) and `event-logos` (public) — and an optional `pg_cron` job that purges session data older than 90 days. If your Postgres doesn't have `pg_cron`, skip the final block of the script.

> **Realtime:** Hoot relies on Supabase Realtime (Broadcast + Presence), which is enabled by default on Supabase Cloud and in the CLI/self-hosted stack. No extra configuration is required.

### 4. Configure environment variables

Copy the example and fill in the values for your Supabase instance:

```bash
cp .env.local.example .env.local
```

```env
# From Supabase: Project Settings → API (or the output of `npx supabase start`)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Public base URL participants will reach. Used to build join URLs and QR codes
# in server-rendered views. Defaults to http://localhost:3000 if unset.
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

> The **service role key** is used server-side only (API routes) and is never exposed to the client. Treat it like a password and never commit your real `.env.local`.

> Set **`NEXT_PUBLIC_APP_URL`** to the externally reachable URL of your deployment (e.g. `https://hoot.example.com`). Join links and QR codes generated server-side use this value, so participants can't connect if it points at the wrong host.

### 5. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Self-Hosting in Production

Hoot is a standard Next.js application, so any host that can run Node 18+ works (a VM, a container, a PaaS, etc.).

### 1. Build and start

```bash
npm install
npm run build
npm run start        # serves on port 3000 by default; override with PORT=8080
```

Run this behind a reverse proxy (nginx, Caddy, Traefik) that terminates TLS and forwards to the Node process. Make sure WebSocket connections are proxied through to Supabase — the browser talks to Supabase Realtime directly, so the only requirement is that clients can reach your Supabase URL.

### 2. Required production environment

Set the same variables as in step 4 above, but with production values:

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — your production Supabase project.
- `NEXT_PUBLIC_APP_URL` — your public HTTPS URL (e.g. `https://hoot.example.com`). **Note:** because this is a `NEXT_PUBLIC_` variable it is inlined at build time, so set it *before* running `npm run build`.

### 3. Configure Supabase Auth URLs

In your Supabase project (**Authentication → URL Configuration**), set the **Site URL** to your `NEXT_PUBLIC_APP_URL` and add it to the **Redirect URLs** allow-list so login, registration, and password-reset emails point at your domain.

### 4. Self-hosted Supabase on a custom domain

If you self-host Supabase on a domain other than `*.supabase.co`, update the image host allow-list in [`next.config.mjs`](next.config.mjs) so uploaded logos and question images render:

```js
images: {
  remotePatterns: [
    { protocol: "https", hostname: "supabase.example.com", pathname: "/storage/v1/object/**" },
  ],
}
```

### 5. (Optional) Run in Docker

There is no Dockerfile in the repo, but a minimal one is straightforward:

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_APP_URL
RUN npm run build
EXPOSE 3000
CMD ["npm", "run", "start"]
```

Pass the `NEXT_PUBLIC_*` values as build args (they're baked in at build time) and the `SUPABASE_SERVICE_ROLE_KEY` as a runtime secret.

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

1. Go to `<your-domain>/join` or scan the QR code shown on the presenter screen
2. Enter the join code, pick a display name and emoji avatar
3. Wait in the lobby until the host starts
4. Answer questions on your device before the timer runs out
5. See your score and rank after each question

### Scoring

Points are awarded for correct answers based on speed:

```
score = max(1, floor(1000 × (remaining_time / time_limit)))
```

Scoring is calculated server-side to prevent manipulation. Multi-select questions require an exact match of all correct options for any points to be awarded. Open-text and rating-scale questions are poll-style and award no points.

---

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server on http://localhost:3000 |
| `npm run build` | Production build |
| `npm run start` | Serve the production build (run after `npm run build`) |
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

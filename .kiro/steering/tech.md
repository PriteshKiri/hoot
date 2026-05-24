# Tech Stack

## Runtime & Framework

- **Language**: TypeScript 5.x
- **Runtime**: Node.js (via Vercel)
- **Framework**: Next.js 14 (App Router, RSC + CSR)
- **Package manager**: npm

## Frontend

- **Styling**: Tailwind CSS 3.x with `tailwindcss-animate`
- **Component library**: shadcn/ui (components.json configured, violet base colour)
- **Icons**: lucide-react
- **Drag-and-drop**: @dnd-kit/core
- **QR codes**: qrcode (client-side generation)
- **Confetti**: canvas-confetti
- **CSV parsing**: papaparse

## Backend / Database

- **Database**: Supabase (PostgreSQL + RLS)
- **Auth**: Supabase Auth (JWT, httpOnly cookies via @supabase/ssr)
- **Realtime**: Supabase Realtime (Broadcast + Presence)
- **Storage**: Supabase Storage (S3-compatible)
- **Client libraries**: @supabase/supabase-js, @supabase/ssr

## Testing

- **Unit / property tests**: Vitest 2.x + fast-check ^3.x + @testing-library/react
- **Coverage**: @vitest/coverage-v8
- **E2E tests**: Playwright 1.x

## Common Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Next.js dev server on http://localhost:3000 |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm test` | Run unit tests (Vitest, single run) |
| `npm run test:watch` | Run unit tests in watch mode |
| `npm run test:coverage` | Run unit tests with coverage report |
| `npm run test:e2e` | Run Playwright E2E tests |

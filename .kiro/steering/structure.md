# Project Structure

## Layout

```
hoot/
├── app/                        # Next.js App Router pages and API routes
│   ├── (auth)/                 # Auth pages (login, register, reset-password)
│   ├── (dashboard)/            # Protected admin pages
│   ├── join/                   # Participant join flow
│   ├── play/                   # Participant quiz screen
│   ├── api/v1/                 # API routes
│   ├── globals.css             # Tailwind base styles + CSS variables
│   ├── layout.tsx              # Root layout
│   └── page.tsx                # Landing page
├── components/                 # Shared React components
│   └── ui/                     # shadcn/ui primitives
├── lib/
│   ├── supabase/               # Supabase client helpers
│   │   ├── client.ts           # Browser client
│   │   ├── server.ts           # Server component client
│   │   └── middleware.ts       # Middleware client + auth guard
│   └── utils.ts                # cn() utility
├── tests/
│   ├── unit/                   # Vitest unit + property-based tests (*.test.ts)
│   ├── integration/            # Vitest integration tests (real Supabase)
│   ├── e2e/                    # Playwright E2E tests
│   └── setup.ts                # Vitest global setup (@testing-library/jest-dom)
├── .env.local                  # Local env vars (not committed)
├── components.json             # shadcn/ui config
├── next.config.mjs             # Next.js config
├── playwright.config.ts        # Playwright config
├── tailwind.config.ts          # Tailwind config
├── tsconfig.json               # TypeScript config
└── vitest.config.ts            # Vitest config
```

## Conventions

- Source files: `app/`, `components/`, `lib/`
- Tests: `tests/unit/**/*.test.ts` (unit), `tests/integration/**/*.test.ts`, `tests/e2e/**/*.test.ts`
- Path alias: `@/` maps to the project root
- Environment variables: `.env.local` (local), Vercel dashboard (production)
- API routes follow REST under `/api/v1/`
- Server Components (RSC) by default; add `"use client"` only where needed

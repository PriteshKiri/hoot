import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Code2,
  Github,
  Heart,
  Palette,
  PlayCircle,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Star,
  Timer,
  Trophy,
  Users,
  Zap,
} from "lucide-react"

const GITHUB_URL = "https://github.com/PriteshKiri/hoot"
const DEMO_VIDEO_ID = "25xuEJ8hzqY"
const DEMO_VIDEO_URL = `https://www.youtube.com/watch?v=${DEMO_VIDEO_ID}`

const FEATURES = [
  {
    icon: Zap,
    title: "Realtime, no lag",
    body:
      "Powered by Supabase Realtime. Every join, answer, and score syncs to every player instantly — no extra WebSocket server needed.",
    accent: "from-fuchsia-500/20 to-violet-500/10",
  },
  {
    icon: Sparkles,
    title: "Single & multi-select",
    body:
      "Build polished multiple-choice questions with up to four answer options, custom timers, and server-validated correct answers.",
    accent: "from-violet-500/20 to-indigo-500/10",
  },
  {
    icon: QrCode,
    title: "Join code + QR",
    body:
      "Publish an event and Hoot generates a 6-character join code and QR code. Players join in seconds — no app install, no signup.",
    accent: "from-indigo-500/20 to-sky-500/10",
  },
  {
    icon: Trophy,
    title: "Speed-weighted scoring",
    body:
      "Up to 1000 points per question, calculated server-side so it can’t be gamed. Live leaderboard after every question, podium with confetti at the end.",
    accent: "from-amber-500/20 to-rose-500/10",
  },
  {
    icon: RefreshCw,
    title: "Reconnect & resume",
    body:
      "Players can drop and rejoin a live session within seconds — Hoot keeps session state in Postgres so nobody gets left behind.",
    accent: "from-sky-500/20 to-teal-500/10",
  },
  {
    icon: BarChart3,
    title: "Analytics + CSV export",
    body:
      "Per-question response distribution, average response time, full participant breakdown. Export the whole session as CSV.",
    accent: "from-emerald-500/20 to-lime-500/10",
  },
  {
    icon: Palette,
    title: "Bring your own brand",
    body:
      "Five built-in themes plus custom colours, fonts, and logo upload. Make every event feel on-brand without touching CSS.",
    accent: "from-pink-500/20 to-rose-500/10",
  },
  {
    icon: Smartphone,
    title: "Mobile-first",
    body:
      "Designed for any browser from 320px phones to 4K projectors. Big touch targets, no fiddly menus, works offline-tolerant.",
    accent: "from-violet-500/20 to-purple-500/10",
  },
  {
    icon: ShieldCheck,
    title: "Secure by default",
    body:
      "Row-level security on every table, server-authoritative APIs, httpOnly cookies for auth. Your data — and your players’ — stays safe.",
    accent: "from-teal-500/20 to-cyan-500/10",
  },
]

const STEPS = [
  {
    n: "01",
    title: "Build your deck",
    body:
      "Create an event from your dashboard, add questions and answer options, pick a theme. Drag to reorder, duplicate, or preview.",
  },
  {
    n: "02",
    title: "Share the join code",
    body:
      "Hit publish. Hoot mints a 6-character join code and QR. Project it on screen — players hop on from any device in seconds.",
  },
  {
    n: "03",
    title: "Run the live show",
    body:
      "Advance through questions at your pace. Watch the leaderboard climb. End with a confetti podium and download your analytics.",
  },
]

const STACK = [
  "Next.js 14",
  "TypeScript",
  "Supabase",
  "PostgreSQL",
  "Tailwind",
  "shadcn/ui",
  "Vitest",
  "Playwright",
]

export default async function Home() {
  let isLoggedIn = false
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    isLoggedIn = !!user
  } catch {
    isLoggedIn = false
  }

  const primaryHref = isLoggedIn ? "/dashboard" : "/login"
  const primaryLabel = isLoggedIn ? "Go to dashboard" : "Sign in"

  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <BackgroundDecor />

      <SiteHeader isLoggedIn={isLoggedIn} />

      {/* ───────────────────────── HERO ───────────────────────── */}
      <section className="relative pt-20 pb-24 sm:pt-28 sm:pb-32">
        <div className="container mx-auto max-w-6xl px-6">
          <div className="flex flex-col items-center text-center">
            <Link
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-4 py-1.5 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur transition hover:border-primary/40 hover:text-foreground"
            >
              <Star className="h-3.5 w-3.5 text-amber-500" />
              100% open source — give us a star on GitHub
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>

            <h1 className="mt-6 max-w-4xl text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl md:text-7xl">
              Quizzes that actually{" "}
              <span className="bg-gradient-to-r from-fuchsia-500 via-violet-500 to-indigo-500 bg-clip-text text-transparent">
                feel alive.
              </span>
            </h1>

            <p className="mt-6 max-w-2xl text-base text-muted-foreground sm:text-lg">
              Hoot is an open-source, real-time quiz &amp; polling platform.
              Build interactive decks, share a join code, and run live sessions
              on any device — no installs, no friction.
            </p>

            <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:gap-4">
              <Link
                href={primaryHref}
                className="group inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-7 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 ring-1 ring-primary/30 transition hover:bg-primary/90 hover:shadow-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {primaryLabel}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/join"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-border bg-card/60 px-7 text-sm font-semibold text-foreground backdrop-blur transition hover:bg-card hover:border-primary/40"
              >
                Join a quiz
              </Link>
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                No app install
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                Self-hostable
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                Free forever
              </span>
            </div>

            <HeroMock />
          </div>
        </div>
      </section>

      {/* ───────────────────── DEMO ───────────────────── */}
      <section id="demo" className="relative py-24">
        <div className="container mx-auto max-w-5xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-primary">
              <PlayCircle className="h-4 w-4" />
              Demo
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
              See Hoot in action.
            </h2>
            <p className="mt-4 text-base text-muted-foreground">
              A quick walkthrough of building a deck, sharing the join code, and
              running a live session end to end.
            </p>
          </div>

          <div className="relative mt-12">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 -top-8 mx-auto h-40 max-w-3xl rounded-full bg-primary/20 blur-3xl"
            />
            <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
              <iframe
                className="absolute inset-0 h-full w-full"
                src={`https://www.youtube-nocookie.com/embed/${DEMO_VIDEO_ID}`}
                title="Hoot demo"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
            </div>
          </div>

          <div className="mt-6 text-center">
            <Link
              href={DEMO_VIDEO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition hover:text-foreground"
            >
              Watch on YouTube
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* ───────────────────── FEATURES ───────────────────── */}
      <section id="features" className="relative py-24">
        <div className="container mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">
              Features
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
              Everything you need to run a great quiz.
            </h2>
            <p className="mt-4 text-base text-muted-foreground">
              From classroom warm-ups to all-hands trivia nights — Hoot ships
              the features you’d expect from a polished product, with the
              transparency of an open codebase.
            </p>
          </div>

          <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, body, accent }) => (
              <div
                key={title}
                className="group relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md hover:border-primary/30"
              >
                <div
                  aria-hidden="true"
                  className={`pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-gradient-to-br ${accent} opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100`}
                />
                <div className="relative">
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-background text-primary shadow-sm">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-5 text-lg font-semibold tracking-tight">
                    {title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────────────── HOW IT WORKS ───────────────────── */}
      <section id="how" className="relative py-24">
        <div className="container mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">
              How it works
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
              From idea to live game in three steps.
            </h2>
          </div>

          <div className="mt-16 grid gap-6 md:grid-cols-3">
            {STEPS.map((step, i) => (
              <div
                key={step.n}
                className="relative rounded-2xl border border-border bg-card p-7 shadow-sm"
              >
                <div className="flex items-baseline justify-between">
                  <span className="text-5xl font-bold tracking-tight text-primary/15">
                    {step.n}
                  </span>
                  {i < STEPS.length - 1 && (
                    <ArrowRight
                      aria-hidden="true"
                      className="hidden h-5 w-5 text-muted-foreground/40 md:block"
                    />
                  )}
                </div>
                <h3 className="mt-4 text-lg font-semibold tracking-tight">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {step.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────────────── OPEN SOURCE ───────────────────── */}
      <section id="open-source" className="relative py-24">
        <div className="container mx-auto max-w-6xl px-6">
          <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-card via-card to-card p-8 shadow-sm sm:p-12">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-fuchsia-500/10 blur-3xl"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-24 -bottom-24 h-72 w-72 rounded-full bg-indigo-500/10 blur-3xl"
            />

            <div className="relative grid gap-10 md:grid-cols-2 md:items-center">
              <div>
                <p className="inline-flex items-center gap-2 rounded-full border border-border bg-background/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
                  <Code2 className="h-3.5 w-3.5 text-primary" />
                  Open source
                </p>
                <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
                  Built in the open. Better with you.
                </h2>
                <p className="mt-4 text-base text-muted-foreground">
                  Hoot is open source and lives on GitHub. Fork it, self-host
                  it, theme it, embed it in your product — whatever you need.
                  Issues, PRs, and ideas are genuinely welcome.
                </p>

                <div className="mt-7 flex flex-wrap gap-3">
                  <Link
                    href={GITHUB_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-foreground px-6 text-sm font-semibold text-background transition hover:opacity-90"
                  >
                    <Github className="h-4 w-4" />
                    View on GitHub
                  </Link>
                  <Link
                    href={`${GITHUB_URL}/issues`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-border bg-background/60 px-6 text-sm font-semibold text-foreground backdrop-blur transition hover:border-primary/40"
                  >
                    <Heart className="h-4 w-4 text-rose-500" />
                    Contribute
                  </Link>
                </div>

                <div className="mt-8 grid grid-cols-3 gap-4 text-center sm:max-w-md">
                  <Stat label="Source" value="Open" />
                  <Stat label="Stack" value="OSS" />
                  <Stat label="Hosting" value="Yours" />
                </div>
              </div>

              <div className="relative">
                <div className="rounded-2xl border border-border bg-background/70 p-6 shadow-sm backdrop-blur">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Tech stack
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {STACK.map((s) => (
                      <span
                        key={s}
                        className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-foreground"
                      >
                        {s}
                      </span>
                    ))}
                  </div>

                  <div className="mt-6 rounded-xl bg-zinc-950 p-4 font-mono text-xs leading-relaxed text-zinc-200 shadow-inner">
                    <div className="flex items-center gap-1.5 pb-3">
                      <span className="h-2.5 w-2.5 rounded-full bg-rose-400/80" />
                      <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
                    </div>
                    <div>
                      <span className="text-zinc-500">$</span>{" "}
                      <span className="text-zinc-200">git clone</span>{" "}
                      <span className="text-violet-300">hoot</span>
                    </div>
                    <div>
                      <span className="text-zinc-500">$</span>{" "}
                      <span className="text-zinc-200">npm install</span>
                    </div>
                    <div>
                      <span className="text-zinc-500">$</span>{" "}
                      <span className="text-zinc-200">npm run dev</span>
                    </div>
                    <div className="pt-2 text-emerald-300">
                      ▲ Ready on http://localhost:3000
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ───────────────────── FINAL CTA ───────────────────── */}
      <section className="relative py-24">
        <div className="container mx-auto max-w-4xl px-6">
          <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary/10 via-fuchsia-500/5 to-indigo-500/10 px-6 py-14 text-center sm:px-12 sm:py-16">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_60%_at_50%_0%,hsl(var(--primary)/0.18),transparent_70%)]"
            />
            <div className="relative">
              <div className="mx-auto mb-4 text-5xl" aria-hidden="true">
                🦉
              </div>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Ready to make some noise?
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-base text-muted-foreground">
                Spin up your first quiz in under a minute. It’s free, it’s
                open, and your players will love it.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link
                  href={primaryHref}
                  className="group inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-7 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 ring-1 ring-primary/30 transition hover:bg-primary/90"
                >
                  {primaryLabel}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
                <Link
                  href={GITHUB_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-border bg-card/60 px-7 text-sm font-semibold text-foreground backdrop-blur transition hover:bg-card hover:border-primary/40"
                >
                  <Github className="h-4 w-4" />
                  Star on GitHub
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  )
}

/* ─────────────────────────────────────────────
 * Sub-components
 * ───────────────────────────────────────────── */

function SiteHeader({ isLoggedIn }: { isLoggedIn: boolean }) {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span aria-hidden="true" className="text-2xl">
            🦉
          </span>
          <span className="text-lg">Hoot</span>
        </Link>

        <nav
          aria-label="Primary"
          className="hidden items-center gap-7 text-sm text-muted-foreground md:flex"
        >
          <a href="#demo" className="transition hover:text-foreground">
            Demo
          </a>
          <a href="#features" className="transition hover:text-foreground">
            Features
          </a>
          <a href="#how" className="transition hover:text-foreground">
            How it works
          </a>
          <a href="#open-source" className="transition hover:text-foreground">
            Open Source
          </a>
          <Link href="/join" className="transition hover:text-foreground">
            Join
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          {isLoggedIn ? (
            <Link
              href="/dashboard"
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full bg-primary px-4 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90"
            >
              Dashboard
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          ) : (
            <Link
              href="/login"
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full bg-primary px-4 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90"
            >
              Sign in
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}

function HeroMock() {
  return (
    <div className="relative mt-20 w-full">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 -top-10 mx-auto h-48 max-w-3xl rounded-full bg-primary/20 blur-3xl"
      />
      <div className="relative mx-auto grid w-full max-w-4xl gap-4 sm:grid-cols-5">
        {/* Presenter mock */}
        <div className="relative col-span-5 overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-xl sm:col-span-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
              Live — Question 3 of 8
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Timer className="h-3.5 w-3.5" />
              00:14
            </div>
          </div>
          <h3 className="mt-5 text-left text-xl font-semibold leading-tight sm:text-2xl">
            Which planet has the most moons?
          </h3>
          <div className="mt-5 grid grid-cols-2 gap-3 text-left">
            <MockOption letter="A" label="Jupiter" color="bg-rose-500/15 border-rose-500/40 text-rose-700 dark:text-rose-300" />
            <MockOption letter="B" label="Saturn" color="bg-sky-500/15 border-sky-500/40 text-sky-700 dark:text-sky-300" highlight />
            <MockOption letter="C" label="Neptune" color="bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-300" />
            <MockOption letter="D" label="Uranus" color="bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300" />
          </div>
          <div className="mt-5 flex items-center justify-between text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" />
              42 players answering
            </span>
            <span>Avg. response: 4.2s</span>
          </div>
        </div>

        {/* Side: join code + leaderboard */}
        <div className="col-span-5 grid gap-4 sm:col-span-2">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-xl">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Join code
            </p>
            <div className="mt-3 rounded-xl border border-dashed border-primary/40 bg-primary/5 px-4 py-3 text-center font-mono text-3xl font-bold tracking-[0.3em] text-primary">
              H07TLY
            </div>
            <p className="mt-3 text-center text-[11px] text-muted-foreground">
              hoot.app/join
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5 shadow-xl">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Leaderboard
            </p>
            <ul className="mt-3 space-y-2 text-left text-sm">
              <LeaderRow rank={1} emoji="🦊" name="foxtrot" score={2840} top />
              <LeaderRow rank={2} emoji="🦉" name="night_owl" score={2710} />
              <LeaderRow rank={3} emoji="🐙" name="kraken" score={2455} />
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

function MockOption({
  letter,
  label,
  color,
  highlight,
}: {
  letter: string
  label: string
  color: string
  highlight?: boolean
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm font-medium ${color} ${
        highlight ? "ring-2 ring-offset-2 ring-offset-card ring-primary/40" : ""
      }`}
    >
      <span className="flex h-6 w-6 items-center justify-center rounded-md bg-background/60 text-xs font-bold">
        {letter}
      </span>
      <span>{label}</span>
    </div>
  )
}

function LeaderRow({
  rank,
  emoji,
  name,
  score,
  top,
}: {
  rank: number
  emoji: string
  name: string
  score: number
  top?: boolean
}) {
  return (
    <li className="flex items-center gap-3">
      <span
        className={`flex h-6 w-6 items-center justify-center rounded-md text-xs font-bold ${
          top
            ? "bg-amber-500/20 text-amber-700 dark:text-amber-300"
            : "bg-muted text-muted-foreground"
        }`}
      >
        {rank}
      </span>
      <span aria-hidden="true" className="text-lg">
        {emoji}
      </span>
      <span className="flex-1 truncate font-medium">{name}</span>
      <span className="font-mono text-xs text-muted-foreground">{score}</span>
    </li>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background/60 px-3 py-3 backdrop-blur">
      <p className="text-xs uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-lg font-bold tracking-tight">{value}</p>
    </div>
  )
}

function BackgroundDecor() {
  return (
    <>
      {/* Soft top gradient wash */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[700px] bg-[radial-gradient(60%_50%_at_50%_0%,hsl(var(--primary)/0.16),transparent_70%)]"
      />
      {/* Dot grid */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[900px] opacity-[0.35] [background-image:radial-gradient(hsl(var(--foreground)/0.12)_1px,transparent_1px)] [background-size:22px_22px] [mask-image:linear-gradient(to_bottom,black,transparent_80%)]"
      />
      {/* Floating blobs */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-32 top-40 -z-10 h-72 w-72 rounded-full bg-fuchsia-500/10 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-32 top-72 -z-10 h-72 w-72 rounded-full bg-indigo-500/10 blur-3xl"
      />
    </>
  )
}

function SiteFooter() {
  return (
    <footer className="relative border-t border-border/60 bg-background">
      <div className="container mx-auto max-w-6xl px-6 py-12">
        <div className="flex flex-col items-start justify-between gap-8 md:flex-row md:items-center">
          <div className="flex items-center gap-3">
            <span aria-hidden="true" className="text-2xl">
              🦉
            </span>
            <div>
              <p className="font-semibold tracking-tight">Hoot</p>
              <p className="text-xs text-muted-foreground">
                Open-source real-time quizzes. Made with{" "}
                <Heart className="inline h-3 w-3 -translate-y-0.5 text-rose-500" />{" "}
                by the community.
              </p>
            </div>
          </div>

          <nav
            aria-label="Footer"
            className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground"
          >
            <a href="#demo" className="hover:text-foreground">
              Demo
            </a>
            <a href="#features" className="hover:text-foreground">
              Features
            </a>
            <a href="#how" className="hover:text-foreground">
              How it works
            </a>
            <a href="#open-source" className="hover:text-foreground">
              Open Source
            </a>
            <Link href="/join" className="hover:text-foreground">
              Join a quiz
            </Link>
            <Link href="/login" className="hover:text-foreground">
              Sign in
            </Link>
            <Link
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 hover:text-foreground"
            >
              <Github className="h-3.5 w-3.5" />
              GitHub
            </Link>
          </nav>
        </div>

        <div className="mt-8 flex flex-col items-start justify-between gap-2 border-t border-border/60 pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center">
          <p>© {new Date().getFullYear()} Hoot.</p>
        </div>
      </div>
    </footer>
  )
}

# Design Document: Hoot Quiz Platform

## Overview

Hoot is a real-time, browser-based quiz and polling platform. Admins create and manage Events (quiz decks), publish them with a shareable Join Code and QR Code, then run live Sessions where Participants join on their own devices, answer questions in sync, and compete on a live leaderboard.

The system is built entirely on Next.js 14 (App Router, TypeScript) with Supabase providing the database (PostgreSQL), authentication, real-time messaging (Broadcast + Presence), and file storage. There is no separate backend service — all server-side logic runs in Next.js API routes. Deployment targets Vercel.

### Key Design Decisions

- **No separate WebSocket server.** Supabase Realtime handles all bidirectional communication via Broadcast (state events) and Presence (participant tracking).
- **Participants connect to Realtime only during active quiz phases** (lobby through ended) to stay within the Supabase free-tier connection limit of 150 concurrent connections per channel.
- **Scoring is server-authoritative.** Answer submissions go through a Next.js API route that calculates scores, preventing client-side manipulation.
- **Session state is stored in PostgreSQL**, not only in memory, enabling reconnection recovery.
- **QR codes are generated client-side** using the `qrcode` npm package — no external service needed.


---

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                        Vercel (Edge/Node)                        │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                  Next.js 14 App Router                    │   │
│  │                                                            │   │
│  │  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐  │   │
│  │  │  App Pages  │  │  API Routes  │  │  Server Actions│  │   │
│  │  │  (RSC/CSR)  │  │  /api/v1/*   │  │  (mutations)   │  │   │
│  │  └─────────────┘  └──────────────┘  └────────────────┘  │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
   │  Supabase    │  │  Supabase    │  │  Supabase    │
   │  PostgreSQL  │  │  Realtime    │  │  Storage     │
   │  + RLS       │  │  (WS)        │  │  (S3-compat) │
   └──────────────┘  └──────────────┘  └──────────────┘
              │               │
   ┌──────────────┐  ┌──────────────┐
   │  Supabase    │  │  Supabase    │
   │  Auth        │  │  Edge Funcs  │
   │  (JWT)       │  │  (optional)  │
   └──────────────┘  └──────────────┘
```


### Data Flow — Session Lifecycle

```
Admin Browser                  Next.js API              Supabase
─────────────                  ───────────              ────────
POST /api/sessions/start  ──►  validate + insert  ──►  sessions row (status=lobby)
                               broadcast event    ──►  Realtime channel
                                                        │
Participant Browsers ◄─────────────────────────────────┘
  (Presence join)
  (Broadcast: lobby_update)

Admin: POST /api/sessions/advance ──► update sessions row ──► Realtime broadcast
Participants: receive question_start event, render question

Participant: POST /api/answers ──► score calculation ──► insert participant_answers
                                ──► update session_participants.total_score
                                ──► Realtime broadcast answer_count update

Admin: POST /api/sessions/advance (to results) ──► Realtime broadcast results_reveal
Participants: receive results, see correct answers + leaderboard
```


### Session State Machine

```
                    ┌─────────┐
                    │  lobby  │◄── participants join via Presence
                    └────┬────┘
                         │ Admin clicks Start
                    ┌────▼────────┐
                    │  countdown  │  3-2-1 animation (3 seconds)
                    └────┬────────┘
                         │ countdown complete
                    ┌────▼────────┐
                    │  question   │◄── timer running, answers accepted
                    └────┬────────┘
                         │ timer expires OR all answered
                    ┌────▼────────┐
                    │   results   │  correct answers + response distribution
                    └────┬────────┘
                         │ Admin advances
                    ┌────▼────────┐
                    │ leaderboard │  top 10 ranked participants
                    └────┬────────┘
                         │ Admin advances
                         ├── more questions? ──► back to countdown
                         │
                    ┌────▼──────────────┐
                    │ final_leaderboard │  top 3 + confetti
                    └────┬──────────────┘
                         │ Admin ends session
                    ┌────▼────────┐
                    │    ended    │  participants disconnected
                    └─────────────┘
```

States stored in `sessions.status` column: `lobby | countdown | question | results | leaderboard | final_leaderboard | ended`


---

## Components and Interfaces

### Next.js Route Structure

```
app/
├── (auth)/
│   ├── login/
│   │   └── page.tsx                  # Admin login form
│   ├── register/
│   │   └── page.tsx                  # Admin registration form
│   └── reset-password/
│       └── page.tsx                  # Password reset form
│
├── (dashboard)/
│   ├── layout.tsx                    # Auth guard + nav shell
│   ├── dashboard/
│   │   └── page.tsx                  # Event list (RSC)
│   ├── events/
│   │   ├── new/
│   │   │   └── page.tsx              # Create event form
│   │   └── [eventId]/
│   │       ├── page.tsx              # Event editor (questions list)
│   │       ├── edit/
│   │       │   └── page.tsx          # Event settings (title, theme)
│   │       ├── questions/
│   │       │   ├── new/
│   │       │   │   └── page.tsx      # Add question
│   │       │   └── [questionId]/
│   │       │       └── page.tsx      # Edit question
│   │       └── analytics/
│   │           └── [sessionId]/
│   │               └── page.tsx      # Session analytics view
│   └── sessions/
│       └── [sessionId]/
│           └── present/
│               └── page.tsx          # Presenter screen (CSR)
│
├── join/
│   ├── page.tsx                      # Join code entry
│   └── [joinCode]/
│       └── page.tsx                  # Name + avatar selection
│
├── play/
│   └── [sessionId]/
│       └── page.tsx                  # Participant screen (CSR)
│
└── api/
    └── v1/
        ├── events/
        │   ├── route.ts              # GET (list), POST (create)
        │   └── [eventId]/
        │       ├── route.ts          # GET, PATCH, DELETE
        │       ├── publish/
        │       │   └── route.ts      # POST (publish/unpublish)
        │       └── questions/
        │           ├── route.ts      # GET (list), POST (create)
        │           └── [questionId]/
        │               └── route.ts  # GET, PATCH, DELETE, PATCH (reorder)
        ├── sessions/
        │   ├── route.ts              # POST (create/start session)
        │   └── [sessionId]/
        │       ├── route.ts          # GET (state), DELETE (end)
        │       ├── advance/
        │       │   └── route.ts      # POST (advance state)
        │       ├── join/
        │       │   └── route.ts      # POST (participant join)
        │       └── answers/
        │           └── route.ts      # POST (submit answer)
        ├── analytics/
        │   └── [sessionId]/
        │       ├── route.ts          # GET (summary)
        │       └── export/
        │           └── route.ts      # GET (CSV download)
        └── uploads/
            └── route.ts              # POST (presigned URL for Storage)
```


### Key UI Components

#### Admin Dashboard (`/dashboard`)
- `EventCard` — title, status badge (Draft/Published), question count, created date, action menu (edit, delete, present)
- `CreateEventButton` — opens inline form or navigates to `/events/new`
- `DashboardShell` — sidebar nav, user menu, logout

#### Event Editor (`/events/[eventId]`)
- `QuestionList` — drag-and-drop reorderable list using `@dnd-kit/core`
- `QuestionCard` — question text preview, type badge, time limit, edit/delete actions
- `PublishPanel` — publish/unpublish toggle, displays Join Code + QR Code + shareable URL
- `ThemeSelector` — colour theme picker + logo upload

#### Question Editor (`/events/[eventId]/questions/[questionId]`)
- `QuestionTypeSelector` — radio group for question type
- `AnswerOptionEditor` — add/remove options, mark correct, image upload per option (image-based type)
- `TimeLimitSlider` — 5–120 seconds
- `ImageUploader` — drag-and-drop with format/size validation
- `RatingScaleConfig` — min/max inputs (1–10)

#### Presenter Screen (`/sessions/[sessionId]/present`)
- `LobbyView` — QR code, join code, live participant grid (name + avatar chips)
- `CountdownView` — animated 3-2-1 overlay
- `QuestionView` — question text, image (if any), answer options (display only), progress bar timer, live answer count
- `ResultsView` — correct answer highlight, bar chart of response distribution (count + %)
- `LeaderboardView` — animated ranked list, top 10 with score deltas
- `FinalLeaderboardView` — podium for top 3, full ranked list, confetti overlay
- `SessionControls` — "Next" / "End Session" buttons, always visible

#### Participant Screen (`/play/[sessionId]`)
- `WaitingView` — session title, avatar display, "Waiting for host…" message
- `CountdownView` — 3-2-1 animation (shared component)
- `QuestionView` — question text, image, answer buttons (tappable, 44px min), countdown ring
- `AnswerSubmittedView` — locked state showing selected answer, waiting indicator
- `ResultFeedbackView` — correct/incorrect indicator, points earned this round, running total
- `LeaderboardView` — participant's own rank highlighted
- `EndView` — thank-you message, final rank and score


---

## Data Models

### Database Schema (PostgreSQL via Supabase)

#### `profiles`
Extends Supabase Auth `auth.users`. Created automatically via trigger on user signup.

```sql
CREATE TABLE profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
```

#### `events`

```sql
CREATE TABLE events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title        text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 100),
  description  text CHECK (char_length(description) <= 500),
  status       text NOT NULL DEFAULT 'draft'
                 CHECK (status IN ('draft', 'published')),
  join_code    text UNIQUE CHECK (join_code ~ '^[A-Z0-9]{6}$'),
  logo_url     text,
  theme_id     text NOT NULL DEFAULT 'default',
  custom_theme jsonb,
  -- custom_theme shape: { primaryColor, backgroundColor, fontFamily }
  anonymous_mode boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX events_admin_title_unique
  ON events (admin_id, lower(title));
```

#### `questions`

```sql
CREATE TABLE questions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  position      integer NOT NULL,
  question_type text NOT NULL
                  CHECK (question_type IN (
                    'single_select', 'multi_select',
                    'open_text', 'rating_scale', 'image_choice'
                  )),
  text          text NOT NULL CHECK (char_length(text) BETWEEN 1 AND 255),
  image_url     text,
  time_limit    integer NOT NULL DEFAULT 20
                  CHECK (time_limit BETWEEN 5 AND 120),
  -- rating_scale config
  rating_min    integer CHECK (rating_min BETWEEN 1 AND 10),
  rating_max    integer CHECK (rating_max BETWEEN 1 AND 10),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rating_scale_valid
    CHECK (question_type != 'rating_scale' OR (
      rating_min IS NOT NULL AND rating_max IS NOT NULL
      AND rating_min < rating_max
    ))
);

CREATE UNIQUE INDEX questions_event_position
  ON questions (event_id, position);
```


#### `answer_options`

```sql
CREATE TABLE answer_options (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  position    integer NOT NULL,
  text        text,           -- null for image_choice options
  image_url   text,           -- null for non-image options
  is_correct  boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);
```

#### `sessions`

```sql
CREATE TABLE sessions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id              uuid NOT NULL REFERENCES events(id) ON DELETE RESTRICT,
  admin_id              uuid NOT NULL REFERENCES profiles(id),
  status                text NOT NULL DEFAULT 'lobby'
                          CHECK (status IN (
                            'lobby', 'countdown', 'question',
                            'results', 'leaderboard',
                            'final_leaderboard', 'ended'
                          )),
  current_question_id   uuid REFERENCES questions(id),
  current_question_index integer,
  question_started_at   timestamptz,  -- server timestamp when question began
  participant_count     integer NOT NULL DEFAULT 0,
  started_at            timestamptz,
  ended_at              timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now()
);
```

#### `session_participants`

```sql
CREATE TABLE session_participants (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  display_name    text NOT NULL CHECK (
                    char_length(display_name) BETWEEN 1 AND 30
                    AND display_name ~ '^[\p{L}\p{N} \-_]+$'
                  ),
  avatar          text NOT NULL,   -- emoji character
  total_score     integer NOT NULL DEFAULT 0,
  rank            integer,         -- updated after each question
  is_connected    boolean NOT NULL DEFAULT true,
  disconnected_at timestamptz,     -- set on disconnect, cleared on reconnect
  participant_token text UNIQUE NOT NULL,
  -- opaque token stored in participant's localStorage for reconnection
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, display_name)
);
```


#### `participant_answers`

```sql
CREATE TABLE participant_answers (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id          uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  participant_id      uuid NOT NULL REFERENCES session_participants(id) ON DELETE CASCADE,
  question_id         uuid NOT NULL REFERENCES questions(id),
  selected_option_ids uuid[],      -- null for open_text / rating_scale / no answer
  open_text_response  text CHECK (char_length(open_text_response) <= 200),
  rating_value        integer,
  is_correct          boolean,     -- null for open_text / rating_scale
  score_awarded       integer NOT NULL DEFAULT 0,
  response_time_ms    integer,     -- ms from question_started_at to submission
  submitted_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (participant_id, question_id)  -- enforces first-submission-wins
);
```

#### `analytics_snapshots`

Materialised summary written when a session ends, for fast analytics reads.

```sql
CREATE TABLE analytics_snapshots (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id        uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  question_id       uuid NOT NULL REFERENCES questions(id),
  total_responses   integer NOT NULL DEFAULT 0,
  option_counts     jsonb NOT NULL DEFAULT '{}',
  -- shape: { "<option_id>": { count: N, percentage: N } }
  avg_response_time_ms integer,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, question_id)
);
```

#### `join_code_history`

Tracks previously used join codes to prevent reuse on re-publish.

```sql
CREATE TABLE join_code_history (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  join_code  text NOT NULL,
  issued_at  timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);
```


### Row-Level Security (RLS) Policies

All tables have RLS enabled. Key policies:

```sql
-- events: admins own their events
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_select_own_events" ON events
  FOR SELECT USING (admin_id = auth.uid());

CREATE POLICY "admin_insert_own_events" ON events
  FOR INSERT WITH CHECK (admin_id = auth.uid());

CREATE POLICY "admin_update_own_events" ON events
  FOR UPDATE USING (admin_id = auth.uid());

CREATE POLICY "admin_delete_own_events" ON events
  FOR DELETE USING (admin_id = auth.uid());

-- questions: accessible by event owner
CREATE POLICY "admin_manage_questions" ON questions
  FOR ALL USING (
    event_id IN (SELECT id FROM events WHERE admin_id = auth.uid())
  );

-- sessions: admin can read/write their own sessions
CREATE POLICY "admin_manage_sessions" ON sessions
  FOR ALL USING (admin_id = auth.uid());

-- session_participants: service role only (participants are unauthenticated)
-- Participant reads/writes go through API routes using the service role key.
-- No direct client access to session_participants.

-- participant_answers: service role only
-- Same pattern — all participant writes go through authenticated API routes.

-- analytics_snapshots: admin can read snapshots for their sessions
CREATE POLICY "admin_read_analytics" ON analytics_snapshots
  FOR SELECT USING (
    session_id IN (SELECT id FROM sessions WHERE admin_id = auth.uid())
  );
```

Participants are unauthenticated. All participant-facing mutations (join, submit answer) go through Next.js API routes that use the Supabase **service role key** server-side, bypassing RLS. The API routes enforce their own authorization using the `participant_token` stored in the participant's `localStorage`.


### Supabase Storage Buckets

| Bucket | Access | Max size | Allowed types |
|--------|--------|----------|---------------|
| `question-images` | Private (signed URLs) | 5 MB | image/jpeg, image/png, image/gif, image/webp |
| `event-logos` | Public | 2 MB | image/jpeg, image/png, image/svg+xml |

Upload flow: client calls `POST /api/v1/uploads` → API route validates file type/size → returns a Supabase Storage signed upload URL → client uploads directly to Storage → client saves the resulting public/signed URL to the question or event record.

---

## Supabase Realtime Channel Design

### Channel Naming Convention

```
session:{sessionId}
```

One channel per active session. Both the admin (presenter) and all participants subscribe to the same channel. The admin additionally has write access to broadcast state-change events.

### Presence (Participant Tracking)

Used exclusively in the `lobby` state to track connected participants in real time.

**Presence key:** `participant:{participantId}`

**Presence payload:**
```typescript
type PresencePayload = {
  participantId: string;
  displayName: string;
  avatar: string;       // emoji
  joinedAt: string;     // ISO timestamp
};
```

Presence `sync`, `join`, and `leave` events drive the live participant grid on the Presenter Screen and the participant count.


### Broadcast Events

All broadcast events are sent by the server (via API routes using the service role) to avoid trusting client-originated state changes.

#### `session_state_changed`
Sent on every state transition. All clients re-render based on this.

```typescript
type SessionStateChangedEvent = {
  event: 'session_state_changed';
  payload: {
    status: SessionStatus;
    currentQuestionIndex: number | null;
    currentQuestion: {
      id: string;
      text: string;
      questionType: QuestionType;
      imageUrl: string | null;
      timeLimitSeconds: number;
      options: Array<{
        id: string;
        text: string | null;
        imageUrl: string | null;
        position: number;
      }>;
      // NOTE: is_correct is NOT included — revealed only in results_revealed event
    } | null;
    questionStartedAt: string | null;  // ISO timestamp for client-side timer sync
  };
};
```

#### `results_revealed`
Sent when transitioning to `results` state. Includes correct answers and response distribution.

```typescript
type ResultsRevealedEvent = {
  event: 'results_revealed';
  payload: {
    questionId: string;
    correctOptionIds: string[];
    distribution: Array<{
      optionId: string;
      count: number;
      percentage: number;
    }>;
    totalResponses: number;
  };
};
```

#### `leaderboard_updated`
Sent when transitioning to `leaderboard` or `final_leaderboard` state.

```typescript
type LeaderboardUpdatedEvent = {
  event: 'leaderboard_updated';
  payload: {
    isFinal: boolean;
    entries: Array<{
      rank: number;
      participantId: string;
      displayName: string;
      avatar: string;
      totalScore: number;
      scoreDelta: number;   // points earned in last question
    }>;
  };
};
```

#### `answer_count_updated`
Sent after each answer submission so the presenter can see live answer progress.

```typescript
type AnswerCountUpdatedEvent = {
  event: 'answer_count_updated';
  payload: {
    questionId: string;
    answeredCount: number;
    totalParticipants: number;
  };
};
```

#### `word_cloud_updated`
Sent after each open-text submission during an open_text question.

```typescript
type WordCloudUpdatedEvent = {
  event: 'word_cloud_updated';
  payload: {
    questionId: string;
    words: Array<{ word: string; count: number }>;
  };
};
```


### Connection Lifecycle

```
Participant joins lobby
  → subscribe to channel session:{sessionId}
  → track presence

Session starts (countdown)
  → presence tracking stops (reduce connection overhead)
  → broadcast subscription remains active

Question active
  → participant submits answer via POST /api/v1/sessions/{id}/answers
  → server broadcasts answer_count_updated

Session ends
  → server broadcasts session_state_changed { status: 'ended' }
  → all clients unsubscribe and remove channel
```

Participants connect to Realtime only for the duration of the session (lobby → ended). They do not maintain a Realtime connection outside of an active session, keeping peak concurrent connections within the 150-connection limit.

---

## Scoring Algorithm

The scoring engine runs server-side in `POST /api/v1/sessions/[sessionId]/answers`.

```typescript
function calculateScore(
  isCorrect: boolean,
  remainingTimeMs: number,
  timeLimitMs: number
): number {
  if (!isCorrect) return 0;
  // Requirement 10.2: max(1, floor(1000 × (remaining_time / time_limit)))
  const ratio = remainingTimeMs / timeLimitMs;
  return Math.max(1, Math.floor(1000 * ratio));
}
```

**`remaining_time` calculation:**

```typescript
const questionStartedAt = new Date(session.question_started_at).getTime();
const submittedAt = Date.now();  // server time
const elapsedMs = submittedAt - questionStartedAt;
const timeLimitMs = question.time_limit * 1000;
const remainingTimeMs = Math.max(0, timeLimitMs - elapsedMs);
```

Using server timestamps for both `question_started_at` and answer receipt prevents client-side clock manipulation.

**Multi-select scoring:** A multi-select answer is correct only if the set of selected option IDs exactly matches the set of correct option IDs. Partial credit is not awarded.

**First-submission-wins:** The `UNIQUE (participant_id, question_id)` constraint on `participant_answers` enforces this at the database level. The API route also checks for an existing answer before inserting and returns a 409 if one exists.

**Score accumulation:**

```sql
UPDATE session_participants
SET total_score = total_score + :score_awarded
WHERE id = :participant_id;
```

Run within the same transaction as the `participant_answers` insert to maintain the invariant in Requirement 10.6.


---

## Authentication Flow

Supabase Auth handles all admin authentication. Participants are unauthenticated.

### Admin Registration / Login

```
1. Admin submits email + password to POST /api/v1/auth/register
   (or directly via Supabase Auth client SDK)
2. Supabase Auth creates user in auth.users
3. Database trigger creates matching profiles row
4. Supabase issues JWT (access token + refresh token)
5. Tokens stored in httpOnly cookies via @supabase/ssr
6. Next.js middleware reads cookie on every request to validate session
7. On expiry: refresh token used to issue new access token silently
8. On logout: POST /api/v1/auth/logout → supabase.auth.signOut() → cookies cleared
```

### Next.js Middleware (Auth Guard)

```typescript
// middleware.ts
export async function middleware(request: NextRequest) {
  const { supabase, response } = createMiddlewareClient(request);
  const { data: { session } } = await supabase.auth.getSession();

  const isProtectedRoute = request.nextUrl.pathname.startsWith('/dashboard')
    || request.nextUrl.pathname.startsWith('/events')
    || request.nextUrl.pathname.startsWith('/sessions');

  if (isProtectedRoute && !session) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  return response;
}
```

### Participant Token Flow

Participants are not authenticated with Supabase Auth. Instead:

1. Participant calls `POST /api/v1/sessions/[sessionId]/join` with `{ displayName, avatar, joinCode }`
2. API route validates the join code, checks capacity, checks name uniqueness
3. API route creates a `session_participants` row with a `participant_token` (a `crypto.randomUUID()`)
4. Token is returned to the client and stored in `sessionStorage`
5. All subsequent participant API calls include `Authorization: Bearer <participant_token>` header
6. API routes validate the token against `session_participants.participant_token`


---

## QR Code Generation

QR codes are generated **client-side** using the [`qrcode`](https://www.npmjs.com/package/qrcode) npm package (no external service, no server round-trip).

```typescript
import QRCode from 'qrcode';

async function generateQRCodeDataURL(joinCode: string): Promise<string> {
  const url = `https://hoot.com/join/${joinCode}`;
  return QRCode.toDataURL(url, {
    width: 300,
    margin: 2,
    color: { dark: '#000000', light: '#ffffff' },
    errorCorrectionLevel: 'M',
  });
}
```

The resulting data URL is rendered in an `<img>` tag on the publish confirmation panel and the lobby presenter screen. For download, a `<a download="hoot-qr.png">` link wraps the image.

The QR code encodes `https://hoot.com/join/{join_code}`. When scanned, the browser navigates to `/join/[joinCode]` which pre-fills the join code and skips manual entry (Requirement 5.2).

---

## Analytics Data Model

### Real-Time Collection

During a session, `participant_answers` rows are inserted as answers arrive. No aggregation happens during the session — raw rows are the source of truth.

### Snapshot Generation (on session end)

When `POST /api/v1/sessions/[sessionId]/advance` transitions to `ended`, the API route triggers snapshot generation:

```typescript
async function generateAnalyticsSnapshots(sessionId: string) {
  const questions = await getSessionQuestions(sessionId);

  for (const question of questions) {
    const answers = await getAnswersForQuestion(sessionId, question.id);

    const optionCounts: Record<string, { count: number; percentage: number }> = {};
    const totalResponses = answers.filter(a => a.selected_option_ids?.length).length;

    for (const answer of answers) {
      for (const optionId of answer.selected_option_ids ?? []) {
        optionCounts[optionId] = optionCounts[optionId] ?? { count: 0, percentage: 0 };
        optionCounts[optionId].count++;
      }
    }

    // Calculate percentages
    for (const key of Object.keys(optionCounts)) {
      optionCounts[key].percentage = totalResponses > 0
        ? Math.round((optionCounts[key].count / totalResponses) * 100)
        : 0;
    }

    const avgResponseTime = answers.length > 0
      ? Math.round(answers.reduce((sum, a) => sum + (a.response_time_ms ?? 0), 0) / answers.length)
      : null;

    await upsertAnalyticsSnapshot({
      sessionId, questionId: question.id,
      totalResponses, optionCounts, avgResponseTimeMs: avgResponseTime,
    });
  }
}
```

### CSV Export

`GET /api/v1/analytics/[sessionId]/export` streams a CSV response:

```
Participant,Q1,Q2,...,Qn,Total
Alice,800,0,1000,...,1800
Bob,0,500,750,...,1250
```

- Score per question: `participant_answers.score_awarded` (0 if no row exists for that question)
- Total: `session_participants.total_score`
- Sorted by total score descending

### Data Retention

A Supabase scheduled function (pg_cron) runs daily and deletes `analytics_snapshots`, `participant_answers`, and `session_participants` rows where `sessions.ended_at < now() - interval '90 days'`. The `sessions` row itself is retained for the admin's event history.


---

## Error Handling

### API Route Error Responses

All API routes return consistent JSON error shapes:

```typescript
type ApiError = {
  error: {
    code: string;       // machine-readable, e.g. "SESSION_NOT_FOUND"
    message: string;    // human-readable
    field?: string;     // for validation errors
  };
};
```

### Key Error Scenarios

| Scenario | HTTP Status | Error Code |
|----------|-------------|------------|
| Invalid join code | 404 | `JOIN_CODE_NOT_FOUND` |
| Session already started | 409 | `SESSION_ALREADY_STARTED` |
| Session at capacity (150) | 409 | `SESSION_AT_CAPACITY` |
| Display name taken | 409 | `DISPLAY_NAME_TAKEN` |
| Answer already submitted | 409 | `ANSWER_ALREADY_SUBMITTED` |
| Question time expired | 422 | `QUESTION_TIME_EXPIRED` |
| Event has no questions | 422 | `EVENT_HAS_NO_QUESTIONS` |
| Duplicate event title | 409 | `DUPLICATE_EVENT_TITLE` |
| File too large | 413 | `FILE_TOO_LARGE` |
| Unsupported file type | 415 | `UNSUPPORTED_FILE_TYPE` |
| Unauthenticated admin | 401 | `UNAUTHORIZED` |
| Invalid participant token | 401 | `INVALID_PARTICIPANT_TOKEN` |
| Active session prevents delete | 409 | `SESSION_ACTIVE` |

### Client-Side Error Handling

- Network errors during answer submission: retry once with exponential backoff, then show "Connection lost" toast
- Realtime channel disconnect: attempt reconnect every 2 seconds for up to 60 seconds, then show reconnection UI
- On reconnect: call `GET /api/v1/sessions/[sessionId]` to fetch current state and re-render

### Reconnection Flow

```typescript
// In participant screen component
useEffect(() => {
  const channel = supabase.channel(`session:${sessionId}`);

  channel.on('system', { event: 'disconnect' }, async () => {
    setConnectionStatus('reconnecting');
    // Supabase Realtime auto-reconnects; on reconnect, fetch current state
    const state = await fetchSessionState(sessionId, participantToken);
    applySessionState(state);
    setConnectionStatus('connected');
  });
}, [sessionId]);
```


---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

**Property Reflection:** Before listing properties, redundancies were eliminated:
- Requirements 10.5 and 10.6 both state the score accumulation invariant — merged into Property 9.
- Requirements 3.5 and 3.6 both describe image file validation — merged into Property 6.
- Requirements 4.6 and 4.7 both concern join code invalidation on unpublish/re-publish — merged into Property 12.
- Requirements 14.2 and 14.3 both concern word cloud correctness — merged into Property 16.

---

### Property 1: Event title validation is length-bounded

*For any* string submitted as an event title, the Event_Manager SHALL accept it if and only if its character length is between 1 and 100 inclusive.

**Validates: Requirements 2.1**

---

### Property 2: New events are always created in Draft state

*For any* valid event creation input (title within bounds, optional description within bounds), the resulting event SHALL have `status = 'draft'`.

**Validates: Requirements 2.2**

---

### Property 3: Duplicate event titles under the same admin are rejected

*For any* admin and any valid title string, if an event with that title already exists for that admin, then attempting to create a second event with the same title (case-insensitively) SHALL be rejected with a validation error.

**Validates: Requirements 2.4**

---

### Property 4: Event list is always ordered by creation date descending

*For any* admin with a non-empty set of events, the list returned by the Event_Manager SHALL be sorted such that for every adjacent pair (A, B), A.created_at >= B.created_at.

**Validates: Requirements 2.7**

---

### Property 5: Multiple-choice option count is bounded to [2, 4]

*For any* multiple-choice question (single-select, multi-select, or image-based), the Question_Editor SHALL accept the question if and only if the number of answer options is between 2 and 4 inclusive.

**Validates: Requirements 3.2**

---

### Property 6: Question image file validation enforces format and size

*For any* file submitted as a question image attachment, the Question_Editor SHALL accept it if and only if its MIME type is one of {image/jpeg, image/png, image/gif, image/webp} AND its size is at most 5 MB (5,242,880 bytes).

**Validates: Requirements 3.5, 3.6**

---

### Property 7: Question text length is bounded to [1, 255]

*For any* string submitted as question text, the Question_Editor SHALL accept it if and only if its character length is between 1 and 255 inclusive.

**Validates: Requirements 3.7**

---

### Property 8: Rating scale min/max validation

*For any* pair of integers (min, max) submitted as rating scale bounds, the Question_Editor SHALL accept the configuration if and only if both values are in [1, 10] AND min < max.

**Validates: Requirements 3.8**

---

### Property 9: Published event join codes match the required format

*For any* event that has been successfully published, its join code SHALL match the regular expression `^[A-Z0-9]{6}$`.

**Validates: Requirements 4.2**

---

### Property 10: Published event QR code encodes the correct URL

*For any* published event with join code J, the QR code data SHALL encode the URL `https://hoot.com/join/J`.

**Validates: Requirements 4.3**

---

### Property 11: Publishing transitions event to Published state

*For any* event in Draft state with at least one question, calling publish SHALL result in the event having `status = 'published'`.

**Validates: Requirements 4.1**

---

### Property 12: Unpublish invalidates join code; re-publish generates a distinct new code

*For any* published event E with join code J1 that is unpublished and then re-published, the new join code J2 SHALL satisfy J2 ≠ J1, and J1 SHALL no longer be usable to join a session.

**Validates: Requirements 4.6, 4.7**

---

### Property 13: Display name validation enforces length and character set

*For any* string submitted as a participant display name, the Join_Service SHALL accept it if and only if its character length is between 1 and 30 inclusive AND it consists only of Unicode letters, digits, spaces, hyphens, or underscores.

**Validates: Requirements 5.3**

---

### Property 14: Duplicate display names within a session are rejected

*For any* active session S and any display name N already claimed by a participant in S, a subsequent join attempt using name N SHALL be rejected.

**Validates: Requirements 5.6**

---

### Property 15: Incorrect answers always score zero

*For any* question and any answer submission where the selected options do not match the correct options, the Scoring_Engine SHALL award exactly 0 points.

**Validates: Requirements 10.1**

---

### Property 16: Correct answer score follows the speed-weighted formula

*For any* correct answer submission with remaining time R (in milliseconds) and time limit T (in milliseconds), where 0 ≤ R ≤ T and T > 0, the Scoring_Engine SHALL award `max(1, floor(1000 × (R / T)))` points.

**Validates: Requirements 10.2**

---

### Property 17: Unanswered questions always score zero

*For any* question where no answer is submitted before the time limit expires, the Scoring_Engine SHALL record `score_awarded = 0` for that participant-question pair.

**Validates: Requirements 10.3**

---

### Property 18: First-submission-wins for duplicate answer attempts

*For any* participant P and question Q, if P submits answer A1 followed by answer A2, only A1 SHALL be scored; A2 SHALL be discarded and the score for Q SHALL remain equal to the score computed from A1.

**Validates: Requirements 10.4**

---

### Property 19: Score accumulation invariant

*For any* participant in any session, at all times the participant's `total_score` SHALL equal the sum of `score_awarded` across all of that participant's `participant_answers` rows for that session.

**Validates: Requirements 10.5, 10.6**

---

### Property 20: Leaderboard ordering by score then name

*For any* set of session participants, the leaderboard entries SHALL be ordered such that: (a) participants with higher `total_score` appear before those with lower scores, and (b) among participants with equal `total_score`, they appear in ascending alphabetical order of `display_name`.

**Validates: Requirements 11.3, 11.5**

---

### Property 21: Reconnection restores participant state

*For any* participant P with accumulated state (score, answer history) who disconnects and reconnects within the 60-second reconnection window using the same display name and join code, the restored state SHALL be identical to the state at the time of disconnection.

**Validates: Requirements 8.2**

---

### Property 22: Analytics snapshot correctness

*For any* ended session and any question Q in that session, the analytics snapshot for Q SHALL satisfy: (a) `total_responses` equals the count of `participant_answers` rows for Q with a non-null submission, (b) each option's `count` equals the number of answers that selected that option, (c) each option's `percentage` equals `round(count / total_responses * 100)` when `total_responses > 0`.

**Validates: Requirements 13.1, 13.2**

---

### Property 23: CSV export contains all participants with correct scores

*For any* ended session S with participants P1…Pn, the CSV export SHALL contain exactly n data rows (one per participant), and for each participant Pi, the per-question score in column Qj SHALL equal `participant_answers.score_awarded` for Pi on Qj (or 0 if no answer exists), and the total column SHALL equal `session_participants.total_score` for Pi.

**Validates: Requirements 13.3**

---

### Property 24: Open-text response length is bounded to 200 characters

*For any* string submitted as an open-text question response, the system SHALL accept it if and only if its character length is at most 200.

**Validates: Requirements 14.5**

---

### Property 25: Open-text questions always score zero

*For any* open-text question answer submission, regardless of content, the Scoring_Engine SHALL award exactly 0 points.

**Validates: Requirements 14.4**

---

### Property 26: Word cloud frequency ordering

*For any* set of open-text responses, the word cloud data SHALL assign a higher `count` value to words that appear more frequently, and the rendered size of each word SHALL be monotonically non-decreasing with respect to its `count`.

**Validates: Requirements 14.2, 14.3**


---

## Testing Strategy

### Overview

The testing strategy uses a dual approach: property-based tests for universal correctness properties and example-based unit/integration tests for specific scenarios, UI behavior, and infrastructure wiring.

### Property-Based Testing

**Library:** [`fast-check`](https://fast-check.io/) (TypeScript-native, works with Vitest)

**Configuration:** Each property test runs a minimum of 100 iterations.

**Tag format:** `// Feature: hoot-quiz-platform, Property {N}: {property_text}`

Properties to implement as PBT tests (mapped to design properties above):

| Property | Test file | What varies |
|----------|-----------|-------------|
| P1: Event title validation | `event-validation.test.ts` | Title strings of all lengths |
| P2: New events in draft state | `event-creation.test.ts` | Valid event inputs |
| P3: Duplicate title rejection | `event-creation.test.ts` | Title strings |
| P4: Event list ordering | `event-list.test.ts` | Sets of events with random created_at |
| P5: Option count bounds | `question-validation.test.ts` | Option counts |
| P6: Image file validation | `file-validation.test.ts` | File types and sizes |
| P7: Question text length | `question-validation.test.ts` | Text strings |
| P8: Rating scale validation | `question-validation.test.ts` | (min, max) integer pairs |
| P9: Join code format | `publish.test.ts` | Multiple publish operations |
| P10: QR code URL encoding | `publish.test.ts` | Join codes |
| P11: Publish state transition | `publish.test.ts` | Draft events with questions |
| P12: Unpublish/re-publish code uniqueness | `publish.test.ts` | Publish/unpublish cycles |
| P13: Display name validation | `join-validation.test.ts` | Name strings |
| P14: Duplicate name rejection | `join-validation.test.ts` | Sessions with existing participants |
| P15: Incorrect answer scores zero | `scoring.test.ts` | Wrong answer submissions |
| P16: Correct answer score formula | `scoring.test.ts` | (remaining_time, time_limit) pairs |
| P17: Unanswered scores zero | `scoring.test.ts` | No-answer scenarios |
| P18: First-submission-wins | `scoring.test.ts` | Multiple submission sequences |
| P19: Score accumulation invariant | `scoring.test.ts` | Sequences of answers |
| P20: Leaderboard ordering | `leaderboard.test.ts` | Participant sets with scores |
| P21: Reconnection state restoration | `reconnection.test.ts` | Participant states |
| P22: Analytics snapshot correctness | `analytics.test.ts` | Answer sets |
| P23: CSV export correctness | `analytics.test.ts` | Session data |
| P24: Open-text length validation | `question-validation.test.ts` | Response strings |
| P25: Open-text scores zero | `scoring.test.ts` | Open-text submissions |
| P26: Word cloud frequency ordering | `word-cloud.test.ts` | Response sets |

### Example-Based Unit Tests

Focus on specific scenarios not covered by properties:

- Auth flows (login, logout, password reset, token expiry)
- Session state machine transitions (each valid and invalid transition)
- Join flow error cases (session full, already started, invalid code)
- Question display behavior (single-select auto-submit, multi-select explicit submit)
- Reconnection edge cases (name conflict, window expired)
- Theming application
- File upload error messages

### Integration Tests

Test the full stack with a real Supabase test project:

- Participant join → answer → score persisted correctly
- Session advance → Realtime broadcast received by subscribers
- Session end → analytics snapshot generated
- CSV export returns correct data
- RLS policies: admin cannot access another admin's events

### Test Infrastructure

```
tests/
├── unit/
│   ├── scoring.test.ts          # PBT + examples
│   ├── event-validation.test.ts # PBT
│   ├── question-validation.test.ts # PBT
│   ├── join-validation.test.ts  # PBT
│   ├── leaderboard.test.ts      # PBT
│   ├── analytics.test.ts        # PBT
│   ├── word-cloud.test.ts       # PBT
│   └── publish.test.ts          # PBT
├── integration/
│   ├── session-flow.test.ts
│   ├── realtime.test.ts
│   └── rls.test.ts
└── e2e/
    └── participant-journey.test.ts  # Playwright
```

**Test runner:** Vitest (`vitest --run` for CI)
**E2E:** Playwright
**PBT library:** fast-check `^3.x`


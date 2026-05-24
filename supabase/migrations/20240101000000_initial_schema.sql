-- =============================================================================
-- Hoot Quiz Platform — Initial Schema Migration
-- =============================================================================
-- Creates all tables, CHECK constraints, UNIQUE indexes, foreign keys,
-- and the profiles auto-creation trigger.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- profiles
-- Extends Supabase Auth auth.users. Created automatically via trigger.
-- ---------------------------------------------------------------------------
CREATE TABLE profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);


-- ---------------------------------------------------------------------------
-- events
-- ---------------------------------------------------------------------------
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

-- Enforce unique event titles per admin (case-insensitive)
CREATE UNIQUE INDEX events_admin_title_unique
  ON events (admin_id, lower(title));


-- ---------------------------------------------------------------------------
-- questions
-- ---------------------------------------------------------------------------
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

-- Enforce unique position per event (used for ordering)
CREATE UNIQUE INDEX questions_event_position
  ON questions (event_id, position);


-- ---------------------------------------------------------------------------
-- answer_options
-- ---------------------------------------------------------------------------
CREATE TABLE answer_options (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  position    integer NOT NULL,
  text        text,           -- null for image_choice options
  image_url   text,           -- null for non-image options
  is_correct  boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);


-- ---------------------------------------------------------------------------
-- sessions
-- ---------------------------------------------------------------------------
CREATE TABLE sessions (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id               uuid NOT NULL REFERENCES events(id) ON DELETE RESTRICT,
  admin_id               uuid NOT NULL REFERENCES profiles(id),
  status                 text NOT NULL DEFAULT 'lobby'
                           CHECK (status IN (
                             'lobby', 'countdown', 'question',
                             'results', 'leaderboard',
                             'final_leaderboard', 'ended'
                           )),
  current_question_id    uuid REFERENCES questions(id),
  current_question_index integer,
  question_started_at    timestamptz,  -- server timestamp when question began
  participant_count      integer NOT NULL DEFAULT 0,
  started_at             timestamptz,
  ended_at               timestamptz,
  created_at             timestamptz NOT NULL DEFAULT now()
);


-- ---------------------------------------------------------------------------
-- session_participants
-- ---------------------------------------------------------------------------
CREATE TABLE session_participants (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id        uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  display_name      text NOT NULL CHECK (
                      char_length(display_name) BETWEEN 1 AND 30
                      AND display_name ~ '^[\p{L}\p{N} \-_]+$'
                    ),
  avatar            text NOT NULL,   -- emoji character
  total_score       integer NOT NULL DEFAULT 0,
  rank              integer,         -- updated after each question
  is_connected      boolean NOT NULL DEFAULT true,
  disconnected_at   timestamptz,     -- set on disconnect, cleared on reconnect
  participant_token text UNIQUE NOT NULL,
  -- opaque token stored in participant's localStorage for reconnection
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, display_name)
);


-- ---------------------------------------------------------------------------
-- participant_answers
-- ---------------------------------------------------------------------------
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


-- ---------------------------------------------------------------------------
-- analytics_snapshots
-- Materialised summary written when a session ends, for fast analytics reads.
-- ---------------------------------------------------------------------------
CREATE TABLE analytics_snapshots (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id           uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  question_id          uuid NOT NULL REFERENCES questions(id),
  total_responses      integer NOT NULL DEFAULT 0,
  option_counts        jsonb NOT NULL DEFAULT '{}',
  -- shape: { "<option_id>": { count: N, percentage: N } }
  avg_response_time_ms integer,
  created_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, question_id)
);


-- ---------------------------------------------------------------------------
-- join_code_history
-- Tracks previously used join codes to prevent reuse on re-publish.
-- ---------------------------------------------------------------------------
CREATE TABLE join_code_history (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  join_code  text NOT NULL,
  issued_at  timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);


-- =============================================================================
-- profiles auto-creation trigger
-- Automatically inserts a profiles row whenever a new auth.users row is created.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    now(),
    now()
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

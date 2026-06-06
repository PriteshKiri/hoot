-- =============================================================================
-- Hoot Quiz Platform — Full Database Setup
-- =============================================================================
-- Run this once in the Supabase SQL Editor on a fresh project.
-- It bundles all migrations (schema, RLS, storage, fixes, retention job) in
-- the correct order. Safe-ish to re-run: storage buckets use ON CONFLICT and
-- constraint fixes use DROP ... IF EXISTS, but the CREATE TABLE statements will
-- error if the tables already exist (expected on a clean project).
-- =============================================================================


-- =============================================================================
-- 1. INITIAL SCHEMA
-- =============================================================================

CREATE TABLE profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

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
  anonymous_mode boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX events_admin_title_unique
  ON events (admin_id, lower(title));

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

CREATE TABLE answer_options (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  position    integer NOT NULL,
  text        text,
  image_url   text,
  is_correct  boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id               uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  admin_id               uuid NOT NULL REFERENCES profiles(id),
  status                 text NOT NULL DEFAULT 'lobby'
                           CHECK (status IN (
                             'lobby', 'countdown', 'question',
                             'results', 'leaderboard',
                             'final_leaderboard', 'ended'
                           )),
  current_question_id    uuid REFERENCES questions(id) ON DELETE SET NULL,
  current_question_index integer,
  question_started_at    timestamptz,
  participant_count      integer NOT NULL DEFAULT 0,
  started_at             timestamptz,
  ended_at               timestamptz,
  created_at             timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE session_participants (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id        uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  display_name      text NOT NULL CHECK (
                      char_length(display_name) BETWEEN 1 AND 30
                      AND display_name ~ '^[[:alpha:][:digit:] \-_]+$'
                    ),
  avatar            text NOT NULL,
  total_score       integer NOT NULL DEFAULT 0,
  rank              integer,
  is_connected      boolean NOT NULL DEFAULT true,
  disconnected_at   timestamptz,
  participant_token text UNIQUE NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, display_name)
);

CREATE TABLE participant_answers (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id          uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  participant_id      uuid NOT NULL REFERENCES session_participants(id) ON DELETE CASCADE,
  question_id         uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  selected_option_ids uuid[],
  open_text_response  text CHECK (char_length(open_text_response) <= 200),
  rating_value        integer,
  is_correct          boolean,
  score_awarded       integer NOT NULL DEFAULT 0,
  response_time_ms    integer,
  submitted_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (participant_id, question_id)
);

CREATE TABLE analytics_snapshots (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id           uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  question_id          uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  total_responses      integer NOT NULL DEFAULT 0,
  option_counts        jsonb NOT NULL DEFAULT '{}',
  avg_response_time_ms integer,
  created_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, question_id)
);

CREATE TABLE join_code_history (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  join_code  text NOT NULL,
  issued_at  timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

-- profiles auto-creation trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, created_at, updated_at)
  VALUES (NEW.id, NEW.email, now(), now());
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Atomically increments a participant's total_score. Called from the answers
-- API route after each scored submission to avoid read-modify-write races.
CREATE OR REPLACE FUNCTION public.increment_participant_score(
  p_participant_id uuid,
  p_score integer
)
RETURNS void
LANGUAGE sql
AS $$
  UPDATE public.session_participants
  SET total_score = total_score + p_score
  WHERE id = p_participant_id;
$$;


-- =============================================================================
-- 2. RLS POLICIES
-- =============================================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own"
  ON profiles FOR SELECT USING (id = auth.uid());

CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE USING (id = auth.uid());

ALTER TABLE events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_select_own_events"
  ON events FOR SELECT USING (admin_id = auth.uid());

CREATE POLICY "admin_insert_own_events"
  ON events FOR INSERT WITH CHECK (admin_id = auth.uid());

CREATE POLICY "admin_update_own_events"
  ON events FOR UPDATE USING (admin_id = auth.uid());

CREATE POLICY "admin_delete_own_events"
  ON events FOR DELETE USING (admin_id = auth.uid());

ALTER TABLE questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_manage_questions"
  ON questions FOR ALL
  USING (event_id IN (SELECT id FROM events WHERE admin_id = auth.uid()));

ALTER TABLE answer_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_manage_answer_options"
  ON answer_options FOR ALL
  USING (
    question_id IN (
      SELECT q.id FROM questions q
      JOIN events e ON e.id = q.event_id
      WHERE e.admin_id = auth.uid()
    )
  );

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_manage_sessions"
  ON sessions FOR ALL USING (admin_id = auth.uid());

ALTER TABLE session_participants ENABLE ROW LEVEL SECURITY;
-- (no policies — service-role only)

ALTER TABLE participant_answers ENABLE ROW LEVEL SECURITY;
-- (no policies — service-role only)

ALTER TABLE analytics_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_read_analytics"
  ON analytics_snapshots FOR SELECT
  USING (session_id IN (SELECT id FROM sessions WHERE admin_id = auth.uid()));

ALTER TABLE join_code_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_manage_join_code_history"
  ON join_code_history FOR ALL
  USING (event_id IN (SELECT id FROM events WHERE admin_id = auth.uid()));


-- =============================================================================
-- 3. STORAGE BUCKETS + POLICIES
-- =============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'question-images', 'question-images', false, 5242880,
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'event-logos', 'event-logos', true, 2097152,
  ARRAY['image/jpeg', 'image/png', 'image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "admin_upload_question_images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'question-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "admin_read_question_images"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'question-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "admin_update_question_images"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'question-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "admin_delete_question_images"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'question-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "public_read_event_logos"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'event-logos');

CREATE POLICY "admin_upload_event_logos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'event-logos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "admin_update_event_logos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'event-logos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "admin_delete_event_logos"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'event-logos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );


-- =============================================================================
-- 4. DATA RETENTION (pg_cron) — OPTIONAL
-- =============================================================================
-- Requires the pg_cron extension. If you don't need automatic 90-day cleanup,
-- you can safely skip this block.

CREATE EXTENSION IF NOT EXISTS pg_cron;
GRANT USAGE ON SCHEMA cron TO postgres;

SELECT cron.unschedule('hoot-data-retention')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'hoot-data-retention');

SELECT cron.schedule(
  'hoot-data-retention',
  '0 3 * * *',
  $$
    DELETE FROM participant_answers
    WHERE session_id IN (
      SELECT id FROM sessions WHERE ended_at < NOW() - INTERVAL '90 days'
    );
    DELETE FROM session_participants
    WHERE session_id IN (
      SELECT id FROM sessions WHERE ended_at < NOW() - INTERVAL '90 days'
    );
    DELETE FROM analytics_snapshots
    WHERE session_id IN (
      SELECT id FROM sessions WHERE ended_at < NOW() - INTERVAL '90 days'
    );
  $$
);

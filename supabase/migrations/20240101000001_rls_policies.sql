-- =============================================================================
-- Migration: RLS Policies
-- Enables Row-Level Security on all tables and defines access policies.
--
-- Security model:
--   - Admins (authenticated Supabase Auth users) can only access their own data.
--   - Participants are unauthenticated; all participant-facing mutations go
--     through Next.js API routes using the service role key, which bypasses RLS.
--   - session_participants and participant_answers have NO client-facing policies
--     (RLS enabled but no policies = no direct client access; service role only).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Admins can read their own profile
CREATE POLICY "profiles_select_own"
  ON profiles
  FOR SELECT
  USING (id = auth.uid());

-- Admins can update their own profile
CREATE POLICY "profiles_update_own"
  ON profiles
  FOR UPDATE
  USING (id = auth.uid());

-- ---------------------------------------------------------------------------
-- events
-- ---------------------------------------------------------------------------
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_select_own_events"
  ON events
  FOR SELECT
  USING (admin_id = auth.uid());

CREATE POLICY "admin_insert_own_events"
  ON events
  FOR INSERT
  WITH CHECK (admin_id = auth.uid());

CREATE POLICY "admin_update_own_events"
  ON events
  FOR UPDATE
  USING (admin_id = auth.uid());

CREATE POLICY "admin_delete_own_events"
  ON events
  FOR DELETE
  USING (admin_id = auth.uid());

-- ---------------------------------------------------------------------------
-- questions
-- ---------------------------------------------------------------------------
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;

-- Admins can manage questions that belong to their own events
CREATE POLICY "admin_manage_questions"
  ON questions
  FOR ALL
  USING (
    event_id IN (
      SELECT id FROM events WHERE admin_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- answer_options
-- ---------------------------------------------------------------------------
ALTER TABLE answer_options ENABLE ROW LEVEL SECURITY;

-- Admins can manage answer options that belong to their own questions
CREATE POLICY "admin_manage_answer_options"
  ON answer_options
  FOR ALL
  USING (
    question_id IN (
      SELECT q.id
      FROM questions q
      JOIN events e ON e.id = q.event_id
      WHERE e.admin_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- sessions
-- ---------------------------------------------------------------------------
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- Admins can manage sessions they own
CREATE POLICY "admin_manage_sessions"
  ON sessions
  FOR ALL
  USING (admin_id = auth.uid());

-- ---------------------------------------------------------------------------
-- session_participants
-- Service-role only — RLS enabled but NO policies.
-- Participants are unauthenticated; all access goes through API routes
-- using the Supabase service role key, which bypasses RLS entirely.
-- ---------------------------------------------------------------------------
ALTER TABLE session_participants ENABLE ROW LEVEL SECURITY;

-- (no policies — intentional; direct client access is denied)

-- ---------------------------------------------------------------------------
-- participant_answers
-- Service-role only — same pattern as session_participants.
-- ---------------------------------------------------------------------------
ALTER TABLE participant_answers ENABLE ROW LEVEL SECURITY;

-- (no policies — intentional; direct client access is denied)

-- ---------------------------------------------------------------------------
-- analytics_snapshots
-- ---------------------------------------------------------------------------
ALTER TABLE analytics_snapshots ENABLE ROW LEVEL SECURITY;

-- Admins can read analytics snapshots for sessions they own
CREATE POLICY "admin_read_analytics"
  ON analytics_snapshots
  FOR SELECT
  USING (
    session_id IN (
      SELECT id FROM sessions WHERE admin_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- join_code_history
-- ---------------------------------------------------------------------------
ALTER TABLE join_code_history ENABLE ROW LEVEL SECURITY;

-- Admins can manage join code history for their own events
CREATE POLICY "admin_manage_join_code_history"
  ON join_code_history
  FOR ALL
  USING (
    event_id IN (
      SELECT id FROM events WHERE admin_id = auth.uid()
    )
  );

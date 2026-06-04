-- =============================================================================
-- Fix: Allow deleting questions even after they've been referenced by a
-- session, participant answer, or analytics snapshot.
-- =============================================================================
-- Originally these FKs defaulted to NO ACTION, which meant Postgres rejected
-- DELETE on `questions` once any session had ever referenced the question
-- (current_question_id) or any participant had answered it. That surfaced in
-- the UI as a generic "Failed to delete question." error.
--
-- We now:
--   * sessions.current_question_id        -> ON DELETE SET NULL   (history is
--     kept; the session simply has no current question once the question
--     row is gone)
--   * participant_answers.question_id     -> ON DELETE CASCADE    (per-question
--     answer rows are removed alongside the question)
--   * analytics_snapshots.question_id     -> ON DELETE CASCADE    (per-question
--     analytics rows are removed alongside the question)
-- =============================================================================

ALTER TABLE sessions
  DROP CONSTRAINT IF EXISTS sessions_current_question_id_fkey;

ALTER TABLE sessions
  ADD CONSTRAINT sessions_current_question_id_fkey
  FOREIGN KEY (current_question_id)
  REFERENCES questions(id)
  ON DELETE SET NULL;

ALTER TABLE participant_answers
  DROP CONSTRAINT IF EXISTS participant_answers_question_id_fkey;

ALTER TABLE participant_answers
  ADD CONSTRAINT participant_answers_question_id_fkey
  FOREIGN KEY (question_id)
  REFERENCES questions(id)
  ON DELETE CASCADE;

ALTER TABLE analytics_snapshots
  DROP CONSTRAINT IF EXISTS analytics_snapshots_question_id_fkey;

ALTER TABLE analytics_snapshots
  ADD CONSTRAINT analytics_snapshots_question_id_fkey
  FOREIGN KEY (question_id)
  REFERENCES questions(id)
  ON DELETE CASCADE;

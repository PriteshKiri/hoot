-- =============================================================================
-- Fix: Change sessions.event_id foreign key from ON DELETE RESTRICT to CASCADE
-- =============================================================================
-- Previously, deleting an event was blocked by any session row (even ended ones)
-- because the FK was RESTRICT. Changing to CASCADE lets event deletion
-- automatically clean up all associated sessions and their children
-- (session_participants, participant_answers, analytics_snapshots already
-- cascade from sessions).
-- =============================================================================

ALTER TABLE sessions
  DROP CONSTRAINT sessions_event_id_fkey;

ALTER TABLE sessions
  ADD CONSTRAINT sessions_event_id_fkey
  FOREIGN KEY (event_id)
  REFERENCES events(id)
  ON DELETE CASCADE;

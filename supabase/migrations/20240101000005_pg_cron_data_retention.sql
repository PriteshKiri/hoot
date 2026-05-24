-- pg_cron data retention job
-- Deletes analytics_snapshots, participant_answers, and session_participants
-- for sessions that ended more than 90 days ago.
--
-- Requirements: 13.4
--
-- NOTE: pg_cron must be enabled in your Supabase project.
-- Enable it via: Dashboard → Database → Extensions → pg_cron

-- Enable pg_cron extension (idempotent)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Grant usage to postgres role (required by pg_cron)
GRANT USAGE ON SCHEMA cron TO postgres;

-- Remove existing job if it exists (idempotent re-run)
SELECT cron.unschedule('hoot-data-retention')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'hoot-data-retention'
);

-- Schedule daily at 03:00 UTC
SELECT cron.schedule(
  'hoot-data-retention',
  '0 3 * * *',
  $$
    -- Delete participant answers for old sessions
    DELETE FROM participant_answers
    WHERE session_id IN (
      SELECT id FROM sessions
      WHERE ended_at < NOW() - INTERVAL '90 days'
    );

    -- Delete session participants for old sessions
    DELETE FROM session_participants
    WHERE session_id IN (
      SELECT id FROM sessions
      WHERE ended_at < NOW() - INTERVAL '90 days'
    );

    -- Delete analytics snapshots for old sessions
    DELETE FROM analytics_snapshots
    WHERE session_id IN (
      SELECT id FROM sessions
      WHERE ended_at < NOW() - INTERVAL '90 days'
    );
  $$
);

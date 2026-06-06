-- =============================================================================
-- Fix: Leaderboard always showing zero.
-- =============================================================================
-- The answers API route (POST /api/v1/sessions/[sessionId]/answers) calls the
-- `increment_participant_score` RPC to atomically bump a participant's
-- total_score after each scored submission. That function was never created,
-- so the RPC silently failed, total_score stayed at its default 0, and the
-- leaderboard always rendered zeros.
--
-- This migration adds the missing function.
-- =============================================================================

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

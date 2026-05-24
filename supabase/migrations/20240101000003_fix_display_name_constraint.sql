-- =============================================================================
-- Fix: display_name CHECK constraint on session_participants
--
-- The original constraint used \p{L} and \p{N} (PCRE/JS Unicode property
-- escapes) which PostgreSQL's POSIX regex engine does not support. Postgres
-- treats \p literally, so the constraint only matched the characters
-- p, {, L, }, N, space, hyphen, underscore — rejecting all normal names.
--
-- Fix: replace with a valid POSIX character class expression.
-- [[:alpha:][:digit:] \-_] matches Unicode letters (via ICU collation),
-- digits, spaces, hyphens, and underscores — matching the intended rule.
-- =============================================================================

ALTER TABLE session_participants
  DROP CONSTRAINT IF EXISTS session_participants_display_name_check;

ALTER TABLE session_participants
  ADD CONSTRAINT session_participants_display_name_check
  CHECK (
    char_length(display_name) BETWEEN 1 AND 30
    AND display_name ~ '^[[:alpha:][:digit:] \-_]+$'
  );

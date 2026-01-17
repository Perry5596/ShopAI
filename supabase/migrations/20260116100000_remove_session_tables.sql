-- Migration: Remove unused session tables
-- The session_artifacts and search_sessions tables are no longer in use within the app

-- ============================================================================
-- DROP SESSION_ARTIFACTS TABLE
-- ============================================================================
drop table if exists public.session_artifacts cascade;

-- ============================================================================
-- DROP SEARCH_SESSIONS TABLE
-- ============================================================================
drop table if exists public.search_sessions cascade;

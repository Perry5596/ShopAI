-- Migration: Add search sessions for staged pipeline
-- Phase 0: Instrumentation layer for debugging and performance monitoring

-- ============================================================================
-- SEARCH_SESSIONS TABLE
-- Tracks the state of each product search session through the pipeline
-- ============================================================================
CREATE TABLE public.search_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid REFERENCES public.shops(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  image_url text NOT NULL,
  image_hash text NOT NULL,
  status text DEFAULT 'identifying' 
    CHECK (status IN ('identifying', 'searching', 'ranking', 'completed', 'failed')),
  error text,
  -- Stage timings stored as JSONB for flexibility
  stage_timings jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes for common query patterns
CREATE INDEX search_sessions_shop_id_idx ON public.search_sessions(shop_id);
CREATE INDEX search_sessions_user_id_idx ON public.search_sessions(user_id);
CREATE INDEX search_sessions_image_hash_idx ON public.search_sessions(image_hash);
CREATE INDEX search_sessions_status_idx ON public.search_sessions(status);
CREATE INDEX search_sessions_created_at_idx ON public.search_sessions(created_at DESC);

-- ============================================================================
-- SESSION_ARTIFACTS TABLE
-- Stores intermediate outputs for debugging and caching
-- ============================================================================
CREATE TABLE public.session_artifacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES public.search_sessions(id) ON DELETE CASCADE NOT NULL,
  artifact_type text NOT NULL 
    CHECK (artifact_type IN ('hypothesis', 'store_result', 'ranked_result', 'raw_llm_output')),
  source text, -- For store_result: 'amazon', 'target', etc.
  payload jsonb NOT NULL,
  duration_ms integer, -- How long this step took
  created_at timestamptz DEFAULT now()
);

-- Indexes for artifact queries
CREATE INDEX session_artifacts_session_id_idx ON public.session_artifacts(session_id);
CREATE INDEX session_artifacts_type_idx ON public.session_artifacts(artifact_type);
CREATE INDEX session_artifacts_source_idx ON public.session_artifacts(source) WHERE source IS NOT NULL;

-- ============================================================================
-- ADD SESSION_ID TO SHOPS
-- Links shops to their search sessions
-- ============================================================================
ALTER TABLE public.shops ADD COLUMN session_id uuid REFERENCES public.search_sessions(id);
CREATE INDEX shops_session_id_idx ON public.shops(session_id) WHERE session_id IS NOT NULL;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================
ALTER TABLE public.search_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_artifacts ENABLE ROW LEVEL SECURITY;

-- Users can view their own sessions
CREATE POLICY "Users can view own sessions"
  ON public.search_sessions FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own sessions
CREATE POLICY "Users can insert own sessions"
  ON public.search_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own sessions
CREATE POLICY "Users can update own sessions"
  ON public.search_sessions FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can view artifacts for their own sessions
CREATE POLICY "Users can view own artifacts"
  ON public.session_artifacts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.search_sessions
      WHERE search_sessions.id = session_artifacts.session_id
      AND search_sessions.user_id = auth.uid()
    )
  );

-- Users can insert artifacts for their own sessions
CREATE POLICY "Users can insert own artifacts"
  ON public.session_artifacts FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.search_sessions
      WHERE search_sessions.id = session_artifacts.session_id
      AND search_sessions.user_id = auth.uid()
    )
  );

-- ============================================================================
-- UPDATED_AT TRIGGER
-- ============================================================================
CREATE TRIGGER search_sessions_updated_at
  BEFORE UPDATE ON public.search_sessions
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

-- ============================================================================
-- CLEANUP FUNCTION (for old sessions - will be called by cron or manually)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.cleanup_old_sessions(retention_hours integer DEFAULT 24)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM public.search_sessions
  WHERE created_at < now() - (retention_hours || ' hours')::interval
    AND status IN ('completed', 'failed');
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

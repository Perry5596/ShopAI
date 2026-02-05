-- Migration: Add push notification support
-- Adds notification columns to profiles and creates notification_history table

-- ============================================================================
-- ADD NOTIFICATION COLUMNS TO PROFILES
-- ============================================================================

-- Whether the user has enabled notifications (app-level preference)
ALTER TABLE public.profiles 
  ADD COLUMN notifications_enabled boolean DEFAULT true;

-- Expo push token for sending notifications
ALTER TABLE public.profiles 
  ADD COLUMN push_token text;

-- Last time the user was active in the app (for inactivity notifications)
ALTER TABLE public.profiles 
  ADD COLUMN last_activity_at timestamptz DEFAULT now();

-- Create index for efficient queries on inactive users
CREATE INDEX idx_profiles_last_activity 
  ON public.profiles(last_activity_at) 
  WHERE notifications_enabled = true AND push_token IS NOT NULL;

-- ============================================================================
-- NOTIFICATION HISTORY TABLE
-- Tracks sent notifications to prevent duplicates
-- ============================================================================

CREATE TABLE public.notification_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  notification_type text NOT NULL, -- '72h', '1week', 'weekly'
  message text, -- The actual message sent (for debugging/analytics)
  sent_at timestamptz DEFAULT now()
);

-- Index for efficient lookups when checking if notification was already sent
CREATE INDEX idx_notification_history_user_type_sent 
  ON public.notification_history(user_id, notification_type, sent_at DESC);

-- Enable RLS
ALTER TABLE public.notification_history ENABLE ROW LEVEL SECURITY;

-- Users can view their own notification history (for debugging in future)
CREATE POLICY "Users can view own notification history"
  ON public.notification_history FOR SELECT
  USING (auth.uid() = user_id);

-- Only service role can insert (notifications are sent by backend)
-- No insert policy for regular users - only service role bypasses RLS

-- ============================================================================
-- FUNCTION TO UPDATE LAST ACTIVITY
-- Called from the app when user becomes active
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_last_activity(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.profiles
  SET last_activity_at = now()
  WHERE id = p_user_id;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.update_last_activity(uuid) TO authenticated;

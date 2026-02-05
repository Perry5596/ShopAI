-- Migration: Add streak tracking to profiles table
-- Adds columns for tracking daily usage streak

-- Current streak count (resets to 1 if user misses a day)
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS current_streak integer DEFAULT 0;

-- Last date the user was active (used to calculate streak)
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS last_active_date date;

-- Create index for efficient streak queries
CREATE INDEX IF NOT EXISTS idx_profiles_last_active_date 
  ON public.profiles(last_active_date);

-- Comment on columns
COMMENT ON COLUMN public.profiles.current_streak IS 'Number of consecutive days the user has used the app';
COMMENT ON COLUMN public.profiles.last_active_date IS 'Last date the user was active, used for streak calculation';

-- Migration: Add onboarding fields to profiles table
-- Stores user preferences from onboarding flow (country, shopping categories, acquisition source)

-- ============================================================================
-- ADD ONBOARDING COLUMNS TO PROFILES
-- ============================================================================

-- User's country (ISO 3166-1 alpha-2 code, e.g., 'US', 'CA', 'GB')
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS country text;

-- Shopping categories the user is interested in (e.g., '{Electronics,Beauty}')
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS shopping_categories text[] DEFAULT '{}';

-- How the user found/heard about Shop AI (e.g., 'word_of_mouth', 'app_store_search')
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS acquisition_source text;

-- Free-text field for when acquisition_source is 'other'
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS acquisition_source_other text;

-- Whether the user has completed the onboarding flow
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean DEFAULT false;

-- Comment on columns
COMMENT ON COLUMN public.profiles.country IS 'User country code (ISO 3166-1 alpha-2) for regional shopping recommendations';
COMMENT ON COLUMN public.profiles.shopping_categories IS 'Array of shopping categories the user is interested in';
COMMENT ON COLUMN public.profiles.acquisition_source IS 'How the user discovered Shop AI (for analytics)';
COMMENT ON COLUMN public.profiles.acquisition_source_other IS 'Free-text description when acquisition_source is other';
COMMENT ON COLUMN public.profiles.onboarding_completed IS 'Whether the user has completed (or skipped) the onboarding flow';

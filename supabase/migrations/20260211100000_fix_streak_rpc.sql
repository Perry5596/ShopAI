-- Migration: Replace client-side streak logic with an atomic server-side RPC
-- Fixes timezone bugs and race conditions in streak calculation.
--
-- A "day" is defined as 12:00 AM – 11:59 PM in the user's local timezone.
-- The client passes its local date (YYYY-MM-DD) so the server never needs
-- to guess timezones.
--
-- Logic:
--   same day   → no-op, return current streak
--   yesterday  → increment streak by 1
--   older/null → reset streak to 1

CREATE OR REPLACE FUNCTION public.update_user_streak(
  p_user_id uuid,
  p_local_date date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_streak integer;
  v_last_active_date date;
  v_new_streak integer;
BEGIN
  -- Lock the row to prevent concurrent updates (atomic read-modify-write)
  SELECT current_streak, last_active_date
    INTO v_current_streak, v_last_active_date
    FROM public.profiles
   WHERE id = p_user_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('streak', 0, 'updated', false);
  END IF;

  v_current_streak := COALESCE(v_current_streak, 0);

  -- Already recorded today → no change
  IF v_last_active_date = p_local_date THEN
    RETURN jsonb_build_object('streak', v_current_streak, 'updated', false);
  END IF;

  -- Determine the new streak value
  IF v_last_active_date = (p_local_date - 1) THEN
    -- Last active was yesterday → consecutive day
    v_new_streak := v_current_streak + 1;
  ELSE
    -- Gap (or first-ever login) → start fresh
    v_new_streak := 1;
  END IF;

  -- Persist the new streak
  UPDATE public.profiles
     SET current_streak   = v_new_streak,
         last_active_date = p_local_date,
         updated_at       = now()
   WHERE id = p_user_id;

  RETURN jsonb_build_object('streak', v_new_streak, 'updated', true);
END;
$$;

-- Allow authenticated users to call this function
GRANT EXECUTE ON FUNCTION public.update_user_streak(uuid, date) TO authenticated;

COMMENT ON FUNCTION public.update_user_streak IS
  'Atomically updates a user''s daily login streak. '
  'Pass the user''s local calendar date to avoid timezone mismatches.';

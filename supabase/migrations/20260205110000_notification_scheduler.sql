-- Migration: Set up notification scheduler for inactive users
-- Uses pg_cron to run hourly and pg_net to call Expo Push API

-- ============================================================================
-- NOTIFICATION MESSAGES
-- Funny, engaging messages to bring users back to the app
-- ============================================================================

-- Create a table to store notification messages for easy management
CREATE TABLE IF NOT EXISTS public.notification_messages (
  id serial PRIMARY KEY,
  notification_type text NOT NULL, -- '72h', '1week', 'weekly'
  title text NOT NULL,
  body text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 72-hour notification messages (first nudge after 3 days)
INSERT INTO public.notification_messages (notification_type, title, body) VALUES
  ('72h', 'Missing You Already', 'Your deals are getting lonely. Come back and give them some love!'),
  ('72h', 'Plot Twist', 'Prices dropped while you were gone... just saying.'),
  ('72h', 'We Found Something', 'We found something you might like. Okay, we found A LOT.'),
  ('72h', 'Quick Question', 'Did you forget about us or are you just playing hard to get?'),
  ('72h', 'Deals Await', 'The deals aren''t going to find themselves. Well, actually they are. Come see!'),
  ('72h', 'Money Saving Mode', 'Your wallet called. It wants to save more money.'),
  ('72h', 'Been A While', 'It''s been 3 days. In deal years, that''s like... 3 days. Come back!'),
  ('72h', 'New Deals Alert', 'New deals just dropped. You''re going to want to see this.'),
  ('72h', 'We Waited', 'We tried to wait patiently. We failed. Please come back.'),
  ('72h', 'Scan Something', 'Your camera is feeling underutilized. Give it a workout!');

-- 1-week notification messages (second nudge after 7 days)
INSERT INTO public.notification_messages (notification_type, title, body) VALUES
  ('1week', 'A Whole Week?', 'A week without ShopAI? Your wallet called. It misses saving money.'),
  ('1week', 'Mysterious Prices', 'Prices are doing things. Mysterious things. Better come see.'),
  ('1week', 'We Practiced', 'We''ve been practicing finding deals. We''re really good now. Promise.'),
  ('1week', 'Miss You', 'Seven days, zero scans. This is not the vibe we were going for.'),
  ('1week', 'Deals Are Waiting', 'The deals have been asking about you. It''s getting awkward.'),
  ('1week', 'Price Drops Happening', 'So many price drops happened this week. You missed them all. Sad.'),
  ('1week', 'Still Here', 'Still here. Still finding deals. Still wondering where you went.'),
  ('1week', 'Scan Something!', 'One week without scanning anything? That''s not very smart shopper of you.'),
  ('1week', 'Your Wallet Misses You', 'Your wallet: "Please, I want to save money again."'),
  ('1week', 'Come Back!', 'We''ve been saving deals for you. The collection is growing.');

-- Weekly notification messages (recurring after initial week)
INSERT INTO public.notification_messages (notification_type, title, body) VALUES
  ('weekly', 'Weekly Check-In', 'Still here. Still finding deals. Still waiting for you.'),
  ('weekly', 'Forgotten?', 'The deals are starting to think you''ve forgotten them...'),
  ('weekly', 'Quick Question', 'Quick question: Do you hate saving money? Just checking.'),
  ('weekly', 'We Miss You', 'We miss you more than retailers miss your full-price purchases.'),
  ('weekly', 'Deals Are Here', 'Another week, another batch of deals you''re missing out on.'),
  ('weekly', 'Friendly Reminder', 'Just your friendly neighborhood deal finder, checking in.'),
  ('weekly', 'Open The App', 'The app icon is right there. Just tap it. You know you want to.'),
  ('weekly', 'Price Alert', 'Prices are at all-time lows for things you probably want.'),
  ('weekly', 'Scan Anything', 'Point your camera at literally anything. We''ll find you a deal.'),
  ('weekly', 'We''re Still Here', 'We''re still here, doing deal things. Join us?');

-- ============================================================================
-- FUNCTION TO SEND NOTIFICATIONS VIA EXPO PUSH API
-- Called by the scheduler for each user that needs a notification
-- ============================================================================

CREATE OR REPLACE FUNCTION public.send_expo_push_notification(
  p_push_token text,
  p_title text,
  p_body text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_request_id bigint;
  v_response_status int;
BEGIN
  -- Use pg_net to make HTTP request to Expo Push API
  SELECT net.http_post(
    url := 'https://exp.host/--/api/v2/push/send',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Accept', 'application/json'
    ),
    body := jsonb_build_object(
      'to', p_push_token,
      'title', p_title,
      'body', p_body,
      'sound', 'default',
      'priority', 'high'
    )
  ) INTO v_request_id;

  -- Return true to indicate request was queued
  -- Note: pg_net is async, so we can't check the response immediately
  RETURN true;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Failed to send push notification: %', SQLERRM;
    RETURN false;
END;
$$;

-- ============================================================================
-- MAIN SCHEDULER FUNCTION
-- Finds inactive users and sends appropriate notifications
-- ============================================================================

CREATE OR REPLACE FUNCTION public.send_inactive_user_notifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user RECORD;
  v_message RECORD;
  v_notification_type text;
  v_sent_count int := 0;
BEGIN
  -- Process 72-hour notifications (users inactive for 72+ hours, no 72h notification sent)
  FOR v_user IN
    SELECT p.id, p.push_token
    FROM public.profiles p
    WHERE p.notifications_enabled = true
      AND p.push_token IS NOT NULL
      AND p.last_activity_at < now() - interval '72 hours'
      AND p.last_activity_at >= now() - interval '7 days' -- Haven't hit 1-week threshold yet
      AND NOT EXISTS (
        SELECT 1 FROM public.notification_history nh
        WHERE nh.user_id = p.id
          AND nh.notification_type = '72h'
          AND nh.sent_at > p.last_activity_at
      )
    LIMIT 100 -- Process in batches to avoid timeouts
  LOOP
    -- Get a random message for this notification type
    SELECT title, body INTO v_message
    FROM public.notification_messages
    WHERE notification_type = '72h'
    ORDER BY random()
    LIMIT 1;

    -- Send the notification
    IF public.send_expo_push_notification(v_user.push_token, v_message.title, v_message.body) THEN
      -- Record the notification
      INSERT INTO public.notification_history (user_id, notification_type, message)
      VALUES (v_user.id, '72h', v_message.body);
      v_sent_count := v_sent_count + 1;
    END IF;
  END LOOP;

  -- Process 1-week notifications (users inactive for 7+ days, no 1week notification sent)
  FOR v_user IN
    SELECT p.id, p.push_token
    FROM public.profiles p
    WHERE p.notifications_enabled = true
      AND p.push_token IS NOT NULL
      AND p.last_activity_at < now() - interval '7 days'
      AND NOT EXISTS (
        SELECT 1 FROM public.notification_history nh
        WHERE nh.user_id = p.id
          AND nh.notification_type = '1week'
          AND nh.sent_at > p.last_activity_at
      )
      -- Must have received 72h notification already
      AND EXISTS (
        SELECT 1 FROM public.notification_history nh
        WHERE nh.user_id = p.id
          AND nh.notification_type = '72h'
          AND nh.sent_at > p.last_activity_at
      )
    LIMIT 100
  LOOP
    SELECT title, body INTO v_message
    FROM public.notification_messages
    WHERE notification_type = '1week'
    ORDER BY random()
    LIMIT 1;

    IF public.send_expo_push_notification(v_user.push_token, v_message.title, v_message.body) THEN
      INSERT INTO public.notification_history (user_id, notification_type, message)
      VALUES (v_user.id, '1week', v_message.body);
      v_sent_count := v_sent_count + 1;
    END IF;
  END LOOP;

  -- Process weekly notifications (users who got 1week notification 7+ days ago)
  FOR v_user IN
    SELECT p.id, p.push_token
    FROM public.profiles p
    WHERE p.notifications_enabled = true
      AND p.push_token IS NOT NULL
      AND p.last_activity_at < now() - interval '7 days'
      -- Must have received 1week notification
      AND EXISTS (
        SELECT 1 FROM public.notification_history nh
        WHERE nh.user_id = p.id
          AND nh.notification_type = '1week'
          AND nh.sent_at > p.last_activity_at
      )
      -- Last notification (of any weekly type) was 7+ days ago
      AND NOT EXISTS (
        SELECT 1 FROM public.notification_history nh
        WHERE nh.user_id = p.id
          AND nh.notification_type IN ('1week', 'weekly')
          AND nh.sent_at > now() - interval '7 days'
      )
    LIMIT 100
  LOOP
    SELECT title, body INTO v_message
    FROM public.notification_messages
    WHERE notification_type = 'weekly'
    ORDER BY random()
    LIMIT 1;

    IF public.send_expo_push_notification(v_user.push_token, v_message.title, v_message.body) THEN
      INSERT INTO public.notification_history (user_id, notification_type, message)
      VALUES (v_user.id, 'weekly', v_message.body);
      v_sent_count := v_sent_count + 1;
    END IF;
  END LOOP;

  RAISE NOTICE 'Sent % notifications', v_sent_count;
END;
$$;

-- ============================================================================
-- SCHEDULE THE JOB
-- Run every hour to check for users needing notifications
-- ============================================================================

-- Note: pg_cron must be enabled in Supabase Dashboard > Database > Extensions
-- The following will only work if pg_cron extension is enabled

-- Schedule to run every hour at minute 0
-- SELECT cron.schedule(
--   'send-inactive-notifications',
--   '0 * * * *',
--   'SELECT public.send_inactive_user_notifications()'
-- );

-- For now, we'll add a comment about enabling this manually
-- To enable the cron job, run this in the SQL editor after enabling pg_cron:
-- SELECT cron.schedule('send-inactive-notifications', '0 * * * *', 'SELECT public.send_inactive_user_notifications()');

-- ============================================================================
-- CLEANUP FUNCTION
-- Remove old notification history entries (older than 90 days)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.cleanup_notification_history()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  DELETE FROM public.notification_history
  WHERE sent_at < now() - interval '90 days';
END;
$$;

-- Schedule cleanup to run daily at 3 AM (commented out - enable manually)
-- SELECT cron.schedule('cleanup-notification-history', '0 3 * * *', 'SELECT public.cleanup_notification_history()');

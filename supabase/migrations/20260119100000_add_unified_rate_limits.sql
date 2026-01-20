-- Migration: Add unified rate limiting for both authenticated users and anonymous guests
-- Supports subjects in format: "user:<uuid>" or "anon:<uuid>"
-- Uses atomic INSERT ... ON CONFLICT DO UPDATE for thread-safe rate limiting

-- ============================================================================
-- UNIFIED RATE LIMITS TABLE
-- Tracks rate limit window and count per subject (user or anonymous)
-- ============================================================================
create table public.rate_limits (
  subject text primary key,  -- "user:<uuid>" or "anon:<uuid>"
  window_start timestamptz not null default now(),
  request_count integer not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Create index for cleanup queries (finding expired windows)
create index rate_limits_window_start_idx on public.rate_limits(window_start);

-- Note: No RLS needed - this table is only accessed via security definer functions
-- and Edge Functions with service role

-- ============================================================================
-- ATOMIC RATE LIMIT FUNCTION
-- Thread-safe rate limiting using INSERT ... ON CONFLICT DO UPDATE
-- ============================================================================

-- Function to atomically check and increment rate limit
-- Returns: { allowed: boolean, remaining: integer, reset_at: timestamptz, limit: integer }
create or replace function public.rate_limit_take(
  p_subject text,
  p_limit integer default 14,
  p_window_seconds integer default 604800  -- 7 days = 604800 seconds
)
returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  v_now timestamptz := now();
  v_window_start timestamptz;
  v_window_end timestamptz;
  v_count integer;
  v_allowed boolean;
  v_remaining integer;
begin
  -- Atomic upsert: insert new record or update existing
  insert into public.rate_limits (subject, window_start, request_count, created_at, updated_at)
  values (p_subject, v_now, 1, v_now, v_now)
  on conflict (subject) do update
  set
    -- Reset window if expired, otherwise keep existing
    window_start = case
      when public.rate_limits.window_start + (p_window_seconds || ' seconds')::interval <= v_now
      then v_now
      else public.rate_limits.window_start
    end,
    -- Reset count if window expired, otherwise increment
    request_count = case
      when public.rate_limits.window_start + (p_window_seconds || ' seconds')::interval <= v_now
      then 1
      else public.rate_limits.request_count + 1
    end,
    updated_at = v_now
  returning window_start, request_count into v_window_start, v_count;

  -- Calculate window end
  v_window_end := v_window_start + (p_window_seconds || ' seconds')::interval;

  -- Check if this request is allowed (count <= limit)
  v_allowed := v_count <= p_limit;
  v_remaining := greatest(p_limit - v_count, 0);

  -- If not allowed, we need to "undo" the increment we just did
  -- by not counting this request (decrement back)
  if not v_allowed then
    update public.rate_limits
    set request_count = request_count - 1,
        updated_at = v_now
    where subject = p_subject;
    
    -- Remaining stays at 0 when blocked
    v_remaining := 0;
  end if;

  return jsonb_build_object(
    'allowed', v_allowed,
    'remaining', v_remaining,
    'reset_at', v_window_end,
    'limit', p_limit,
    'used', case when v_allowed then v_count else v_count - 1 end
  );
end;
$$;

-- ============================================================================
-- RATE LIMIT CHECK FUNCTION (read-only, doesn't increment)
-- For UI display purposes - shows current status without consuming a request
-- ============================================================================
create or replace function public.rate_limit_check(
  p_subject text,
  p_limit integer default 14,
  p_window_seconds integer default 604800
)
returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  v_now timestamptz := now();
  v_record record;
  v_window_end timestamptz;
  v_remaining integer;
  v_can_proceed boolean;
begin
  -- Get current rate limit record
  select * into v_record
  from public.rate_limits
  where subject = p_subject;

  -- If no record exists, user has full quota
  if v_record is null then
    return jsonb_build_object(
      'allowed', true,
      'remaining', p_limit,
      'reset_at', null,
      'limit', p_limit,
      'used', 0
    );
  end if;

  -- Calculate window end
  v_window_end := v_record.window_start + (p_window_seconds || ' seconds')::interval;

  -- Check if window has expired
  if v_now >= v_window_end then
    -- Window expired, user has full quota
    return jsonb_build_object(
      'allowed', true,
      'remaining', p_limit,
      'reset_at', null,
      'limit', p_limit,
      'used', 0
    );
  end if;

  -- Window is active, calculate remaining
  v_remaining := greatest(p_limit - v_record.request_count, 0);
  v_can_proceed := v_remaining > 0;

  return jsonb_build_object(
    'allowed', v_can_proceed,
    'remaining', v_remaining,
    'reset_at', v_window_end,
    'limit', p_limit,
    'used', v_record.request_count
  );
end;
$$;

-- ============================================================================
-- CLEANUP FUNCTION
-- Removes expired rate limit records to prevent table bloat
-- Should be called periodically (e.g., daily via pg_cron or external scheduler)
-- ============================================================================
create or replace function public.rate_limit_cleanup(
  p_window_seconds integer default 604800
)
returns integer
language plpgsql
security definer set search_path = ''
as $$
declare
  v_deleted integer;
begin
  delete from public.rate_limits
  where window_start + (p_window_seconds || ' seconds')::interval < now()
  returning count(*) into v_deleted;
  
  return coalesce(v_deleted, 0);
end;
$$;

-- ============================================================================
-- UPDATED_AT TRIGGER
-- ============================================================================
create trigger rate_limits_updated_at
  before update on public.rate_limits
  for each row execute procedure public.handle_updated_at();

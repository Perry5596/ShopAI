-- Migration: Add rate limiting for shops
-- Users are limited to 14 shops per week, with the window starting from their first shop

-- ============================================================================
-- SHOP RATE LIMITS TABLE
-- Tracks the rate limit window and count per user
-- ============================================================================
create table public.shop_rate_limits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null unique,
  window_start timestamptz not null default now(),
  shop_count integer not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Create index for faster lookups
create index shop_rate_limits_user_id_idx on public.shop_rate_limits(user_id);

-- Enable RLS
alter table public.shop_rate_limits enable row level security;

-- Policies for shop_rate_limits
create policy "Users can view own rate limits"
  on public.shop_rate_limits for select
  using (auth.uid() = user_id);

create policy "Users can insert own rate limits"
  on public.shop_rate_limits for insert
  with check (auth.uid() = user_id);

create policy "Users can update own rate limits"
  on public.shop_rate_limits for update
  using (auth.uid() = user_id);

-- ============================================================================
-- RATE LIMIT HELPER FUNCTIONS
-- ============================================================================

-- Constants
-- RATE_LIMIT_MAX_SHOPS: 14 shops per window
-- RATE_LIMIT_WINDOW_DAYS: 7 days

-- Function to check if user can create a new shop
-- Returns the current rate limit status
create or replace function public.check_shop_rate_limit(p_user_id uuid)
returns json
language plpgsql
security definer set search_path = ''
as $$
declare
  v_rate_limit record;
  v_max_shops constant integer := 14;
  v_window_days constant integer := 7;
  v_window_end timestamptz;
  v_shops_remaining integer;
  v_can_shop boolean;
  v_resets_at timestamptz;
begin
  -- Get user's rate limit record
  select * into v_rate_limit
  from public.shop_rate_limits
  where user_id = p_user_id;

  -- If no record exists, user can shop (first shop will create the record)
  if v_rate_limit is null then
    return json_build_object(
      'canShop', true,
      'shopsUsed', 0,
      'shopsRemaining', v_max_shops,
      'maxShops', v_max_shops,
      'windowStart', null,
      'resetsAt', null
    );
  end if;

  -- Calculate window end
  v_window_end := v_rate_limit.window_start + (v_window_days || ' days')::interval;

  -- Check if window has expired
  if now() >= v_window_end then
    -- Window expired, user can shop (will reset on next successful shop)
    return json_build_object(
      'canShop', true,
      'shopsUsed', 0,
      'shopsRemaining', v_max_shops,
      'maxShops', v_max_shops,
      'windowStart', null,
      'resetsAt', null
    );
  end if;

  -- Window is still active, check remaining shops
  v_shops_remaining := v_max_shops - v_rate_limit.shop_count;
  v_can_shop := v_shops_remaining > 0;
  v_resets_at := v_window_end;

  return json_build_object(
    'canShop', v_can_shop,
    'shopsUsed', v_rate_limit.shop_count,
    'shopsRemaining', greatest(v_shops_remaining, 0),
    'maxShops', v_max_shops,
    'windowStart', v_rate_limit.window_start,
    'resetsAt', v_resets_at
  );
end;
$$;

-- Function to increment shop count after successful shop completion
-- This should only be called after a shop has been successfully processed
create or replace function public.increment_shop_rate_limit(p_user_id uuid)
returns json
language plpgsql
security definer set search_path = ''
as $$
declare
  v_rate_limit record;
  v_max_shops constant integer := 14;
  v_window_days constant integer := 7;
  v_window_end timestamptz;
  v_new_count integer;
begin
  -- Get user's rate limit record
  select * into v_rate_limit
  from public.shop_rate_limits
  where user_id = p_user_id
  for update; -- Lock the row for update

  -- If no record exists, create one
  if v_rate_limit is null then
    insert into public.shop_rate_limits (user_id, window_start, shop_count)
    values (p_user_id, now(), 1)
    returning * into v_rate_limit;

    v_window_end := v_rate_limit.window_start + (v_window_days || ' days')::interval;

    return json_build_object(
      'success', true,
      'shopsUsed', 1,
      'shopsRemaining', v_max_shops - 1,
      'maxShops', v_max_shops,
      'windowStart', v_rate_limit.window_start,
      'resetsAt', v_window_end
    );
  end if;

  -- Calculate window end
  v_window_end := v_rate_limit.window_start + (v_window_days || ' days')::interval;

  -- Check if window has expired
  if now() >= v_window_end then
    -- Reset window and start fresh count at 1
    update public.shop_rate_limits
    set window_start = now(),
        shop_count = 1,
        updated_at = now()
    where user_id = p_user_id
    returning * into v_rate_limit;

    v_window_end := v_rate_limit.window_start + (v_window_days || ' days')::interval;

    return json_build_object(
      'success', true,
      'shopsUsed', 1,
      'shopsRemaining', v_max_shops - 1,
      'maxShops', v_max_shops,
      'windowStart', v_rate_limit.window_start,
      'resetsAt', v_window_end
    );
  end if;

  -- Window is still active, increment count
  v_new_count := v_rate_limit.shop_count + 1;

  update public.shop_rate_limits
  set shop_count = v_new_count,
      updated_at = now()
  where user_id = p_user_id;

  return json_build_object(
    'success', true,
    'shopsUsed', v_new_count,
    'shopsRemaining', greatest(v_max_shops - v_new_count, 0),
    'maxShops', v_max_shops,
    'windowStart', v_rate_limit.window_start,
    'resetsAt', v_window_end
  );
end;
$$;

-- Trigger to update updated_at
create trigger shop_rate_limits_updated_at
  before update on public.shop_rate_limits
  for each row execute procedure public.handle_updated_at();

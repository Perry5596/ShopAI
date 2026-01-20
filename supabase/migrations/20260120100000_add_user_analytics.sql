-- Migration: Add user analytics table for tracking user activity
-- Tracks authenticated users only (scans, link clicks, expandable for future metrics)

-- ============================================================================
-- USER ANALYTICS TABLE
-- One row per authenticated user, stores running counts of various actions
-- ============================================================================
create table public.user_analytics (
  user_id uuid references public.profiles(id) on delete cascade primary key,
  scan_count integer not null default 0,
  link_click_count integer not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Create index for queries by user
create index user_analytics_user_id_idx on public.user_analytics(user_id);

-- Enable RLS
alter table public.user_analytics enable row level security;

-- ============================================================================
-- RLS POLICIES
-- Users can only read and update their own analytics
-- ============================================================================
create policy "Users can view own analytics"
  on public.user_analytics for select
  using (auth.uid() = user_id);

create policy "Users can insert own analytics"
  on public.user_analytics for insert
  with check (auth.uid() = user_id);

create policy "Users can update own analytics"
  on public.user_analytics for update
  using (auth.uid() = user_id);

-- ============================================================================
-- INCREMENT ANALYTICS FUNCTION
-- Atomic upsert function to increment analytics counters
-- Supports multiple event types for expandability
-- ============================================================================
create or replace function public.increment_analytics(
  p_user_id uuid,
  p_event_type text  -- 'scan', 'link_click', or future event types
)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  -- Upsert: insert new row or update existing
  insert into public.user_analytics (user_id, scan_count, link_click_count, created_at, updated_at)
  values (
    p_user_id,
    case when p_event_type = 'scan' then 1 else 0 end,
    case when p_event_type = 'link_click' then 1 else 0 end,
    now(),
    now()
  )
  on conflict (user_id) do update
  set
    scan_count = public.user_analytics.scan_count + case when p_event_type = 'scan' then 1 else 0 end,
    link_click_count = public.user_analytics.link_click_count + case when p_event_type = 'link_click' then 1 else 0 end,
    updated_at = now();
end;
$$;

-- ============================================================================
-- AUTO-CREATE TRIGGER
-- Automatically create analytics row when a new profile is created
-- ============================================================================
create or replace function public.handle_new_profile_analytics()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.user_analytics (user_id, created_at, updated_at)
  values (new.id, now(), now())
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_profile_created_analytics
  after insert on public.profiles
  for each row execute procedure public.handle_new_profile_analytics();

-- ============================================================================
-- INITIALIZE EXISTING USERS
-- Create analytics rows for all existing profiles
-- ============================================================================
insert into public.user_analytics (user_id, created_at, updated_at)
select id, now(), now()
from public.profiles
on conflict (user_id) do nothing;

-- ============================================================================
-- UPDATED_AT TRIGGER
-- ============================================================================
create trigger user_analytics_updated_at
  before update on public.user_analytics
  for each row execute procedure public.handle_updated_at();

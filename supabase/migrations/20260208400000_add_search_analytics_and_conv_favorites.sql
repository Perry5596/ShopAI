-- Migration: Add text search analytics column and conversation favorites
-- 1. Adds text_search_count to user_analytics
-- 2. Updates increment_analytics to support 'text_search' event type
-- 3. Adds is_favorite to conversations

-- ============================================================================
-- ADD TEXT SEARCH COUNT TO ANALYTICS
-- ============================================================================
alter table public.user_analytics
  add column text_search_count integer not null default 0;

-- ============================================================================
-- UPDATE increment_analytics TO SUPPORT 'text_search' EVENT TYPE
-- ============================================================================
create or replace function public.increment_analytics(
  p_user_id uuid,
  p_event_type text  -- 'scan', 'link_click', 'text_search'
)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.user_analytics (
    user_id, scan_count, link_click_count, text_search_count, created_at, updated_at
  )
  values (
    p_user_id,
    case when p_event_type = 'scan' then 1 else 0 end,
    case when p_event_type = 'link_click' then 1 else 0 end,
    case when p_event_type = 'text_search' then 1 else 0 end,
    now(),
    now()
  )
  on conflict (user_id) do update
  set
    scan_count = public.user_analytics.scan_count
      + case when p_event_type = 'scan' then 1 else 0 end,
    link_click_count = public.user_analytics.link_click_count
      + case when p_event_type = 'link_click' then 1 else 0 end,
    text_search_count = public.user_analytics.text_search_count
      + case when p_event_type = 'text_search' then 1 else 0 end,
    updated_at = now();
end;
$$;

-- ============================================================================
-- ADD is_favorite TO CONVERSATIONS
-- ============================================================================
alter table public.conversations
  add column is_favorite boolean default false not null;

-- Index for efficient favorite lookups
create index conversations_is_favorite_idx
  on public.conversations(is_favorite)
  where is_favorite = true;

-- RLS: Users can already update their own conversations (existing policy)
-- No new policy needed since "Users can update own conversations" already exists.

-- ============================================================================
-- COMMENTS
-- ============================================================================
comment on column public.user_analytics.text_search_count
  is 'Number of AI text searches performed by this user';
comment on column public.conversations.is_favorite
  is 'Whether this conversation has been saved/bookmarked by the user';

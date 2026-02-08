-- Migration: Add summary columns to conversations for fast list-view queries
-- Stores thumbnail, category/product counts so we don't need to join
-- messages → categories → products just to render the home screen list.

-- ============================================================================
-- ADD SUMMARY COLUMNS
-- ============================================================================
alter table public.conversations
  add column thumbnail_url text,
  add column total_categories integer default 0 not null,
  add column total_products integer default 0 not null;

-- ============================================================================
-- BACK-FILL EXISTING CONVERSATIONS
-- Set total_categories and total_products from existing data
-- ============================================================================
update public.conversations c
set
  total_categories = (
    select count(*)
    from public.search_categories sc
    where sc.conversation_id = c.id
  ),
  total_products = (
    select count(*)
    from public.search_products sp
    join public.search_categories sc on sc.id = sp.category_id
    where sc.conversation_id = c.id
  );

-- Back-fill thumbnail_url: pick the image from the first product of the first category
update public.conversations c
set thumbnail_url = sub.image_url
from (
  select distinct on (sc.conversation_id)
    sc.conversation_id,
    sp.image_url
  from public.search_categories sc
  join public.search_products sp on sp.category_id = sc.id
  where sp.image_url is not null
  order by sc.conversation_id, sc.sort_order asc, sp.created_at asc
) sub
where c.id = sub.conversation_id;

-- ============================================================================
-- COMMENTS
-- ============================================================================
comment on column public.conversations.thumbnail_url
  is 'Image URL of the top AI pick product (first category) for list-view display';
comment on column public.conversations.total_categories
  is 'Cached count of search categories for fast list rendering';
comment on column public.conversations.total_products
  is 'Cached count of total products across all categories';

-- Migration: Add product-level favorites to search_products
-- Allows users to save individual products from text search results

-- ============================================================================
-- ADD is_favorite COLUMN
-- ============================================================================
alter table public.search_products
  add column is_favorite boolean default false not null;

-- Index for efficient favorite lookups
create index search_products_is_favorite_idx
  on public.search_products(is_favorite)
  where is_favorite = true;

-- ============================================================================
-- RLS: Allow users to update their own search products (for toggling favorite)
-- ============================================================================
create policy "Users can update search products of own conversations"
  on public.search_products for update
  using (
    exists (
      select 1 from public.search_categories
      join public.conversations on conversations.id = search_categories.conversation_id
      where search_categories.id = search_products.category_id
      and conversations.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.search_categories
      join public.conversations on conversations.id = search_categories.conversation_id
      where search_categories.id = search_products.category_id
      and conversations.user_id = auth.uid()
    )
  );

-- ============================================================================
-- COMMENTS
-- ============================================================================
comment on column public.search_products.is_favorite
  is 'Whether this product has been saved/bookmarked by the user';

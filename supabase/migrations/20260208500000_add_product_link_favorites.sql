-- Migration: Add is_favorite to products table (image scan products)
-- Allows users to save individual products from scan results to favorites

-- ============================================================================
-- ADD is_favorite COLUMN
-- ============================================================================
alter table public.products
  add column is_favorite boolean default false not null;

-- Index for efficient favorite lookups
create index products_is_favorite_idx
  on public.products(is_favorite)
  where is_favorite = true;

-- ============================================================================
-- RLS: Allow users to update their own products (for toggling favorite)
-- Users own products through shops → products
-- ============================================================================
create policy "Users can update own products"
  on public.products for update
  using (
    exists (
      select 1 from public.shops
      where shops.id = products.shop_id
        and shops.user_id = auth.uid()
    )
  );

-- ============================================================================
-- COMMENTS
-- ============================================================================
comment on column public.products.is_favorite
  is 'Whether this product has been saved/bookmarked by the user';

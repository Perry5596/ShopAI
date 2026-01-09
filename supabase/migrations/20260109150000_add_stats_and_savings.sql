-- Migration: Add lifetime stats to profiles and savings to shops
-- This adds cumulative user stats that only go up

-- ============================================================================
-- ADD LIFETIME STATS TO PROFILES
-- ============================================================================
alter table public.profiles
  add column if not exists total_shops integer default 0,
  add column if not exists total_products integer default 0,
  add column if not exists total_savings integer default 0; -- in cents

-- ============================================================================
-- ADD SAVINGS TO SHOPS
-- ============================================================================
alter table public.shops
  add column if not exists savings integer default 0; -- in cents (average - lowest price)

-- ============================================================================
-- UPDATE EXISTING PROFILES WITH CURRENT COUNTS
-- This is a one-time update to initialize stats for existing users
-- ============================================================================
update public.profiles p
set 
  total_shops = (
    select count(*) from public.shops s 
    where s.user_id = p.id and s.status = 'completed'
  ),
  total_products = (
    select coalesce(sum(product_count), 0)
    from (
      select count(*) as product_count
      from public.products pr
      join public.shops s on s.id = pr.shop_id
      where s.user_id = p.id and s.status = 'completed'
      group by s.id
    ) counts
  );

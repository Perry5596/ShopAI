-- ============================================================================
-- Featured Stores: Curated Amazon affiliate brand showcases
-- ============================================================================

-- Featured stores table (one per featured week)
create table if not exists public.featured_stores (
  id uuid primary key default gen_random_uuid(),
  brand_name text not null,
  brand_logo_url text,
  shopping_category text not null,
  background_gradient_start text not null default '#8B7355',
  background_gradient_end text not null default '#5C4A32',
  background_image_url text,
  store_url text,
  is_active boolean not null default true,
  week_start date not null,
  created_at timestamptz not null default now()
);

-- Featured store products table
create table if not exists public.featured_store_products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.featured_stores(id) on delete cascade,
  asin text not null,
  title text not null,
  description text,
  price text,
  extracted_price numeric,
  old_price text,
  extracted_old_price numeric,
  image_url text,
  rating numeric,
  review_count integer,
  affiliate_url text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- Index for fast lookup of the active store
create index if not exists idx_featured_stores_active
  on public.featured_stores (is_active)
  where is_active = true;

-- Index for products by store
create index if not exists idx_featured_store_products_store_id
  on public.featured_store_products (store_id);

-- ============================================================================
-- RLS: Public read-only access (admin writes via service role key)
-- ============================================================================

alter table public.featured_stores enable row level security;
alter table public.featured_store_products enable row level security;

-- Anyone can read featured stores (no auth required)
create policy "Featured stores are publicly readable"
  on public.featured_stores
  for select
  using (true);

-- Anyone can read featured store products (no auth required)
create policy "Featured store products are publicly readable"
  on public.featured_store_products
  for select
  using (true);

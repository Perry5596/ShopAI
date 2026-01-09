-- Migration: Initial schema for ShopAI
-- Creates profiles, shops, products tables and storage bucket

-- ============================================================================
-- PROFILES TABLE
-- Extends auth.users with additional profile data
-- ============================================================================
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text,
  name text,
  username text unique,
  avatar_url text,
  is_premium boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS
alter table public.profiles enable row level security;

-- Policies for profiles
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Function to create profile on user signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', 'User'),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture')
  );
  return new;
end;
$$;

-- Trigger to auto-create profile on signup
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================================
-- SHOPS TABLE
-- Stores user's scanned items/shops
-- ============================================================================
create table public.shops (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  image_url text not null,
  title text not null,
  description text,
  is_favorite boolean default false,
  status text default 'processing' check (status in ('processing', 'completed', 'failed')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Create index for faster queries
create index shops_user_id_idx on public.shops(user_id);
create index shops_created_at_idx on public.shops(created_at desc);

-- Enable RLS
alter table public.shops enable row level security;

-- Policies for shops
create policy "Users can view own shops"
  on public.shops for select
  using (auth.uid() = user_id);

create policy "Users can insert own shops"
  on public.shops for insert
  with check (auth.uid() = user_id);

create policy "Users can update own shops"
  on public.shops for update
  using (auth.uid() = user_id);

create policy "Users can delete own shops"
  on public.shops for delete
  using (auth.uid() = user_id);

-- ============================================================================
-- PRODUCTS TABLE
-- Stores product links found for each shop
-- ============================================================================
create table public.products (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid references public.shops(id) on delete cascade not null,
  title text not null,
  price text not null,
  image_url text,
  affiliate_url text not null,
  source text not null,
  is_recommended boolean default false,
  rating decimal,
  review_count integer,
  created_at timestamptz default now()
);

-- Create index for faster queries
create index products_shop_id_idx on public.products(shop_id);

-- Enable RLS
alter table public.products enable row level security;

-- Policies for products (access through shop ownership)
create policy "Users can view products of own shops"
  on public.products for select
  using (
    exists (
      select 1 from public.shops
      where shops.id = products.shop_id
      and shops.user_id = auth.uid()
    )
  );

create policy "Users can insert products to own shops"
  on public.products for insert
  with check (
    exists (
      select 1 from public.shops
      where shops.id = products.shop_id
      and shops.user_id = auth.uid()
    )
  );

create policy "Users can update products of own shops"
  on public.products for update
  using (
    exists (
      select 1 from public.shops
      where shops.id = products.shop_id
      and shops.user_id = auth.uid()
    )
  );

create policy "Users can delete products of own shops"
  on public.products for delete
  using (
    exists (
      select 1 from public.shops
      where shops.id = products.shop_id
      and shops.user_id = auth.uid()
    )
  );

-- ============================================================================
-- STORAGE BUCKET
-- For storing shop images
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('shop-images', 'shop-images', true)
on conflict (id) do nothing;

-- Storage policies
create policy "Users can upload own images"
  on storage.objects for insert
  with check (
    bucket_id = 'shop-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can update own images"
  on storage.objects for update
  using (
    bucket_id = 'shop-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can delete own images"
  on storage.objects for delete
  using (
    bucket_id = 'shop-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Anyone can view shop images"
  on storage.objects for select
  using (bucket_id = 'shop-images');

-- ============================================================================
-- UPDATED_AT TRIGGER
-- Automatically updates updated_at column
-- ============================================================================
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.handle_updated_at();

create trigger shops_updated_at
  before update on public.shops
  for each row execute procedure public.handle_updated_at();

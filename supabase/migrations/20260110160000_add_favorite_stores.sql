-- Migration: Add favorite stores to profiles table
-- Adds boolean columns for each store: amazon, target, best_buy, walmart, ebay

alter table public.profiles
  add column if not exists favorite_amazon boolean default false,
  add column if not exists favorite_target boolean default false,
  add column if not exists favorite_best_buy boolean default false,
  add column if not exists favorite_walmart boolean default false,
  add column if not exists favorite_ebay boolean default false;

-- Migration: Make price column nullable
-- Google Custom Search API doesn't always return pricing information,
-- so we need to allow products without prices.

ALTER TABLE public.products 
ALTER COLUMN price DROP NOT NULL;

-- Add a comment explaining why price is nullable
COMMENT ON COLUMN public.products.price IS 'Product price as text (e.g., "$129.99"). Nullable because price data is not always available from search results.';

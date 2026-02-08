/**
 * Shared types for product search providers.
 * Each retailer provider (Amazon, Best Buy, etc.) implements these interfaces.
 */

// ============================================================================
// Request Types
// ============================================================================

export interface ProductSearchRequest {
  /** Search keywords (e.g., "whey protein powder") */
  query: string;
  /** Display label for the category (e.g., "Whey Protein") */
  categoryLabel: string;
  /** Retailer source to search */
  source: 'amazon'; // future: | 'bestbuy' | 'walmart' | 'target' | 'ebay'
  /** Optional filters */
  filters?: SearchFilters;
}

export interface SearchFilters {
  minPrice?: number;
  maxPrice?: number;
  sortBy?: 'relevance' | 'price_asc' | 'price_desc' | 'rating';
}

// ============================================================================
// Response Types
// ============================================================================

export interface ProductSearchResponse {
  /** The category label echoed back */
  categoryLabel: string;
  /** Normalized product results */
  products: SearchProduct[];
  /** Total number of results from the API */
  totalResults: number;
}

export interface SearchProduct {
  /** Product title */
  title: string;
  /** Display price (e.g., "$29.99") */
  price: string | null;
  /** Price in cents for sorting/filtering */
  priceCents: number | null;
  /** Product image URL */
  imageUrl: string | null;
  /** Affiliate URL with tracking tags */
  affiliateUrl: string;
  /** Retailer source */
  source: string;
  /** Amazon Standard Identification Number (or equivalent ID) */
  asin: string | null;
  /** Star rating (0-5) */
  rating: number | null;
  /** Number of reviews */
  reviewCount: number | null;
  /** Product brand */
  brand: string | null;
}

// ============================================================================
// Provider Interface
// ============================================================================

/**
 * Interface that all retailer search providers must implement.
 * Allows easy addition of new retailers (Best Buy, Walmart, etc.)
 */
export interface SearchProvider {
  /** Unique provider identifier */
  readonly name: string;
  /** Search for products */
  search(request: ProductSearchRequest): Promise<ProductSearchResponse>;
}

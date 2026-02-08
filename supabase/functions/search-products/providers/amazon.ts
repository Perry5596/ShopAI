/**
 * Amazon Creators API Provider
 *
 * Handles OAuth 2.0 authentication, product catalog search, and response
 * normalization for the Amazon Creators API.
 *
 * API Reference: creatorsapi.amazon/catalog/v1/...
 * Auth: OAuth 2.0 Bearer token (Credential ID + Credential Secret)
 * Token validity: 1 hour (cached for ~55 min)
 */

import type {
  SearchProvider,
  ProductSearchRequest,
  ProductSearchResponse,
  SearchProduct,
} from './types.ts';

// ============================================================================
// Token Cache
// ============================================================================

interface CachedToken {
  accessToken: string;
  expiresAt: number; // Unix timestamp in ms
}

let tokenCache: CachedToken | null = null;

/**
 * Fetch or return a cached OAuth 2.0 access token from Amazon Creators API.
 * Tokens are valid for 1 hour; we refresh 5 minutes early to avoid edge cases.
 */
async function getAccessToken(
  credentialId: string,
  credentialSecret: string
): Promise<string> {
  const now = Date.now();
  const REFRESH_BUFFER_MS = 5 * 60 * 1000; // 5 minutes

  // Return cached token if still valid
  if (tokenCache && tokenCache.expiresAt - REFRESH_BUFFER_MS > now) {
    return tokenCache.accessToken;
  }

  // Fetch a new token
  const tokenUrl = 'https://api.amazon.com/auth/o2/token';
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: credentialId,
    client_secret: credentialSecret,
    scope: 'creator:product:catalog',
  });

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Amazon OAuth token request failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const expiresInMs = (data.expires_in || 3600) * 1000;

  tokenCache = {
    accessToken: data.access_token,
    expiresAt: now + expiresInMs,
  };

  return tokenCache.accessToken;
}

// ============================================================================
// Amazon Creators API Response Types
// ============================================================================

interface AmazonCatalogResponse {
  searchResults?: AmazonCatalogItem[];
  numberOfResults?: number;
  errors?: Array<{ code: string; message: string }>;
}

interface AmazonCatalogItem {
  asin?: string;
  title?: string;
  brand?: string;
  price?: {
    amount?: number;
    currency?: string;
    displayAmount?: string;
  };
  images?: {
    primary?: {
      large?: { url: string };
      medium?: { url: string };
    };
  };
  rating?: number;
  totalReviews?: number;
  detailPageUrl?: string;
}

// ============================================================================
// Amazon Search Provider
// ============================================================================

/**
 * Map sort parameter to Amazon API sort values
 */
function mapSortBy(sortBy?: string): string | undefined {
  switch (sortBy) {
    case 'price_asc':
      return 'price:asc';
    case 'price_desc':
      return 'price:desc';
    case 'rating':
      return 'rating:desc';
    case 'relevance':
    default:
      return undefined; // Default is relevance
  }
}

/**
 * Build the affiliate URL for an Amazon product.
 * Constructs the URL using the ASIN and appends the partner tag.
 */
function buildAffiliateUrl(
  asin: string,
  detailPageUrl: string | undefined,
  partnerTag: string
): string {
  // Prefer the detail page URL from the API if available
  if (detailPageUrl) {
    try {
      const url = new URL(detailPageUrl);
      url.searchParams.set('tag', partnerTag);
      return url.toString();
    } catch {
      // Fall through to ASIN-based URL
    }
  }

  // Construct from ASIN
  return `https://www.amazon.com/dp/${asin}?tag=${partnerTag}`;
}

/**
 * Normalize an Amazon catalog item into our common SearchProduct interface.
 */
function normalizeProduct(
  item: AmazonCatalogItem,
  partnerTag: string
): SearchProduct | null {
  if (!item.asin) return null;

  const price = item.price;
  const priceCents = price?.amount != null ? Math.round(price.amount * 100) : null;
  const displayPrice = price?.displayAmount || (price?.amount != null ? `$${price.amount.toFixed(2)}` : null);

  const imageUrl =
    item.images?.primary?.large?.url ||
    item.images?.primary?.medium?.url ||
    null;

  return {
    title: item.title || 'Unknown Product',
    price: displayPrice,
    priceCents,
    imageUrl,
    affiliateUrl: buildAffiliateUrl(item.asin, item.detailPageUrl, partnerTag),
    source: 'Amazon',
    asin: item.asin,
    rating: item.rating ?? null,
    reviewCount: item.totalReviews ?? null,
    brand: item.brand ?? null,
  };
}

// ============================================================================
// Provider Implementation
// ============================================================================

export class AmazonSearchProvider implements SearchProvider {
  readonly name = 'amazon';

  private credentialId: string;
  private credentialSecret: string;
  private partnerTag: string;

  constructor() {
    const credentialId = Deno.env.get('AMAZON_CREATOR_CREDENTIAL_ID');
    const credentialSecret = Deno.env.get('AMAZON_CREATOR_CREDENTIAL_SECRET');
    const partnerTag = Deno.env.get('AMAZON_PARTNER_TAG');

    if (!credentialId || !credentialSecret) {
      throw new Error('Amazon Creators API credentials not configured');
    }

    this.credentialId = credentialId;
    this.credentialSecret = credentialSecret;
    this.partnerTag = partnerTag || 'luminasoftwar-20';
  }

  async search(request: ProductSearchRequest): Promise<ProductSearchResponse> {
    const accessToken = await getAccessToken(this.credentialId, this.credentialSecret);

    // Build query parameters
    const params = new URLSearchParams();
    params.set('keywords', request.query);
    params.set('partnerTag', this.partnerTag);
    params.set('marketplace', 'www.amazon.com');
    params.set('resources', 'images,prices,ratings');

    // Apply filters
    if (request.filters?.minPrice != null) {
      params.set('minPrice', request.filters.minPrice.toString());
    }
    if (request.filters?.maxPrice != null) {
      params.set('maxPrice', request.filters.maxPrice.toString());
    }
    const sortValue = mapSortBy(request.filters?.sortBy);
    if (sortValue) {
      params.set('sortBy', sortValue);
    }

    const apiUrl = `https://creatorsapi.amazon/catalog/v1/search?${params.toString()}`;

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Amazon Creators API error (${response.status}):`, errorText);
      throw new Error(`Amazon search failed (${response.status}): ${errorText}`);
    }

    const data: AmazonCatalogResponse = await response.json();

    if (data.errors && data.errors.length > 0) {
      console.error('Amazon API returned errors:', data.errors);
      throw new Error(`Amazon API error: ${data.errors[0].message}`);
    }

    // Normalize products
    const products: SearchProduct[] = (data.searchResults || [])
      .map((item) => normalizeProduct(item, this.partnerTag))
      .filter((p): p is SearchProduct => p !== null);

    return {
      categoryLabel: request.categoryLabel,
      products,
      totalResults: data.numberOfResults || products.length,
    };
  }
}

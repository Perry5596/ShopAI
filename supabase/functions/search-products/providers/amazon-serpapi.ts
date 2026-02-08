/**
 * Amazon Search Provider via SerpAPI (Temporary)
 *
 * Uses SerpAPI's Amazon Search engine (engine=amazon) as a stand-in while
 * waiting for official Amazon Creators API access. Produces the exact same
 * SearchProduct output so the rest of the stack is unaffected.
 *
 * Reuses the existing SERPAPI_KEY secret already configured for Google Lens.
 *
 * Swap back to the Creators API provider once qualified sales are reached
 * by changing the provider registry in index.ts.
 */

import type {
  SearchProvider,
  ProductSearchRequest,
  ProductSearchResponse,
  SearchProduct,
} from './types.ts';

// ============================================================================
// SerpAPI Amazon Response Types
// ============================================================================

interface SerpApiAmazonResponse {
  search_information?: {
    total_results?: number;
    query_displayed?: string;
  };
  organic_results?: SerpApiOrganicResult[];
  error?: string;
}

interface SerpApiOrganicResult {
  position?: number;
  asin?: string;
  title?: string;
  link?: string;
  link_clean?: string;
  thumbnail?: string;
  rating?: number;
  reviews?: number;
  price?: string;
  extracted_price?: number;
  old_price?: string;
  extracted_old_price?: number;
  brand?: string;
  bought_last_month?: string;
  sponsored?: boolean;
}

// ============================================================================
// Country → Amazon Domain & Language Mapping
// ============================================================================

/**
 * Maps ISO 3166-1 alpha-2 country codes to Amazon marketplace domains.
 * Countries not listed fall back to 'amazon.com'.
 */
const COUNTRY_TO_AMAZON_DOMAIN: Record<string, string> = {
  US: 'amazon.com',
  CA: 'amazon.ca',
  GB: 'amazon.co.uk',
  DE: 'amazon.de',
  FR: 'amazon.fr',
  ES: 'amazon.es',
  IT: 'amazon.it',
  NL: 'amazon.nl',
  SE: 'amazon.se',
  PL: 'amazon.pl',
  BE: 'amazon.com.be',
  AU: 'amazon.com.au',
  JP: 'amazon.co.jp',
  IN: 'amazon.in',
  SG: 'amazon.sg',
  AE: 'amazon.ae',
  SA: 'amazon.sa',
  TR: 'amazon.com.tr',
  BR: 'amazon.com.br',
  MX: 'amazon.com.mx',
  EG: 'amazon.eg',
};

/**
 * Maps ISO 3166-1 alpha-2 country codes to SerpAPI language codes.
 * Countries not listed fall back to 'en_US'.
 */
const COUNTRY_TO_LANGUAGE: Record<string, string> = {
  US: 'en_US',
  CA: 'en_CA',
  GB: 'en_GB',
  DE: 'de_DE',
  FR: 'fr_FR',
  ES: 'es_ES',
  IT: 'it_IT',
  NL: 'nl_NL',
  SE: 'sv_SE',
  PL: 'pl_PL',
  BE: 'nl_BE',
  AU: 'en_AU',
  JP: 'ja_JP',
  IN: 'en_IN',
  SG: 'en_SG',
  AE: 'en_AE',
  SA: 'ar_SA',
  TR: 'tr_TR',
  BR: 'pt_BR',
  MX: 'es_MX',
  EG: 'ar_EG',
};

function getAmazonDomain(country?: string): string {
  if (!country) return 'amazon.com';
  return COUNTRY_TO_AMAZON_DOMAIN[country.toUpperCase()] || 'amazon.com';
}

function getAmazonLanguage(country?: string): string {
  if (!country) return 'en_US';
  return COUNTRY_TO_LANGUAGE[country.toUpperCase()] || 'en_US';
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Map our sort parameter to SerpAPI's Amazon sort values.
 */
function mapSortBy(sortBy?: string): string | undefined {
  switch (sortBy) {
    case 'price_asc':
      return 'price-asc-rank';
    case 'price_desc':
      return 'price-desc-rank';
    case 'rating':
      return 'review-rank';
    case 'relevance':
    default:
      return undefined; // Default sort is relevance
  }
}

/**
 * Build an affiliate URL from the ASIN and partner tag.
 * Prefer the clean link from SerpAPI if available.
 * Uses the correct Amazon domain for the user's country.
 */
function buildAffiliateUrl(
  asin: string,
  linkClean: string | undefined,
  partnerTag: string,
  amazonDomain: string = 'amazon.com'
): string {
  if (linkClean) {
    try {
      const url = new URL(linkClean);
      url.searchParams.set('tag', partnerTag);
      return url.toString();
    } catch {
      // Fall through
    }
  }
  return `https://www.${amazonDomain}/dp/${asin}?tag=${partnerTag}`;
}

/**
 * Normalize a SerpAPI organic result into our common SearchProduct interface.
 */
function normalizeResult(
  item: SerpApiOrganicResult,
  partnerTag: string,
  amazonDomain: string = 'amazon.com'
): SearchProduct | null {
  if (!item.asin) return null;

  const priceCents =
    item.extracted_price != null
      ? Math.round(item.extracted_price * 100)
      : null;

  return {
    title: item.title || 'Unknown Product',
    price: item.price || (item.extracted_price != null ? `$${item.extracted_price.toFixed(2)}` : null),
    priceCents,
    imageUrl: item.thumbnail || null,
    affiliateUrl: buildAffiliateUrl(item.asin, item.link_clean, partnerTag, amazonDomain),
    source: 'Amazon',
    asin: item.asin,
    rating: item.rating ?? null,
    reviewCount: item.reviews ?? null,
    brand: item.brand ?? null,
  };
}

// ============================================================================
// Provider Implementation
// ============================================================================

export class AmazonSerpApiProvider implements SearchProvider {
  readonly name = 'amazon-serpapi';

  private apiKey: string;
  private partnerTag: string;

  constructor() {
    const apiKey = Deno.env.get('SERPAPI_KEY');
    if (!apiKey) {
      throw new Error('SERPAPI_KEY is not configured');
    }

    this.apiKey = apiKey;
    this.partnerTag = Deno.env.get('AMAZON_PARTNER_TAG') || 'luminasoftwar-20';
  }

  async search(request: ProductSearchRequest): Promise<ProductSearchResponse> {
    // Resolve Amazon domain and language from the user's country
    const amazonDomain = getAmazonDomain(request.country);
    const amazonLanguage = getAmazonLanguage(request.country);

    // Build SerpAPI query parameters
    const params = new URLSearchParams();
    params.set('engine', 'amazon');
    params.set('k', request.query);
    params.set('amazon_domain', amazonDomain);
    params.set('language', amazonLanguage);
    params.set('api_key', this.apiKey);

    // Only return organic results for a smaller, faster response
    params.set('json_restrictor', 'organic_results,search_information');

    // Sort
    const sortValue = mapSortBy(request.filters?.sortBy);
    if (sortValue) {
      params.set('s', sortValue);
    }

    const apiUrl = `https://serpapi.com/search?${params.toString()}`;

    const response = await fetch(apiUrl);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`SerpAPI Amazon error (${response.status}):`, errorText);
      throw new Error(`Amazon search via SerpAPI failed (${response.status}): ${errorText}`);
    }

    const data: SerpApiAmazonResponse = await response.json();

    if (data.error) {
      throw new Error(`SerpAPI error: ${data.error}`);
    }

    // Normalize results, skip sponsored items for cleaner results
    let products: SearchProduct[] = (data.organic_results || [])
      .filter((item) => !item.sponsored)
      .map((item) => normalizeResult(item, this.partnerTag, amazonDomain))
      .filter((p): p is SearchProduct => p !== null);

    // Client-side price filtering (SerpAPI doesn't support min/max natively)
    if (request.filters?.minPrice != null) {
      const minCents = Math.round(request.filters.minPrice * 100);
      products = products.filter(
        (p) => p.priceCents == null || p.priceCents >= minCents
      );
    }
    if (request.filters?.maxPrice != null) {
      const maxCents = Math.round(request.filters.maxPrice * 100);
      products = products.filter(
        (p) => p.priceCents == null || p.priceCents <= maxCents
      );
    }

    return {
      categoryLabel: request.categoryLabel,
      products,
      totalResults: data.search_information?.total_results || products.length,
    };
  }
}

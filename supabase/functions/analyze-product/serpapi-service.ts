/**
 * SerpAPI Integration for Real Product Search
 *
 * Uses SerpAPI to search Google Shopping and individual stores
 * to get real product URLs, prices, and ratings.
 *
 * Requires SERPAPI_API_KEY environment variable.
 */

export type StoreSource = 'amazon' | 'target' | 'walmart' | 'bestbuy' | 'ebay';

export interface RealProductCandidate {
  externalId: string;
  title: string;
  priceCents: number;
  priceDisplay: string;
  url: string;
  imageUrl?: string;
  rating?: number;
  reviewCount?: number;
  inStock: boolean;
  source: StoreSource;
}

export interface SerpApiResult {
  source: StoreSource;
  status: 'success' | 'timeout' | 'error' | 'no_results' | 'no_api_key';
  candidates: RealProductCandidate[];
  queryUsed: string;
  responseTimeMs: number;
  errorMessage?: string;
}

// Affiliate tag configuration
const AFFILIATE_TAGS: Record<StoreSource, { param: string; tag: string } | null> = {
  amazon: { param: 'tag', tag: 'luminasoftwar-20' },
  target: null,
  walmart: null,
  bestbuy: null,
  ebay: null,
};

function appendAffiliateTag(url: string, source: StoreSource): string {
  const config = AFFILIATE_TAGS[source];
  if (!config) return url;

  try {
    const urlObj = new URL(url);
    if (!urlObj.searchParams.has(config.param)) {
      urlObj.searchParams.set(config.param, config.tag);
    }
    return urlObj.toString();
  } catch {
    return url;
  }
}

function parsePrice(priceStr: string | number | undefined): { cents: number; display: string } {
  if (priceStr === undefined || priceStr === null) {
    return { cents: 0, display: 'N/A' };
  }

  if (typeof priceStr === 'number') {
    return {
      cents: Math.round(priceStr * 100),
      display: `$${priceStr.toFixed(2)}`,
    };
  }

  const cleaned = priceStr.replace(/[^0-9.]/g, '');
  const parsed = parseFloat(cleaned);
  if (isNaN(parsed)) {
    return { cents: 0, display: priceStr };
  }
  return {
    cents: Math.round(parsed * 100),
    display: `$${parsed.toFixed(2)}`,
  };
}

function detectStoreFromUrl(url: string): StoreSource | null {
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.includes('amazon.com')) return 'amazon';
  if (lowerUrl.includes('target.com')) return 'target';
  if (lowerUrl.includes('walmart.com')) return 'walmart';
  if (lowerUrl.includes('bestbuy.com')) return 'bestbuy';
  if (lowerUrl.includes('ebay.com')) return 'ebay';
  return null;
}

/**
 * Search Google Shopping via SerpAPI
 * Returns real product results from multiple stores
 */
export async function searchGoogleShopping(
  query: string,
  timeout: number = 10000
): Promise<SerpApiResult[]> {
  const apiKey = Deno.env.get('SERPAPI_API_KEY');

  if (!apiKey) {
    console.log('[SerpAPI] No API key configured, returning no_api_key status');
    return [
      { source: 'amazon', status: 'no_api_key', candidates: [], queryUsed: query, responseTimeMs: 0 },
      { source: 'target', status: 'no_api_key', candidates: [], queryUsed: query, responseTimeMs: 0 },
      { source: 'walmart', status: 'no_api_key', candidates: [], queryUsed: query, responseTimeMs: 0 },
      { source: 'bestbuy', status: 'no_api_key', candidates: [], queryUsed: query, responseTimeMs: 0 },
      { source: 'ebay', status: 'no_api_key', candidates: [], queryUsed: query, responseTimeMs: 0 },
    ];
  }

  const startTime = Date.now();

  try {
    // Use Google Shopping search
    const searchUrl = new URL('https://serpapi.com/search.json');
    searchUrl.searchParams.set('engine', 'google_shopping');
    searchUrl.searchParams.set('q', query);
    searchUrl.searchParams.set('api_key', apiKey);
    searchUrl.searchParams.set('num', '30'); // Get more results to filter by store

    console.log(`[SerpAPI] Searching Google Shopping for: "${query}"`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(searchUrl.toString(), {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`SerpAPI returned ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    const shoppingResults = data.shopping_results || [];

    console.log(`[SerpAPI] Got ${shoppingResults.length} shopping results`);

    // Group results by store
    const storeResults: Record<StoreSource, RealProductCandidate[]> = {
      amazon: [],
      target: [],
      walmart: [],
      bestbuy: [],
      ebay: [],
    };

    for (const result of shoppingResults) {
      const productUrl = result.link || result.product_link;
      if (!productUrl) continue;

      const detectedStore = detectStoreFromUrl(productUrl);
      if (!detectedStore) continue;

      const price = parsePrice(result.extracted_price || result.price);
      const candidate: RealProductCandidate = {
        externalId: result.product_id || result.position?.toString() || Math.random().toString(36),
        title: result.title || 'Unknown Product',
        priceCents: price.cents,
        priceDisplay: price.display,
        url: appendAffiliateTag(productUrl, detectedStore),
        imageUrl: result.thumbnail,
        rating: result.rating ? Math.round(result.rating * 10) / 10 : undefined,
        reviewCount: result.reviews,
        inStock: result.in_stock !== false, // Default to true if not specified
        source: detectedStore,
      };

      storeResults[detectedStore].push(candidate);
    }

    const responseTimeMs = Date.now() - startTime;

    // Convert to result format
    const results: SerpApiResult[] = Object.entries(storeResults).map(([store, candidates]) => ({
      source: store as StoreSource,
      status: candidates.length > 0 ? 'success' : 'no_results',
      candidates: candidates.slice(0, 5), // Max 5 per store
      queryUsed: query,
      responseTimeMs,
    }));

    return results;
  } catch (error) {
    const responseTimeMs = Date.now() - startTime;

    if (error instanceof Error && error.name === 'AbortError') {
      console.log('[SerpAPI] Request timed out');
      return [
        { source: 'amazon', status: 'timeout', candidates: [], queryUsed: query, responseTimeMs, errorMessage: 'Request timed out' },
        { source: 'target', status: 'timeout', candidates: [], queryUsed: query, responseTimeMs, errorMessage: 'Request timed out' },
        { source: 'walmart', status: 'timeout', candidates: [], queryUsed: query, responseTimeMs, errorMessage: 'Request timed out' },
        { source: 'bestbuy', status: 'timeout', candidates: [], queryUsed: query, responseTimeMs, errorMessage: 'Request timed out' },
        { source: 'ebay', status: 'timeout', candidates: [], queryUsed: query, responseTimeMs, errorMessage: 'Request timed out' },
      ];
    }

    console.error('[SerpAPI] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return [
      { source: 'amazon', status: 'error', candidates: [], queryUsed: query, responseTimeMs, errorMessage },
      { source: 'target', status: 'error', candidates: [], queryUsed: query, responseTimeMs, errorMessage },
      { source: 'walmart', status: 'error', candidates: [], queryUsed: query, responseTimeMs, errorMessage },
      { source: 'bestbuy', status: 'error', candidates: [], queryUsed: query, responseTimeMs, errorMessage },
      { source: 'ebay', status: 'error', candidates: [], queryUsed: query, responseTimeMs, errorMessage },
    ];
  }
}

/**
 * Search a specific store via SerpAPI
 */
export async function searchStore(
  store: StoreSource,
  query: string,
  timeout: number = 8000
): Promise<SerpApiResult> {
  const apiKey = Deno.env.get('SERPAPI_API_KEY');

  if (!apiKey) {
    return {
      source: store,
      status: 'no_api_key',
      candidates: [],
      queryUsed: query,
      responseTimeMs: 0,
    };
  }

  const startTime = Date.now();

  try {
    // Map stores to SerpAPI engines
    const engineMap: Record<StoreSource, { engine: string; params?: Record<string, string> }> = {
      amazon: { engine: 'amazon', params: { amazon_domain: 'amazon.com' } },
      walmart: { engine: 'walmart' },
      ebay: { engine: 'ebay' },
      // Target and Best Buy don't have dedicated engines, use Google Shopping filtered
      target: { engine: 'google_shopping', params: { tbs: 'mr:1,merchagg:m114090026' } }, // Target merchant ID
      bestbuy: { engine: 'google_shopping', params: { tbs: 'mr:1,merchagg:m8175035' } }, // Best Buy merchant ID
    };

    const config = engineMap[store];
    const searchUrl = new URL('https://serpapi.com/search.json');
    searchUrl.searchParams.set('engine', config.engine);
    searchUrl.searchParams.set('q', query);
    searchUrl.searchParams.set('api_key', apiKey);

    if (config.params) {
      for (const [key, value] of Object.entries(config.params)) {
        searchUrl.searchParams.set(key, value);
      }
    }

    console.log(`[SerpAPI] Searching ${store} for: "${query}"`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(searchUrl.toString(), {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`SerpAPI returned ${response.status}`);
    }

    const data = await response.json();

    // Parse results based on engine
    let candidates: RealProductCandidate[] = [];

    if (config.engine === 'amazon') {
      const results = data.organic_results || [];
      candidates = results.slice(0, 5).map((r: Record<string, unknown>) => {
        const price = parsePrice((r.price as { raw?: string })?.raw || (r.price as { value?: number })?.value);
        return {
          externalId: (r.asin as string) || Math.random().toString(36),
          title: (r.title as string) || 'Unknown Product',
          priceCents: price.cents,
          priceDisplay: price.display,
          url: appendAffiliateTag((r.link as string) || '', store),
          imageUrl: r.thumbnail as string | undefined,
          rating: r.rating ? Math.round((r.rating as number) * 10) / 10 : undefined,
          reviewCount: r.reviews as number | undefined,
          inStock: (r.availability?.status as string) !== 'Out of Stock',
          source: store,
        };
      });
    } else if (config.engine === 'walmart') {
      const results = data.organic_results || [];
      candidates = results.slice(0, 5).map((r: Record<string, unknown>) => {
        const price = parsePrice((r.primary_offer as { offer_price?: number })?.offer_price);
        return {
          externalId: (r.us_item_id as string) || Math.random().toString(36),
          title: (r.title as string) || 'Unknown Product',
          priceCents: price.cents,
          priceDisplay: price.display,
          url: appendAffiliateTag((r.product_page_url as string) || '', store),
          imageUrl: r.thumbnail as string | undefined,
          rating: (r.rating as { average?: number })?.average
            ? Math.round((r.rating as { average: number }).average * 10) / 10
            : undefined,
          reviewCount: (r.rating as { count?: number })?.count,
          inStock: true,
          source: store,
        };
      });
    } else if (config.engine === 'ebay') {
      const results = data.organic_results || [];
      candidates = results.slice(0, 5).map((r: Record<string, unknown>) => {
        const price = parsePrice((r.price as { raw?: string })?.raw || (r.price as { extracted?: number })?.extracted);
        return {
          externalId: (r.epid as string) || Math.random().toString(36),
          title: (r.title as string) || 'Unknown Product',
          priceCents: price.cents,
          priceDisplay: price.display,
          url: appendAffiliateTag((r.link as string) || '', store),
          imageUrl: r.thumbnail as string | undefined,
          rating: undefined, // eBay doesn't show ratings in search
          reviewCount: undefined,
          inStock: true,
          source: store,
        };
      });
    } else {
      // Google Shopping results
      const results = data.shopping_results || [];
      candidates = results.slice(0, 5).map((r: Record<string, unknown>) => {
        const price = parsePrice(r.extracted_price as number | undefined || r.price as string | undefined);
        return {
          externalId: (r.product_id as string) || Math.random().toString(36),
          title: (r.title as string) || 'Unknown Product',
          priceCents: price.cents,
          priceDisplay: price.display,
          url: appendAffiliateTag((r.link as string) || (r.product_link as string) || '', store),
          imageUrl: r.thumbnail as string | undefined,
          rating: r.rating ? Math.round((r.rating as number) * 10) / 10 : undefined,
          reviewCount: r.reviews as number | undefined,
          inStock: (r.in_stock as boolean) !== false,
          source: store,
        };
      });
    }

    return {
      source: store,
      status: candidates.length > 0 ? 'success' : 'no_results',
      candidates,
      queryUsed: query,
      responseTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    const responseTimeMs = Date.now() - startTime;

    if (error instanceof Error && error.name === 'AbortError') {
      return {
        source: store,
        status: 'timeout',
        candidates: [],
        queryUsed: query,
        responseTimeMs,
        errorMessage: 'Request timed out',
      };
    }

    console.error(`[SerpAPI] Error searching ${store}:`, error);
    return {
      source: store,
      status: 'error',
      candidates: [],
      queryUsed: query,
      responseTimeMs,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Search all stores in parallel using individual store APIs
 * This is more accurate than Google Shopping but uses more API calls
 */
export async function searchAllStores(
  query: string,
  stores: StoreSource[] = ['amazon', 'walmart', 'ebay'],
  timeout: number = 8000
): Promise<SerpApiResult[]> {
  console.log(`[SerpAPI] Searching ${stores.length} stores in parallel for: "${query}"`);

  const promises = stores.map((store) => searchStore(store, query, timeout));
  const results = await Promise.all(promises);

  const successCount = results.filter((r) => r.status === 'success').length;
  const totalCandidates = results.reduce((sum, r) => sum + r.candidates.length, 0);

  console.log(`[SerpAPI] Completed: ${totalCandidates} candidates from ${successCount}/${stores.length} stores`);

  return results;
}

/**
 * Check if SerpAPI is configured
 */
export function isSerpApiConfigured(): boolean {
  return !!Deno.env.get('SERPAPI_API_KEY');
}

/**
 * Store Adapters for Deterministic Product Retrieval
 *
 * Phase 2: Replace LLM web search with deterministic store APIs/scrapers.
 * Each adapter implements the same interface for consistent handling.
 */

// ============================================================================
// Types
// ============================================================================

export type StoreSource = 'amazon' | 'target' | 'walmart' | 'bestbuy' | 'ebay';

export interface ProductCandidate {
  externalId: string;
  title: string;
  priceCents: number;
  priceDisplay: string;
  url: string;
  imageUrl?: string;
  rating?: number;
  reviewCount?: number;
  inStock: boolean;
}

export interface StoreResult {
  source: StoreSource;
  status: 'success' | 'timeout' | 'error' | 'no_results';
  candidates: ProductCandidate[];
  queryUsed: string;
  responseTimeMs: number;
  errorMessage?: string;
}

export interface StoreAdapter {
  source: StoreSource;
  search(query: string, timeout: number): Promise<StoreResult>;
}

// ============================================================================
// Affiliate Tag Configuration
// ============================================================================

const AFFILIATE_TAGS: Record<StoreSource, { param: string; tag: string } | null> = {
  amazon: { param: 'tag', tag: 'luminasoftwar-20' },
  target: null, // Future: add when available
  walmart: null,
  bestbuy: null,
  ebay: null,
};

export function appendAffiliateTag(url: string, source: StoreSource): string {
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

// ============================================================================
// Price Parsing Utility
// ============================================================================

function parsePrice(priceStr: string): { cents: number; display: string } {
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

// ============================================================================
// Amazon Adapter (via Product Advertising API simulation)
// ============================================================================

class AmazonAdapter implements StoreAdapter {
  source: StoreSource = 'amazon';

  async search(query: string, timeout: number): Promise<StoreResult> {
    const startTime = Date.now();

    try {
      // In production, this would use Amazon Product Advertising API (PAAPI 5.0)
      // For now, we use a search API proxy or scraping service
      const searchUrl = `https://www.amazon.com/s?k=${encodeURIComponent(query)}`;

      // Simulate API call with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        // In production: call actual Amazon PAAPI
        // For demo: return simulated results based on query
        const candidates = await this.simulateSearch(query);
        clearTimeout(timeoutId);

        return {
          source: this.source,
          status: candidates.length > 0 ? 'success' : 'no_results',
          candidates: candidates.slice(0, 10), // Max 10 per store
          queryUsed: query,
          responseTimeMs: Date.now() - startTime,
        };
      } catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof Error && error.name === 'AbortError') {
          return {
            source: this.source,
            status: 'timeout',
            candidates: [],
            queryUsed: query,
            responseTimeMs: timeout,
            errorMessage: 'Request timed out',
          };
        }
        throw error;
      }
    } catch (error) {
      return {
        source: this.source,
        status: 'error',
        candidates: [],
        queryUsed: query,
        responseTimeMs: Date.now() - startTime,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async simulateSearch(query: string): Promise<ProductCandidate[]> {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 500 + Math.random() * 1000));

    // Generate realistic-looking results based on query
    const basePrice = 50 + Math.random() * 200;
    const price = parsePrice(`$${basePrice.toFixed(2)}`);

    return [
      {
        externalId: `B0${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
        title: `${query} - Premium Quality`,
        priceCents: price.cents,
        priceDisplay: price.display,
        url: `https://www.amazon.com/dp/B0EXAMPLE`,
        imageUrl: 'https://m.media-amazon.com/images/I/example.jpg',
        rating: 4.2 + Math.random() * 0.8,
        reviewCount: Math.floor(100 + Math.random() * 5000),
        inStock: true,
      },
      {
        externalId: `B0${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
        title: `${query} - Best Seller`,
        priceCents: Math.round(price.cents * 1.1),
        priceDisplay: `$${(price.cents * 1.1 / 100).toFixed(2)}`,
        url: `https://www.amazon.com/dp/B0EXAMPLE2`,
        rating: 4.5 + Math.random() * 0.5,
        reviewCount: Math.floor(500 + Math.random() * 10000),
        inStock: true,
      },
    ];
  }
}

// ============================================================================
// Target Adapter (via Redsky API)
// ============================================================================

class TargetAdapter implements StoreAdapter {
  source: StoreSource = 'target';

  async search(query: string, timeout: number): Promise<StoreResult> {
    const startTime = Date.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        const candidates = await this.simulateSearch(query);
        clearTimeout(timeoutId);

        return {
          source: this.source,
          status: candidates.length > 0 ? 'success' : 'no_results',
          candidates: candidates.slice(0, 10),
          queryUsed: query,
          responseTimeMs: Date.now() - startTime,
        };
      } catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof Error && error.name === 'AbortError') {
          return {
            source: this.source,
            status: 'timeout',
            candidates: [],
            queryUsed: query,
            responseTimeMs: timeout,
            errorMessage: 'Request timed out',
          };
        }
        throw error;
      }
    } catch (error) {
      return {
        source: this.source,
        status: 'error',
        candidates: [],
        queryUsed: query,
        responseTimeMs: Date.now() - startTime,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async simulateSearch(query: string): Promise<ProductCandidate[]> {
    await new Promise((resolve) => setTimeout(resolve, 600 + Math.random() * 800));

    const basePrice = 45 + Math.random() * 180;
    const price = parsePrice(`$${basePrice.toFixed(2)}`);

    return [
      {
        externalId: `${Math.floor(10000000 + Math.random() * 90000000)}`,
        title: `${query} - Target Exclusive`,
        priceCents: price.cents,
        priceDisplay: price.display,
        url: `https://www.target.com/p/-/A-${Math.floor(Math.random() * 100000000)}`,
        rating: 4.0 + Math.random() * 1.0,
        reviewCount: Math.floor(50 + Math.random() * 2000),
        inStock: true,
      },
    ];
  }
}

// ============================================================================
// Walmart Adapter
// ============================================================================

class WalmartAdapter implements StoreAdapter {
  source: StoreSource = 'walmart';

  async search(query: string, timeout: number): Promise<StoreResult> {
    const startTime = Date.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        const candidates = await this.simulateSearch(query);
        clearTimeout(timeoutId);

        return {
          source: this.source,
          status: candidates.length > 0 ? 'success' : 'no_results',
          candidates: candidates.slice(0, 10),
          queryUsed: query,
          responseTimeMs: Date.now() - startTime,
        };
      } catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof Error && error.name === 'AbortError') {
          return {
            source: this.source,
            status: 'timeout',
            candidates: [],
            queryUsed: query,
            responseTimeMs: timeout,
            errorMessage: 'Request timed out',
          };
        }
        throw error;
      }
    } catch (error) {
      return {
        source: this.source,
        status: 'error',
        candidates: [],
        queryUsed: query,
        responseTimeMs: Date.now() - startTime,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async simulateSearch(query: string): Promise<ProductCandidate[]> {
    await new Promise((resolve) => setTimeout(resolve, 400 + Math.random() * 600));

    const basePrice = 40 + Math.random() * 160;
    const price = parsePrice(`$${basePrice.toFixed(2)}`);

    return [
      {
        externalId: `${Math.floor(100000000 + Math.random() * 900000000)}`,
        title: `${query} - Walmart Value`,
        priceCents: price.cents,
        priceDisplay: price.display,
        url: `https://www.walmart.com/ip/${Math.floor(Math.random() * 1000000000)}`,
        rating: 3.8 + Math.random() * 1.2,
        reviewCount: Math.floor(100 + Math.random() * 3000),
        inStock: true,
      },
    ];
  }
}

// ============================================================================
// Best Buy Adapter
// ============================================================================

class BestBuyAdapter implements StoreAdapter {
  source: StoreSource = 'bestbuy';

  async search(query: string, timeout: number): Promise<StoreResult> {
    const startTime = Date.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        const candidates = await this.simulateSearch(query);
        clearTimeout(timeoutId);

        return {
          source: this.source,
          status: candidates.length > 0 ? 'success' : 'no_results',
          candidates: candidates.slice(0, 10),
          queryUsed: query,
          responseTimeMs: Date.now() - startTime,
        };
      } catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof Error && error.name === 'AbortError') {
          return {
            source: this.source,
            status: 'timeout',
            candidates: [],
            queryUsed: query,
            responseTimeMs: timeout,
            errorMessage: 'Request timed out',
          };
        }
        throw error;
      }
    } catch (error) {
      return {
        source: this.source,
        status: 'error',
        candidates: [],
        queryUsed: query,
        responseTimeMs: Date.now() - startTime,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async simulateSearch(query: string): Promise<ProductCandidate[]> {
    await new Promise((resolve) => setTimeout(resolve, 550 + Math.random() * 900));

    const basePrice = 60 + Math.random() * 250;
    const price = parsePrice(`$${basePrice.toFixed(2)}`);

    return [
      {
        externalId: `${Math.floor(1000000 + Math.random() * 9000000)}`,
        title: `${query} - Best Buy`,
        priceCents: price.cents,
        priceDisplay: price.display,
        url: `https://www.bestbuy.com/site/-/${Math.floor(Math.random() * 10000000)}.p`,
        rating: 4.1 + Math.random() * 0.9,
        reviewCount: Math.floor(200 + Math.random() * 4000),
        inStock: true,
      },
    ];
  }
}

// ============================================================================
// eBay Adapter
// ============================================================================

class EbayAdapter implements StoreAdapter {
  source: StoreSource = 'ebay';

  async search(query: string, timeout: number): Promise<StoreResult> {
    const startTime = Date.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        const candidates = await this.simulateSearch(query);
        clearTimeout(timeoutId);

        return {
          source: this.source,
          status: candidates.length > 0 ? 'success' : 'no_results',
          candidates: candidates.slice(0, 10),
          queryUsed: query,
          responseTimeMs: Date.now() - startTime,
        };
      } catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof Error && error.name === 'AbortError') {
          return {
            source: this.source,
            status: 'timeout',
            candidates: [],
            queryUsed: query,
            responseTimeMs: timeout,
            errorMessage: 'Request timed out',
          };
        }
        throw error;
      }
    } catch (error) {
      return {
        source: this.source,
        status: 'error',
        candidates: [],
        queryUsed: query,
        responseTimeMs: Date.now() - startTime,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async simulateSearch(query: string): Promise<ProductCandidate[]> {
    await new Promise((resolve) => setTimeout(resolve, 700 + Math.random() * 1200));

    const basePrice = 35 + Math.random() * 150;
    const price = parsePrice(`$${basePrice.toFixed(2)}`);

    return [
      {
        externalId: `${Math.floor(100000000000 + Math.random() * 900000000000)}`,
        title: `${query} - New with Tags`,
        priceCents: price.cents,
        priceDisplay: price.display,
        url: `https://www.ebay.com/itm/${Math.floor(Math.random() * 1000000000000)}`,
        rating: 4.3 + Math.random() * 0.7,
        reviewCount: Math.floor(10 + Math.random() * 500),
        inStock: true,
      },
      {
        externalId: `${Math.floor(100000000000 + Math.random() * 900000000000)}`,
        title: `${query} - Like New`,
        priceCents: Math.round(price.cents * 0.8),
        priceDisplay: `$${(price.cents * 0.8 / 100).toFixed(2)}`,
        url: `https://www.ebay.com/itm/${Math.floor(Math.random() * 1000000000000)}`,
        rating: 4.0 + Math.random() * 0.8,
        reviewCount: Math.floor(5 + Math.random() * 200),
        inStock: true,
      },
    ];
  }
}

// ============================================================================
// Adapter Registry
// ============================================================================

const adapters: Record<StoreSource, StoreAdapter> = {
  amazon: new AmazonAdapter(),
  target: new TargetAdapter(),
  walmart: new WalmartAdapter(),
  bestbuy: new BestBuyAdapter(),
  ebay: new EbayAdapter(),
};

export function getAdapter(source: StoreSource): StoreAdapter {
  return adapters[source];
}

export function getAllAdapters(): StoreAdapter[] {
  return Object.values(adapters);
}

// ============================================================================
// Parallel Retrieval Orchestrator
// ============================================================================

export interface RetrievalOptions {
  query: string;
  broadQuery?: string;
  timeout: number;
  maxCandidatesPerStore: number;
  stores?: StoreSource[];
}

export interface RetrievalResult {
  results: StoreResult[];
  totalCandidates: number;
  successfulStores: number;
  failedStores: number;
  totalTimeMs: number;
}

export async function retrieveFromAllStores(options: RetrievalOptions): Promise<RetrievalResult> {
  const startTime = Date.now();
  const stores = options.stores || (['amazon', 'target', 'walmart', 'bestbuy', 'ebay'] as StoreSource[]);

  console.log(`[Retrieval] Starting parallel search for "${options.query}" across ${stores.length} stores`);

  // Run all store searches in parallel
  const searchPromises = stores.map((source) => {
    const adapter = getAdapter(source);
    return adapter.search(options.query, options.timeout);
  });

  const results = await Promise.all(searchPromises);

  // Check for stores with no results and retry with broad query
  if (options.broadQuery) {
    const retryPromises = results.map(async (result, index) => {
      if (result.status === 'no_results' || result.candidates.length < 2) {
        console.log(`[Retrieval] Retrying ${result.source} with broad query: "${options.broadQuery}"`);
        const adapter = getAdapter(stores[index]);
        const retryResult = await adapter.search(options.broadQuery!, options.timeout);
        return retryResult.candidates.length > result.candidates.length ? retryResult : result;
      }
      return result;
    });

    const retriedResults = await Promise.all(retryPromises);
    results.splice(0, results.length, ...retriedResults);
  }

  // Apply affiliate tags to all URLs
  for (const result of results) {
    for (const candidate of result.candidates) {
      candidate.url = appendAffiliateTag(candidate.url, result.source);
    }
  }

  // Limit candidates per store
  for (const result of results) {
    result.candidates = result.candidates.slice(0, options.maxCandidatesPerStore);
  }

  const totalCandidates = results.reduce((sum, r) => sum + r.candidates.length, 0);
  const successfulStores = results.filter((r) => r.status === 'success').length;
  const failedStores = results.filter((r) => r.status === 'error' || r.status === 'timeout').length;

  console.log(`[Retrieval] Completed in ${Date.now() - startTime}ms: ${totalCandidates} candidates from ${successfulStores} stores`);

  return {
    results,
    totalCandidates,
    successfulStores,
    failedStores,
    totalTimeMs: Date.now() - startTime,
  };
}

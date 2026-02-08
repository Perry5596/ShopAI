/**
 * search-products Edge Function
 *
 * Standalone product search endpoint. Called by the agent-search orchestrator
 * (or directly) to search for products on a specific retailer.
 *
 * Designed with a provider pattern for future multi-retailer support.
 * V1: Amazon via SerpAPI (temporary) — swap to Creators API once qualified.
 *
 * Request body:
 *   { query, categoryLabel, source, filters? }
 *
 * Response:
 *   { categoryLabel, products[], totalResults }
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import {
  resolveAuth,
  corsHeaders,
  jsonResponse,
  errorResponse,
} from '../_shared/auth.ts';
// Active provider: SerpAPI (temporary, until Amazon Creators API access is granted)
import { AmazonSerpApiProvider } from './providers/amazon-serpapi.ts';
// Future provider: Amazon Creators API (uncomment and swap once qualified)
// import { AmazonSearchProvider } from './providers/amazon.ts';
import type { ProductSearchRequest, SearchProvider } from './providers/types.ts';

// ============================================================================
// Provider Registry
// ============================================================================

const providers: Record<string, () => SearchProvider> = {
  // Active: SerpAPI-based Amazon search (uses existing SERPAPI_KEY)
  amazon: () => new AmazonSerpApiProvider(),
  // Future: swap to Creators API once you have access:
  // amazon: () => new AmazonSearchProvider(),
};

/**
 * Get a search provider by name.
 * Lazy-instantiated so credentials are only checked when needed.
 */
function getProvider(source: string): SearchProvider {
  const factory = providers[source];
  if (!factory) {
    throw new Error(`Unsupported search source: ${source}. Supported: ${Object.keys(providers).join(', ')}`);
  }
  return factory();
}

// ============================================================================
// Main Handler
// ============================================================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // =========================================================================
    // Step 1: Authenticate the request
    // =========================================================================
    try {
      await resolveAuth(req);
    } catch (error) {
      console.log('Authentication failed:', error);
      return errorResponse(
        'Authentication required',
        401,
        {
          code: 'auth_required',
          message: 'Please sign in or register as a guest to use this feature.',
        }
      );
    }

    // =========================================================================
    // Step 2: Parse and validate request body
    // =========================================================================
    const body = await req.json();
    const { query, categoryLabel, source, filters, country } = body as ProductSearchRequest & { country?: string };

    if (!query || typeof query !== 'string') {
      return errorResponse('query is required and must be a string', 400);
    }
    if (!categoryLabel || typeof categoryLabel !== 'string') {
      return errorResponse('categoryLabel is required and must be a string', 400);
    }

    const searchSource = source || 'amazon';

    // =========================================================================
    // Step 3: Execute product search via provider
    // =========================================================================
    const provider = getProvider(searchSource);

    const request: ProductSearchRequest = {
      query,
      categoryLabel,
      source: searchSource,
      filters,
      country: country || undefined,
    };

    const result = await provider.search(request);

    // =========================================================================
    // Step 4: Return results
    // =========================================================================
    return jsonResponse(result);
  } catch (error) {
    console.error('Error in search-products:', error);
    return errorResponse(
      error instanceof Error ? error.message : 'Unknown error',
      500
    );
  }
});

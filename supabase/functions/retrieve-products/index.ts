/**
 * Retrieve Products Edge Function
 *
 * Phase 2: Deterministic product retrieval from store APIs.
 * Runs searches in parallel across all configured stores.
 *
 * Input: { sessionId, hypothesis }
 * Output: { results: StoreResult[], totalCandidates, ... }
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { retrieveFromAllStores, type StoreResult, type StoreSource } from './store-adapters.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Configuration
const STORE_TIMEOUT_MS = 5000; // 5 second timeout per store
const MAX_CANDIDATES_PER_STORE = 10;
const DEFAULT_STORES: StoreSource[] = ['amazon', 'target', 'walmart', 'bestbuy', 'ebay'];

interface ProductHypothesis {
  product_name: string;
  brand?: string;
  category: string;
  subcategory?: string;
  attributes: Record<string, string>;
  search_queries: {
    strict: string;
    broad: string;
  };
  confidence: number;
}

// Create Supabase client for artifact storage
function createSupabaseClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  return createClient(supabaseUrl, supabaseServiceKey);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const { sessionId, hypothesis, stores } = await req.json();

    if (!hypothesis || !hypothesis.search_queries) {
      return new Response(
        JSON.stringify({ error: 'hypothesis with search_queries is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Retrieve] Starting for session ${sessionId}, query: "${hypothesis.search_queries.strict}"`);

    // Run parallel retrieval
    const retrievalResult = await retrieveFromAllStores({
      query: hypothesis.search_queries.strict,
      broadQuery: hypothesis.search_queries.broad,
      timeout: STORE_TIMEOUT_MS,
      maxCandidatesPerStore: MAX_CANDIDATES_PER_STORE,
      stores: stores || DEFAULT_STORES,
    });

    console.log(`[Retrieve] Completed in ${retrievalResult.totalTimeMs}ms with ${retrievalResult.totalCandidates} candidates`);

    // Save artifacts if we have a session ID
    if (sessionId) {
      const supabase = createSupabaseClient();

      try {
        // Save each store result as an artifact
        for (const result of retrievalResult.results) {
          await supabase.from('session_artifacts').insert({
            session_id: sessionId,
            artifact_type: 'store_result',
            source: result.source,
            payload: {
              session_id: sessionId,
              source: result.source,
              source_status: result.status,
              candidates: result.candidates.map((c) => ({
                external_id: c.externalId,
                title: c.title,
                price_cents: c.priceCents,
                price_display: c.priceDisplay,
                url: c.url,
                affiliate_url: c.url, // Already has affiliate tag
                image_url: c.imageUrl,
                rating: c.rating,
                review_count: c.reviewCount,
                in_stock: c.inStock,
              })),
              query_used: result.queryUsed,
              response_time_ms: result.responseTimeMs,
              error_message: result.errorMessage,
              created_at: new Date().toISOString(),
            },
            duration_ms: result.responseTimeMs,
          });
        }

        // Update session with first_result_at if this is the first result
        const firstSuccessfulResult = retrievalResult.results.find((r) => r.status === 'success');
        if (firstSuccessfulResult) {
          await supabase
            .from('search_sessions')
            .update({
              stage_timings: {
                first_result_at: new Date().toISOString(),
              },
            })
            .eq('id', sessionId);
        }

        console.log(`[Retrieve] Saved ${retrievalResult.results.length} artifacts for session ${sessionId}`);
      } catch (artifactError) {
        console.error('[Retrieve] Failed to save artifacts (non-blocking):', artifactError);
      }
    }

    // Transform results for response
    const response = {
      results: retrievalResult.results.map((r) => ({
        source: r.source,
        status: r.status,
        candidateCount: r.candidates.length,
        responseTimeMs: r.responseTimeMs,
        errorMessage: r.errorMessage,
        candidates: r.candidates,
      })),
      totalCandidates: retrievalResult.totalCandidates,
      successfulStores: retrievalResult.successfulStores,
      failedStores: retrievalResult.failedStores,
      totalTimeMs: retrievalResult.totalTimeMs,
    };

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error(`[Retrieve] Error after ${Date.now() - startTime}ms:`, error);

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        duration_ms: Date.now() - startTime,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

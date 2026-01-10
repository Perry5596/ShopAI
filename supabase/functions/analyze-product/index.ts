import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { appendAffiliateTag, getRetailerName } from './affiliate-config.ts';
import {
  searchGoogleShopping,
  searchAllStores,
  isSerpApiConfigured,
  type SerpApiResult,
  type RealProductCandidate,
} from './serpapi-service.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const AFFILIATE_DOMAINS = ['amazon.com', 'target.com', 'bestbuy.com', 'walmart.com', 'ebay.com'];

// Feature flags for staged rollout
const ENABLE_SESSION_LOGGING = Deno.env.get('ENABLE_SESSION_LOGGING') !== 'false'; // Default: enabled
const USE_STAGED_VISION = Deno.env.get('USE_STAGED_VISION') === 'true'; // Phase 1: Default: disabled
const USE_DETERMINISTIC_RETRIEVAL = Deno.env.get('USE_DETERMINISTIC_RETRIEVAL') === 'true'; // Phase 2: Default: disabled
const USE_STAGED_RANKING = Deno.env.get('USE_STAGED_RANKING') === 'true'; // Phase 3: Default: disabled
const ENABLE_RESULT_CACHING = Deno.env.get('ENABLE_RESULT_CACHING') === 'true'; // Phase 4: Default: disabled

// Cache TTLs
const HYPOTHESIS_CACHE_TTL_HOURS = 168; // 7 days
const SESSION_CACHE_TTL_HOURS = 24; // 24 hours

// Circuit breaker state (in-memory for edge function)
const circuitBreaker: Record<StoreSource, { failures: number; lastFailure: number; isOpen: boolean }> = {
  amazon: { failures: 0, lastFailure: 0, isOpen: false },
  target: { failures: 0, lastFailure: 0, isOpen: false },
  walmart: { failures: 0, lastFailure: 0, isOpen: false },
  bestbuy: { failures: 0, lastFailure: 0, isOpen: false },
  ebay: { failures: 0, lastFailure: 0, isOpen: false },
};

const CIRCUIT_BREAKER_THRESHOLD = 3; // Failures before opening
const CIRCUIT_BREAKER_RESET_MS = 60000; // 1 minute before retry

// Store retrieval configuration
const STORE_TIMEOUT_MS = 5000;
const MAX_CANDIDATES_PER_STORE = 10;

type StoreSource = 'amazon' | 'target' | 'walmart' | 'bestbuy' | 'ebay';
const ALL_STORES: StoreSource[] = ['amazon', 'target', 'walmart', 'bestbuy', 'ebay'];

interface StoreCandidate {
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

interface StoreResult {
  source: StoreSource;
  status: 'success' | 'timeout' | 'error' | 'no_results';
  candidates: StoreCandidate[];
  queryUsed: string;
  responseTimeMs: number;
  errorMessage?: string;
}

interface ProductResult {
  productName: string;
  description: string;
  products: Array<{ title: string; price: string; url: string; rating?: number; reviewCount?: number }>;
  recommendedIndex: number;
}

interface SnapResult {
  title: string;
  description?: string;
  products: Array<{ title: string; price: string; imageUrl?: string; affiliateUrl: string; source: string; isRecommended: boolean; rating?: number; reviewCount?: number }>;
  recommendedIndex?: number;
  sessionId?: string; // Added for session tracking
}

interface SessionTimings {
  llmStartTime: number;
  llmEndTime?: number;
  hypothesisEndTime?: number;
  totalDuration?: number;
}

// Phase 1: Vision extraction prompt (no web search)
const VISION_PROMPT = `Analyze this product image and extract identification details.

Return ONLY valid JSON matching this schema:
{
  "product_name": "exact product name if visible, otherwise best guess",
  "brand": "brand name if identifiable, or null",
  "category": "one of: footwear, apparel, electronics, home, beauty, toys, sports, other",
  "subcategory": "specific type within category",
  "attributes": {
    "color": "primary color(s)",
    "material": "if identifiable",
    "model_number": "if visible"
  },
  "confidence": 0.0-1.0
}

Rules:
- Do NOT invent URLs or prices
- Focus on identifying the EXACT product make/model
- Be conservative with confidence scores`;

interface ProductHypothesis {
  product_name: string;
  brand?: string;
  category: string;
  subcategory?: string;
  attributes: Record<string, string>;
  confidence: number;
  search_queries: { strict: string; broad: string };
}

// Build search queries from hypothesis
function buildSearchQueries(hypothesis: Partial<ProductHypothesis>): { strict: string; broad: string } {
  const strictParts: string[] = [];
  const broadParts: string[] = [];

  if (hypothesis.brand) {
    strictParts.push(hypothesis.brand);
    broadParts.push(hypothesis.brand);
  }
  if (hypothesis.product_name) {
    strictParts.push(hypothesis.product_name);
  }
  if (hypothesis.attributes?.color) {
    strictParts.push(hypothesis.attributes.color);
  }
  if (hypothesis.attributes?.model_number) {
    strictParts.push(hypothesis.attributes.model_number);
  }

  broadParts.push(hypothesis.subcategory || hypothesis.category || 'product');

  return {
    strict: strictParts.join(' '),
    broad: broadParts.join(' '),
  };
}

// Phase 1: Extract hypothesis using vision-only LLM call
async function extractHypothesis(
  imageUrl: string,
  openaiApiKey: string
): Promise<{ hypothesis: ProductHypothesis; rawOutput: string; duration: number }> {
  const startTime = Date.now();

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${openaiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: VISION_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Identify this product. What is it exactly?' },
            { type: 'image_url', image_url: { url: imageUrl } },
          ],
        },
      ],
      max_tokens: 500,
      temperature: 0.3,
    }),
  });

  const duration = Date.now() - startTime;

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`Vision API error (${response.status}): ${errorData}`);
  }

  const data = await response.json();
  const rawOutput = data.choices?.[0]?.message?.content || '';

  // Parse the JSON response
  let parsed: Partial<ProductHypothesis>;
  try {
    let jsonStr = rawOutput;
    const match = rawOutput.match(/```json\s*([\s\S]*?)\s*```/) ||
                  rawOutput.match(/```\s*([\s\S]*?)\s*```/) ||
                  rawOutput.match(/\{[\s\S]*"product_name"[\s\S]*\}/);
    if (match) {
      jsonStr = match[1] || match[0];
    }
    parsed = JSON.parse(jsonStr.trim());
  } catch {
    parsed = {
      product_name: 'Unknown Product',
      category: 'other',
      confidence: 0.2,
    };
  }

  const hypothesis: ProductHypothesis = {
    product_name: parsed.product_name || 'Unknown Product',
    brand: parsed.brand,
    category: parsed.category || 'other',
    subcategory: parsed.subcategory,
    attributes: parsed.attributes || {},
    confidence: Math.max(0, Math.min(1, parsed.confidence || 0.5)),
    search_queries: buildSearchQueries(parsed),
  };

  return { hypothesis, rawOutput, duration };
}

// Phase 2: Simulate deterministic store retrieval
// In production, this would call the retrieve-products edge function
// For now, we simulate the results to enable parallel store queries
async function retrieveFromStores(
  hypothesis: ProductHypothesis,
  timeout: number = STORE_TIMEOUT_MS
): Promise<{ results: StoreResult[]; totalCandidates: number; duration: number }> {
  const startTime = Date.now();
  const query = hypothesis.search_queries.strict;
  const broadQuery = hypothesis.search_queries.broad;

  console.log(`[Retrieval] Starting parallel search for: "${query}"`);

  // Simulate parallel store queries
  const storePromises = ALL_STORES.map(async (source): Promise<StoreResult> => {
    const storeStartTime = Date.now();

    // Phase 4: Check circuit breaker
    if (isStoreCircuitOpen(source)) {
      console.log(`[Retrieval] Skipping ${source} - circuit is open`);
      return {
        source,
        status: 'error',
        candidates: [],
        queryUsed: query,
        responseTimeMs: 0,
        errorMessage: 'Circuit breaker open - store temporarily unavailable',
      };
    }

    try {
      // Simulate network delay (different for each store)
      const delay = 400 + Math.random() * 1000;
      await new Promise((resolve) => {
        const timeoutId = setTimeout(resolve, Math.min(delay, timeout));
        // Clear timeout if we hit the limit
        if (delay > timeout) {
          clearTimeout(timeoutId);
        }
      });

      if (delay > timeout) {
        return {
          source,
          status: 'timeout',
          candidates: [],
          queryUsed: query,
          responseTimeMs: timeout,
          errorMessage: 'Request timed out',
        };
      }

      // Generate realistic-looking results
      const basePrice = 40 + Math.random() * 200;
      const candidates: StoreCandidate[] = [
        {
          externalId: `${source.toUpperCase()}_${Math.random().toString(36).substring(2, 10)}`,
          title: `${hypothesis.product_name} - ${source.charAt(0).toUpperCase() + source.slice(1)}`,
          priceCents: Math.round(basePrice * 100),
          priceDisplay: `$${basePrice.toFixed(2)}`,
          url: getStoreUrl(source, hypothesis.product_name),
          rating: Math.round((4.0 + Math.random() * 1.0) * 10) / 10,
          reviewCount: Math.floor(50 + Math.random() * 5000),
          inStock: true,
        },
      ];

      // Add a second result for some stores
      if (Math.random() > 0.4) {
        const altPrice = basePrice * (0.9 + Math.random() * 0.3);
        candidates.push({
          externalId: `${source.toUpperCase()}_${Math.random().toString(36).substring(2, 10)}`,
          title: `${hypothesis.product_name} - ${hypothesis.brand || 'Generic'}`,
          priceCents: Math.round(altPrice * 100),
          priceDisplay: `$${altPrice.toFixed(2)}`,
          url: getStoreUrl(source, hypothesis.product_name),
          rating: Math.round((3.8 + Math.random() * 1.2) * 10) / 10,
          reviewCount: Math.floor(20 + Math.random() * 2000),
          inStock: Math.random() > 0.1,
        });
      }

      // Record success for circuit breaker
      recordStoreSuccess(source);

      return {
        source,
        status: 'success',
        candidates: candidates.slice(0, MAX_CANDIDATES_PER_STORE),
        queryUsed: query,
        responseTimeMs: Date.now() - storeStartTime,
      };
    } catch (error) {
      // Record failure for circuit breaker
      recordStoreFailure(source);

      return {
        source,
        status: 'error',
        candidates: [],
        queryUsed: query,
        responseTimeMs: Date.now() - storeStartTime,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  const results = await Promise.all(storePromises);

  // Also record timeouts for circuit breaker
  for (const result of results) {
    if (result.status === 'timeout') {
      recordStoreFailure(result.source);
    }
  }

  const totalCandidates = results.reduce((sum, r) => sum + r.candidates.length, 0);
  const duration = Date.now() - startTime;

  console.log(`[Retrieval] Completed in ${duration}ms: ${totalCandidates} candidates from ${results.filter(r => r.status === 'success').length} stores`);

  return { results, totalCandidates, duration };
}

// Helper to generate store search URLs (not fake product URLs)
// These are real search URLs that will show actual results for the product
function getStoreUrl(source: StoreSource, productName: string): string {
  const encodedQuery = encodeURIComponent(productName);
  switch (source) {
    case 'amazon':
      return `https://www.amazon.com/s?k=${encodedQuery}&tag=luminasoftwar-20`;
    case 'target':
      return `https://www.target.com/s?searchTerm=${encodedQuery}`;
    case 'walmart':
      return `https://www.walmart.com/search?q=${encodedQuery}`;
    case 'bestbuy':
      return `https://www.bestbuy.com/site/searchpage.jsp?st=${encodedQuery}`;
    case 'ebay':
      return `https://www.ebay.com/sch/i.html?_nkw=${encodedQuery}`;
  }
}

// Convert store results to SnapResult products format
function storeResultsToProducts(
  results: StoreResult[]
): Array<{ title: string; price: string; url: string; rating?: number; reviewCount?: number }> {
  const products: Array<{ title: string; price: string; url: string; rating?: number; reviewCount?: number }> = [];
  const seenDomains = new Set<string>();

  for (const result of results) {
    if (result.status !== 'success') continue;

    for (const candidate of result.candidates) {
      // One product per domain
      try {
        const domain = new URL(candidate.url).hostname.replace('www.', '').split('.').slice(-2).join('.');
        if (seenDomains.has(domain)) continue;
        seenDomains.add(domain);
      } catch {
        continue;
      }

      products.push({
        title: candidate.title,
        price: candidate.priceDisplay,
        url: candidate.url,
        rating: candidate.rating,
        reviewCount: candidate.reviewCount,
      });

      if (products.length >= 5) break; // Max 5 products
    }
    if (products.length >= 5) break;
  }

  return products;
}

// Flatten store results to candidate list for ranking
function flattenStoreCandidates(results: StoreResult[]): Array<StoreCandidate & { source: StoreSource }> {
  const allCandidates: Array<StoreCandidate & { source: StoreSource }> = [];

  for (const result of results) {
    if (result.status !== 'success') continue;

    for (const candidate of result.candidates) {
      allCandidates.push({
        ...candidate,
        source: result.source,
      });
    }
  }

  return allCandidates;
}

// Ranking prompt for Phase 3
const RANKING_PROMPT = `You are ranking product search results for accuracy.

Given the product the user is looking for and candidates from stores, rank by match accuracy.

Return ONLY valid JSON:
{
  "rankings": [{"index": 0, "confidence": 0.95, "reasoning": "why"}],
  "recommended_index": 0
}

Rules:
- Rank by MATCH ACCURACY, not price
- confidence: 0.0-1.0
- Do NOT invent products`;

// Phase 3: Rank candidates using gpt-4o-mini
async function rankCandidates(
  hypothesis: ProductHypothesis,
  candidates: Array<StoreCandidate & { source: StoreSource }>,
  openaiApiKey: string
): Promise<{
  rankedProducts: Array<{ title: string; price: string; url: string; rating?: number; reviewCount?: number; confidence: number; isRecommended: boolean }>;
  duration: number;
}> {
  const startTime = Date.now();

  if (candidates.length === 0) {
    return { rankedProducts: [], duration: Date.now() - startTime };
  }

  // If only a few candidates, skip LLM ranking
  if (candidates.length <= 2) {
    return {
      rankedProducts: candidates.map((c, i) => ({
        title: c.title,
        price: c.priceDisplay,
        url: c.url,
        rating: c.rating,
        reviewCount: c.reviewCount,
        confidence: 0.8 - (i * 0.1),
        isRecommended: i === 0,
      })),
      duration: Date.now() - startTime,
    };
  }

  // Build candidate list for LLM
  const candidateList = candidates.slice(0, 15).map((c, i) =>
    `${i}. ${c.title} - ${c.priceDisplay} (${c.source})${c.rating ? ` [${c.rating.toFixed(1)}★]` : ''}`
  ).join('\n');

  const userPrompt = `Target: ${hypothesis.product_name}${hypothesis.brand ? ` by ${hypothesis.brand}` : ''}
Category: ${hypothesis.category}
Attributes: ${JSON.stringify(hypothesis.attributes)}

Candidates:
${candidateList}`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: RANKING_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 500,
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      console.error('[Ranking] LLM call failed, using default order');
      return {
        rankedProducts: candidates.slice(0, 5).map((c, i) => ({
          title: c.title,
          price: c.priceDisplay,
          url: c.url,
          rating: c.rating,
          reviewCount: c.reviewCount,
          confidence: 0.7,
          isRecommended: i === 0,
        })),
        duration: Date.now() - startTime,
      };
    }

    const data = await response.json();
    const rawOutput = data.choices?.[0]?.message?.content || '';

    // Parse ranking response
    let rankings: Array<{ index: number; confidence: number }> = [];
    let recommendedIndex = 0;

    try {
      let jsonStr = rawOutput;
      const match = rawOutput.match(/\{[\s\S]*"rankings"[\s\S]*\}/);
      if (match) jsonStr = match[0];
      const parsed = JSON.parse(jsonStr.trim());
      rankings = parsed.rankings || [];
      recommendedIndex = parsed.recommended_index ?? 0;
    } catch {
      // Default ranking
      rankings = candidates.slice(0, 5).map((_, i) => ({ index: i, confidence: 0.7 }));
    }

    // Build ranked products
    const rankedProducts = rankings
      .filter((r) => r.index >= 0 && r.index < candidates.length)
      .slice(0, 5)
      .map((r) => {
        const c = candidates[r.index];
        return {
          title: c.title,
          price: c.priceDisplay,
          url: c.url,
          rating: c.rating,
          reviewCount: c.reviewCount,
          confidence: Math.max(0, Math.min(1, r.confidence)),
          isRecommended: r.index === recommendedIndex,
        };
      });

    // Ensure at least one recommended
    if (rankedProducts.length > 0 && !rankedProducts.some((p) => p.isRecommended)) {
      rankedProducts[0].isRecommended = true;
    }

    return { rankedProducts, duration: Date.now() - startTime };
  } catch (error) {
    console.error('[Ranking] Error:', error);
    return {
      rankedProducts: candidates.slice(0, 5).map((c, i) => ({
        title: c.title,
        price: c.priceDisplay,
        url: c.url,
        rating: c.rating,
        reviewCount: c.reviewCount,
        confidence: 0.6,
        isRecommended: i === 0,
      })),
      duration: Date.now() - startTime,
    };
  }
}

// Generate image hash for caching
async function generateImageHash(imageUrl: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(imageUrl);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  return `sha256:${hashHex.slice(0, 32)}`;
}

// Phase 4: Cache lookup for hypothesis by image hash
async function lookupCachedHypothesis(
  supabase: ReturnType<typeof createClient>,
  imageHash: string
): Promise<ProductHypothesis | null> {
  if (!ENABLE_RESULT_CACHING) return null;

  try {
    const cacheThreshold = new Date();
    cacheThreshold.setHours(cacheThreshold.getHours() - HYPOTHESIS_CACHE_TTL_HOURS);

    const { data, error } = await supabase
      .from('session_artifacts')
      .select('payload, created_at, session_id')
      .eq('artifact_type', 'hypothesis')
      .gte('created_at', cacheThreshold.toISOString())
      .order('created_at', { ascending: false })
      .limit(20);

    if (error || !data || data.length === 0) return null;

    // Find a matching session by image hash
    for (const artifact of data) {
      const { data: session } = await supabase
        .from('search_sessions')
        .select('image_hash')
        .eq('id', artifact.session_id)
        .single();

      if (session?.image_hash === imageHash) {
        console.log(`[Cache] Hypothesis cache hit for hash ${imageHash}`);
        return artifact.payload as ProductHypothesis;
      }
    }

    return null;
  } catch (error) {
    console.error('[Cache] Hypothesis lookup failed:', error);
    return null;
  }
}

// Phase 4: Cache lookup for completed session by image hash
async function lookupCachedSession(
  supabase: ReturnType<typeof createClient>,
  imageHash: string
): Promise<{ products: ProductResult; sessionId: string } | null> {
  if (!ENABLE_RESULT_CACHING) return null;

  try {
    const cacheThreshold = new Date();
    cacheThreshold.setHours(cacheThreshold.getHours() - SESSION_CACHE_TTL_HOURS);

    const { data: session, error } = await supabase
      .from('search_sessions')
      .select('id, shop_id')
      .eq('image_hash', imageHash)
      .eq('status', 'completed')
      .gte('created_at', cacheThreshold.toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !session) return null;

    // Get the products from the original shop
    const { data: shop } = await supabase
      .from('shops')
      .select('title, description')
      .eq('id', session.shop_id)
      .single();

    const { data: products } = await supabase
      .from('products')
      .select('*')
      .eq('shop_id', session.shop_id);

    if (!products || products.length === 0) return null;

    console.log(`[Cache] Full session cache hit for hash ${imageHash}`);

    return {
      products: {
        productName: shop?.title || 'Product',
        description: shop?.description || '',
        products: products.map((p) => ({
          title: p.title,
          price: p.price,
          url: p.affiliate_url,
          rating: p.rating,
          reviewCount: p.review_count,
        })),
        recommendedIndex: products.findIndex((p) => p.is_recommended) || 0,
      },
      sessionId: session.id,
    };
  } catch (error) {
    console.error('[Cache] Session lookup failed:', error);
    return null;
  }
}

// Phase 4: Circuit breaker check
function isStoreCircuitOpen(source: StoreSource): boolean {
  const breaker = circuitBreaker[source];

  // Check if circuit should reset
  if (breaker.isOpen && Date.now() - breaker.lastFailure > CIRCUIT_BREAKER_RESET_MS) {
    console.log(`[CircuitBreaker] Resetting ${source} circuit`);
    breaker.isOpen = false;
    breaker.failures = 0;
  }

  return breaker.isOpen;
}

// Phase 4: Record store failure for circuit breaker
function recordStoreFailure(source: StoreSource): void {
  const breaker = circuitBreaker[source];
  breaker.failures++;
  breaker.lastFailure = Date.now();

  if (breaker.failures >= CIRCUIT_BREAKER_THRESHOLD) {
    console.log(`[CircuitBreaker] Opening circuit for ${source} after ${breaker.failures} failures`);
    breaker.isOpen = true;
  }
}

// Phase 4: Record store success for circuit breaker
function recordStoreSuccess(source: StoreSource): void {
  const breaker = circuitBreaker[source];
  if (breaker.failures > 0) {
    breaker.failures = Math.max(0, breaker.failures - 1);
  }
}

// Create supabase client for session logging
function createSupabaseClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  return createClient(supabaseUrl, supabaseServiceKey);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const requestStartTime = Date.now();
  let sessionId: string | undefined;
  let supabase: ReturnType<typeof createClient> | undefined;

  try {
    const { imageUrl, shopId, userId } = await req.json();
    if (!imageUrl) {
      return new Response(JSON.stringify({ error: 'imageUrl is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) throw new Error('OPENAI_API_KEY is not configured');

    // Generate image hash for caching and session tracking
    const imageHash = await generateImageHash(imageUrl);

    // Phase 4: Check cache first if enabled
    if (ENABLE_RESULT_CACHING && shopId && userId) {
      supabase = createSupabaseClient();

      // Try to find a cached completed session with the same image
      const cachedSession = await lookupCachedSession(supabase, imageHash);
      if (cachedSession) {
        console.log(`[Cache] Returning cached results for hash ${imageHash}`);

        // Create a new session that references the cached one
        const now = new Date().toISOString();
        const { data: newSession } = await supabase
          .from('search_sessions')
          .insert({
            shop_id: shopId,
            user_id: userId,
            image_url: imageUrl,
            image_hash: imageHash,
            status: 'completed',
            stage_timings: { 
              created_at: now, 
              completed_at: now,
            },
          })
          .select()
          .single();

        if (newSession) {
          await supabase
            .from('shops')
            .update({ session_id: newSession.id })
            .eq('id', shopId);
        }

        // Return cached products
        const snapResult: SnapResult = {
          title: cachedSession.products.productName,
          description: cachedSession.products.description,
          products: cachedSession.products.products.map((p, i) => ({
            title: p.title,
            price: p.price,
            affiliateUrl: appendAffiliateTag(p.url),
            source: getRetailerName(p.url),
            isRecommended: i === cachedSession.products.recommendedIndex,
            rating: p.rating,
            reviewCount: p.reviewCount,
          })),
          recommendedIndex: cachedSession.products.recommendedIndex,
          sessionId: newSession?.id || cachedSession.sessionId,
        };

        return new Response(JSON.stringify(snapResult), { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Cache': 'HIT' } 
        });
      }
    }

    // Phase 0: Create session for instrumentation (if enabled and we have required IDs)
    if (ENABLE_SESSION_LOGGING && shopId && userId) {
      try {
        if (!supabase) supabase = createSupabaseClient();
        const now = new Date().toISOString();

        const { data: session, error: sessionError } = await supabase
          .from('search_sessions')
          .insert({
            shop_id: shopId,
            user_id: userId,
            image_url: imageUrl,
            image_hash: imageHash,
            status: 'identifying',
            stage_timings: { created_at: now },
          })
          .select()
          .single();

        if (!sessionError && session) {
          sessionId = session.id;
          console.log(`[Session ${sessionId}] Created for shop ${shopId}`);

          // Link session to shop
          await supabase
            .from('shops')
            .update({ session_id: sessionId })
            .eq('id', shopId);
        }
      } catch (sessionError) {
        // Don't fail the request if session logging fails
        console.error('Session creation failed (non-blocking):', sessionError);
      }
    }

    const timings: SessionTimings = { llmStartTime: Date.now() };
    let hypothesis: ProductHypothesis | undefined;

    // Phase 1: Staged Vision - Extract hypothesis first
    if (USE_STAGED_VISION) {
      console.log(`[Session ${sessionId}] Using staged vision extraction`);
      
      // Phase 4: Check hypothesis cache first
      if (ENABLE_RESULT_CACHING && supabase) {
        const cachedHypothesis = await lookupCachedHypothesis(supabase, imageHash);
        if (cachedHypothesis) {
          console.log(`[Session ${sessionId}] Using cached hypothesis: ${cachedHypothesis.product_name}`);
          hypothesis = cachedHypothesis;
          timings.hypothesisEndTime = Date.now();
        }
      }

      // Extract new hypothesis if not cached
      if (!hypothesis) {
        try {
          const hypothesisResult = await extractHypothesis(imageUrl, openaiApiKey);
          hypothesis = hypothesisResult.hypothesis;
          timings.hypothesisEndTime = Date.now();
          
          console.log(`[Session ${sessionId}] Hypothesis extracted in ${hypothesisResult.duration}ms: ${hypothesis.product_name}`);

          // Save hypothesis artifact
          if (sessionId && supabase) {
            try {
              await supabase.from('session_artifacts').insert({
                session_id: sessionId,
                artifact_type: 'hypothesis',
                payload: {
                  ...hypothesis,
                  raw_vision_output: hypothesisResult.rawOutput,
                },
                duration_ms: hypothesisResult.duration,
              });

              // Update session to searching status with hypothesis timing
              await supabase
                .from('search_sessions')
                .update({ 
                  status: 'searching',
                  stage_timings: {
                    created_at: new Date(requestStartTime).toISOString(),
                    hypothesis_at: new Date().toISOString(),
                  },
                })
                .eq('id', sessionId);
            } catch (artifactError) {
              console.error('Hypothesis artifact save failed (non-blocking):', artifactError);
            }
          }
        } catch (hypothesisError) {
          console.error(`[Session ${sessionId}] Hypothesis extraction failed:`, hypothesisError);
          // Fall back to monolithic flow
        }
      }
    }

    // Update session to searching status (if not already updated by staged vision)
    if (!USE_STAGED_VISION && sessionId && supabase) {
      await supabase
        .from('search_sessions')
        .update({ status: 'searching' })
        .eq('id', sessionId);
    }

    let productResult: ProductResult;
    let outputText = '';
    let llmDuration = 0;

    // Phase 2: Use deterministic retrieval if enabled AND we have a hypothesis
    if (USE_DETERMINISTIC_RETRIEVAL && hypothesis) {
      console.log(`[Session ${sessionId}] Using deterministic retrieval`);

      const retrievalResult = await retrieveFromStores(hypothesis);
      llmDuration = retrievalResult.duration;

      // Save store results as artifacts
      if (sessionId && supabase) {
        try {
          for (const result of retrievalResult.results) {
            await supabase.from('session_artifacts').insert({
              session_id: sessionId,
              artifact_type: 'store_result',
              source: result.source,
              payload: {
                source: result.source,
                status: result.status,
                candidates: result.candidates,
                query_used: result.queryUsed,
                response_time_ms: result.responseTimeMs,
                error_message: result.errorMessage,
              },
              duration_ms: result.responseTimeMs,
            });
          }

          // Update session with first_result_at
          await supabase
            .from('search_sessions')
            .update({
              stage_timings: {
                first_result_at: new Date().toISOString(),
              },
            })
            .eq('id', sessionId);

          console.log(`[Session ${sessionId}] Saved ${retrievalResult.results.length} store artifacts`);
        } catch (artifactError) {
          console.error('Store artifact save failed (non-blocking):', artifactError);
        }
      }

      // Phase 3: Optionally rank candidates using LLM
      let finalProducts: Array<{ title: string; price: string; url: string; rating?: number; reviewCount?: number }>;

      if (USE_STAGED_RANKING) {
        console.log(`[Session ${sessionId}] Using staged ranking`);

        // Update session to ranking status
        if (sessionId && supabase) {
          await supabase
            .from('search_sessions')
            .update({ status: 'ranking' })
            .eq('id', sessionId);
        }

        const allCandidates = flattenStoreCandidates(retrievalResult.results);
        const rankingResult = await rankCandidates(hypothesis, allCandidates, openaiApiKey);

        console.log(`[Session ${sessionId}] Ranking completed in ${rankingResult.duration}ms`);

        // Save ranking artifact
        if (sessionId && supabase) {
          try {
            await supabase.from('session_artifacts').insert({
              session_id: sessionId,
              artifact_type: 'ranked_result',
              payload: {
                ranked_products: rankingResult.rankedProducts,
                ranking_time_ms: rankingResult.duration,
                total_candidates: allCandidates.length,
              },
              duration_ms: rankingResult.duration,
            });
          } catch (artifactError) {
            console.error('Ranking artifact save failed (non-blocking):', artifactError);
          }
        }

        finalProducts = rankingResult.rankedProducts;
        llmDuration += rankingResult.duration;
      } else {
        // Use retrieval order without LLM ranking
        finalProducts = storeResultsToProducts(retrievalResult.results);
      }

      productResult = {
        productName: hypothesis.product_name,
        description: `${hypothesis.category}${hypothesis.subcategory ? ' - ' + hypothesis.subcategory : ''}`,
        products: finalProducts,
        recommendedIndex: 0,
      };

      outputText = JSON.stringify(productResult);
      timings.llmEndTime = Date.now();

    } else {
      // Fall back to monolithic LLM call for search
      const searchPrompt = hypothesis
        ? `Search for "${hypothesis.search_queries.strict}" on shopping sites. Return JSON: {"productName":"${hypothesis.product_name}","description":"${hypothesis.category}","products":[{"title":"t","price":"$X","url":"url"}],"recommendedIndex":0}. One product per store. Real URLs only.`
        : 'Identify the product. Search online. Return JSON: {"productName":"name","description":"desc","products":[{"title":"t","price":"$X","url":"url"}],"recommendedIndex":0}. One product per store. Real URLs only.';

      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: { Authorization: `Bearer ${openaiApiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-5-mini',
          reasoning: { effort: 'low' },
          tools: [{ type: 'web_search', filters: { allowed_domains: AFFILIATE_DOMAINS } }],
          tool_choice: 'required',
          input: [
            { role: 'system', content: searchPrompt },
            { role: 'user', content: [
              { type: 'input_text', text: hypothesis ? `Find this product: ${hypothesis.product_name}` : 'What product is this? Find it online.' },
              { type: 'input_image', image_url: imageUrl }
            ]}
          ],
        }),
      });

      timings.llmEndTime = Date.now();
      llmDuration = timings.llmEndTime - timings.llmStartTime;

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`OpenAI API error (${response.status}): ${errorData}`);
      }

      const data = await response.json();
      for (const item of data.output || []) {
        if (item.type === 'message' && item.content) {
          for (const content of item.content) {
            if (content.type === 'output_text') { outputText = content.text; break; }
          }
        }
      }

      // Log raw LLM output as artifact
      if (sessionId && supabase) {
        try {
          await supabase.from('session_artifacts').insert({
            session_id: sessionId,
            artifact_type: 'raw_llm_output',
            source: USE_STAGED_VISION ? 'openai_search_only' : 'openai_monolithic',
            payload: { raw_output: outputText, model: 'gpt-5-mini', response_data: data, used_hypothesis: !!hypothesis },
            duration_ms: llmDuration,
          });
          console.log(`[Session ${sessionId}] LLM search completed in ${llmDuration}ms`);
        } catch (artifactError) {
          console.error('Artifact save failed (non-blocking):', artifactError);
        }
      }

      // Parse the LLM response
      try {
        let jsonStr = outputText;
        const match = outputText.match(/```json\s*([\s\S]*?)\s*```/) || outputText.match(/```\s*([\s\S]*?)\s*```/) || outputText.match(/\{[\s\S]*"productName"[\s\S]*\}/);
        if (match) jsonStr = match[1] || match[0];
        productResult = JSON.parse(jsonStr.trim());
      } catch {
        // Update session to failed status
        if (sessionId && supabase) {
          await supabase
            .from('search_sessions')
            .update({ 
              status: 'failed', 
              error: 'Failed to parse LLM response',
              stage_timings: {
                created_at: new Date(requestStartTime).toISOString(),
                completed_at: new Date().toISOString(),
              },
            })
            .eq('id', sessionId);
        }
        return new Response(JSON.stringify({ title: 'Product', description: 'Unable to find listings.', products: [], sessionId }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    const seenDomains = new Set<string>();
    const validProducts = productResult.products.filter((p) => {
      if (/XXXX|xxxx|\.\.\./.test(p.url)) return false;
      try {
        const domain = new URL(p.url).hostname.replace('www.', '').split('.').slice(-2).join('.');
        if (seenDomains.has(domain)) return false;
        seenDomains.add(domain);
        return true;
      } catch { return false; }
    });

    const snapResult: SnapResult = {
      // Use hypothesis product name if available (more accurate from vision-only extraction)
      title: hypothesis?.product_name || productResult.productName,
      description: productResult.description || (hypothesis ? `${hypothesis.category} - ${hypothesis.subcategory || ''}`.trim() : undefined),
      products: validProducts.map((p, i) => ({
        title: p.title,
        price: p.price,
        affiliateUrl: appendAffiliateTag(p.url),
        source: getRetailerName(p.url),
        isRecommended: i === 0,
        rating: p.rating,
        reviewCount: p.reviewCount,
      })),
      recommendedIndex: 0,
      sessionId, // Include session ID in response
    };

    timings.totalDuration = Date.now() - requestStartTime;

    // Update session to completed status
    if (sessionId && supabase) {
      try {
        const now = new Date().toISOString();
        await supabase
          .from('search_sessions')
          .update({ 
            status: 'completed',
            stage_timings: {
              created_at: new Date(requestStartTime).toISOString(),
              hypothesis_at: new Date(timings.llmStartTime).toISOString(),
              completed_at: now,
            },
          })
          .eq('id', sessionId);
        
        console.log(`[Session ${sessionId}] Completed in ${timings.totalDuration}ms, found ${validProducts.length} products`);
      } catch (updateError) {
        console.error('Session update failed (non-blocking):', updateError);
      }
    }

    return new Response(JSON.stringify(snapResult), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    // Update session to failed status
    if (sessionId && supabase) {
      try {
        await supabase
          .from('search_sessions')
          .update({ 
            status: 'failed', 
            error: error instanceof Error ? error.message : 'Unknown error',
          })
          .eq('id', sessionId);
      } catch (updateError) {
        console.error('Session failure update failed:', updateError);
      }
    }
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error', sessionId }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

/**
 * Rank Products Edge Function
 *
 * Phase 3: Lightweight LLM ranking step using gpt-4o-mini.
 * Validates and ranks candidates from deterministic retrieval.
 *
 * Input: { sessionId, hypothesis, candidates }
 * Output: { rankedProducts, dedupedCount, rankingTimeMs }
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Ranking prompt - focused only on validation and ranking
const RANKING_PROMPT = `You are ranking product search results for accuracy.

Given the product the user is looking for and a list of candidates from various stores, 
rank them by how well they match the target product.

Return ONLY valid JSON matching this schema:
{
  "rankings": [
    {"index": 0, "confidence": 0.95, "reasoning": "why this ranks here"},
    {"index": 1, "confidence": 0.80, "reasoning": "why this ranks here"}
  ],
  "recommended_index": 0
}

Rules:
- Rank by MATCH ACCURACY, not by price
- confidence: 0.0-1.0 how well the candidate matches the target
- Flag obvious mismatches with confidence < 0.3
- Do NOT invent products not in the list
- Do NOT modify URLs or prices
- recommended_index: the best match (highest confidence)`;

interface ProductHypothesis {
  product_name: string;
  brand?: string;
  category: string;
  subcategory?: string;
  attributes: Record<string, string>;
  confidence: number;
}

interface ProductCandidate {
  externalId: string;
  title: string;
  priceCents: number;
  priceDisplay: string;
  url: string;
  imageUrl?: string;
  rating?: number;
  reviewCount?: number;
  inStock: boolean;
  source: string;
}

interface RankedProduct {
  rank: number;
  source: string;
  externalId: string;
  title: string;
  priceDisplay: string;
  affiliateUrl: string;
  imageUrl?: string;
  rating?: number;
  reviewCount?: number;
  confidence: number;
  isRecommended: boolean;
  reasoning?: string;
}

interface RankingResult {
  rankedProducts: RankedProduct[];
  dedupedCount: number;
  totalCandidatesEvaluated: number;
  rankingModel: string;
  rankingTimeMs: number;
}

// Create Supabase client
function createSupabaseClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  return createClient(supabaseUrl, supabaseServiceKey);
}

// Deduplicate candidates based on title similarity and price
function deduplicateCandidates(candidates: ProductCandidate[]): { deduped: ProductCandidate[]; removedCount: number } {
  const seen = new Map<string, ProductCandidate>();
  let removedCount = 0;

  for (const candidate of candidates) {
    // Create a normalized key for deduplication
    const normalizedTitle = candidate.title.toLowerCase().replace(/[^a-z0-9]/g, '');
    const priceKey = Math.floor(candidate.priceCents / 500); // Group within $5 ranges

    // Check for similar products
    let isDuplicate = false;
    for (const [key, existing] of seen) {
      const existingNormalized = key.split('|')[0];
      
      // Check title similarity (simple substring check)
      const shorter = normalizedTitle.length < existingNormalized.length ? normalizedTitle : existingNormalized;
      const longer = normalizedTitle.length >= existingNormalized.length ? normalizedTitle : existingNormalized;
      
      if (longer.includes(shorter) && shorter.length > 10) {
        // Similar title - check price proximity
        const existingPriceKey = parseInt(key.split('|')[1]);
        if (Math.abs(priceKey - existingPriceKey) <= 2) { // Within $10
          isDuplicate = true;
          removedCount++;
          
          // Keep the one with more reviews
          if ((candidate.reviewCount || 0) > (existing.reviewCount || 0)) {
            seen.set(key, candidate);
          }
          break;
        }
      }
    }

    if (!isDuplicate) {
      seen.set(`${normalizedTitle}|${priceKey}`, candidate);
    }
  }

  return { deduped: Array.from(seen.values()), removedCount };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const { sessionId, hypothesis, candidates } = await req.json();

    if (!hypothesis || !candidates || !Array.isArray(candidates)) {
      return new Response(
        JSON.stringify({ error: 'hypothesis and candidates array are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    console.log(`[Ranking] Starting for session ${sessionId}, ${candidates.length} candidates`);

    // Deduplicate candidates first
    const { deduped, removedCount } = deduplicateCandidates(candidates);
    console.log(`[Ranking] Deduped ${removedCount} candidates, ${deduped.length} remaining`);

    // If only a few candidates, skip LLM ranking
    if (deduped.length <= 2) {
      const rankedProducts: RankedProduct[] = deduped.map((c, i) => ({
        rank: i + 1,
        source: c.source,
        externalId: c.externalId,
        title: c.title,
        priceDisplay: c.priceDisplay,
        affiliateUrl: c.url,
        imageUrl: c.imageUrl,
        rating: c.rating,
        reviewCount: c.reviewCount,
        confidence: 0.8 - (i * 0.1),
        isRecommended: i === 0,
        reasoning: 'Default ranking by retrieval order',
      }));

      return new Response(
        JSON.stringify({
          rankedProducts,
          dedupedCount: removedCount,
          totalCandidatesEvaluated: candidates.length,
          rankingModel: 'none',
          rankingTimeMs: Date.now() - startTime,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build prompt for LLM ranking
    const candidateList = deduped.map((c, i) => 
      `${i}. ${c.title} - ${c.priceDisplay} (${c.source})${c.rating ? ` [${c.rating.toFixed(1)}★, ${c.reviewCount} reviews]` : ''}`
    ).join('\n');

    const userPrompt = `Target product: ${hypothesis.product_name}${hypothesis.brand ? ` by ${hypothesis.brand}` : ''}
Category: ${hypothesis.category}${hypothesis.subcategory ? ` / ${hypothesis.subcategory}` : ''}
Attributes: ${JSON.stringify(hypothesis.attributes)}

Candidates:
${candidateList}

Rank these candidates by how well they match the target product.`;

    // Call GPT-4o-mini for ranking
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
        max_tokens: 1000,
        temperature: 0.2,
      }),
    });

    const rankingTime = Date.now() - startTime;

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Ranking API error (${response.status}): ${errorData}`);
    }

    const data = await response.json();
    const rawOutput = data.choices?.[0]?.message?.content || '';

    console.log(`[Ranking] LLM completed in ${rankingTime}ms`);

    // Parse ranking response
    let rankings: Array<{ index: number; confidence: number; reasoning?: string }> = [];
    let recommendedIndex = 0;

    try {
      let jsonStr = rawOutput;
      const match = rawOutput.match(/```json\s*([\s\S]*?)\s*```/) ||
                    rawOutput.match(/```\s*([\s\S]*?)\s*```/) ||
                    rawOutput.match(/\{[\s\S]*"rankings"[\s\S]*\}/);
      if (match) {
        jsonStr = match[1] || match[0];
      }
      const parsed = JSON.parse(jsonStr.trim());
      rankings = parsed.rankings || [];
      recommendedIndex = parsed.recommended_index ?? 0;
    } catch (parseError) {
      console.error('[Ranking] Failed to parse LLM response, using default ranking');
      // Default ranking by order
      rankings = deduped.map((_, i) => ({ index: i, confidence: 0.7 - (i * 0.05) }));
    }

    // Build ranked products
    const rankedProducts: RankedProduct[] = [];
    const usedIndices = new Set<number>();

    // Add products in ranked order
    for (const ranking of rankings) {
      if (ranking.index >= 0 && ranking.index < deduped.length && !usedIndices.has(ranking.index)) {
        const candidate = deduped[ranking.index];
        rankedProducts.push({
          rank: rankedProducts.length + 1,
          source: candidate.source,
          externalId: candidate.externalId,
          title: candidate.title,
          priceDisplay: candidate.priceDisplay,
          affiliateUrl: candidate.url,
          imageUrl: candidate.imageUrl,
          rating: candidate.rating,
          reviewCount: candidate.reviewCount,
          confidence: Math.max(0, Math.min(1, ranking.confidence)),
          isRecommended: ranking.index === recommendedIndex,
          reasoning: ranking.reasoning,
        });
        usedIndices.add(ranking.index);
      }
    }

    // Add any remaining products not mentioned in rankings
    for (let i = 0; i < deduped.length; i++) {
      if (!usedIndices.has(i)) {
        const candidate = deduped[i];
        rankedProducts.push({
          rank: rankedProducts.length + 1,
          source: candidate.source,
          externalId: candidate.externalId,
          title: candidate.title,
          priceDisplay: candidate.priceDisplay,
          affiliateUrl: candidate.url,
          imageUrl: candidate.imageUrl,
          rating: candidate.rating,
          reviewCount: candidate.reviewCount,
          confidence: 0.3,
          isRecommended: false,
          reasoning: 'Not explicitly ranked',
        });
      }
    }

    // Limit to top 5 products
    const topProducts = rankedProducts.slice(0, 5);

    // Ensure exactly one is recommended
    if (!topProducts.some((p) => p.isRecommended) && topProducts.length > 0) {
      topProducts[0].isRecommended = true;
    }

    const result: RankingResult = {
      rankedProducts: topProducts,
      dedupedCount: removedCount,
      totalCandidatesEvaluated: candidates.length,
      rankingModel: 'gpt-4o-mini',
      rankingTimeMs: rankingTime,
    };

    // Save ranking artifact
    if (sessionId) {
      try {
        const supabase = createSupabaseClient();

        await supabase.from('session_artifacts').insert({
          session_id: sessionId,
          artifact_type: 'ranked_result',
          payload: {
            session_id: sessionId,
            ranked_products: topProducts,
            deduped_count: removedCount,
            total_candidates_evaluated: candidates.length,
            ranking_model: 'gpt-4o-mini',
            ranking_time_ms: rankingTime,
            raw_llm_output: rawOutput,
            created_at: new Date().toISOString(),
          },
          duration_ms: rankingTime,
        });

        // Update session to ranking complete
        await supabase
          .from('search_sessions')
          .update({
            status: 'ranking',
            stage_timings: {
              ranking_started_at: new Date().toISOString(),
            },
          })
          .eq('id', sessionId);

        console.log(`[Ranking] Saved artifact for session ${sessionId}`);
      } catch (artifactError) {
        console.error('[Ranking] Failed to save artifact (non-blocking):', artifactError);
      }
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error(`[Ranking] Error after ${Date.now() - startTime}ms:`, error);

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        duration_ms: Date.now() - startTime,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

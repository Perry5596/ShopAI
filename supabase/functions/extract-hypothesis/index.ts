/**
 * Extract Hypothesis Edge Function
 *
 * Phase 1: Vision-only LLM call that extracts product hypothesis from an image.
 * This function does NOT search the web - it only identifies the product.
 *
 * Input: { imageUrl, sessionId }
 * Output: ProductHypothesis
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Product categories for structured output
const CATEGORIES = ['footwear', 'apparel', 'electronics', 'home', 'beauty', 'toys', 'sports', 'other'] as const;

// Vision extraction prompt - NO web search, NO link generation
const VISION_PROMPT = `Analyze this product image and extract identification details.

Return ONLY valid JSON matching this schema:
{
  "product_name": "exact product name if visible, otherwise best guess",
  "brand": "brand name if identifiable, or null",
  "category": "one of: footwear, apparel, electronics, home, beauty, toys, sports, other",
  "subcategory": "specific type within category (e.g., 'sneakers', 'headphones')",
  "attributes": {
    "color": "primary color(s)",
    "material": "if identifiable",
    "size": "if visible",
    "model_number": "if visible"
  },
  "confidence": 0.0-1.0,
  "disambiguation_needed": true/false,
  "disambiguation_options": ["option1", "option2"]
}

Rules:
- Do NOT invent URLs or prices - you cannot access the web
- Do NOT search the web - only analyze the image
- If uncertain between 2-3 products, set disambiguation_needed: true and list options
- Be conservative with confidence scores
- Focus on identifying the EXACT product make/model when possible
- Include any visible text, logos, or model numbers in your analysis`;

interface ProductHypothesis {
  session_id: string;
  product_name: string;
  brand: string | null;
  category: string;
  subcategory: string | null;
  attributes: Record<string, string>;
  search_queries: {
    strict: string;
    broad: string;
  };
  confidence: number;
  disambiguation_needed: boolean;
  disambiguation_options: string[];
  raw_vision_output: string;
  created_at: string;
}

interface VisionResponse {
  product_name: string;
  brand?: string | null;
  category: string;
  subcategory?: string | null;
  attributes: Record<string, string>;
  confidence: number;
  disambiguation_needed: boolean;
  disambiguation_options?: string[];
}

// Build search queries from hypothesis
function buildSearchQueries(hypothesis: VisionResponse): { strict: string; broad: string } {
  const strictParts: string[] = [];
  const broadParts: string[] = [];

  // Strict query: brand + name + key attributes
  if (hypothesis.brand) {
    strictParts.push(hypothesis.brand);
    broadParts.push(hypothesis.brand);
  }
  strictParts.push(hypothesis.product_name);

  if (hypothesis.attributes?.color) {
    strictParts.push(hypothesis.attributes.color);
  }
  if (hypothesis.attributes?.model_number) {
    strictParts.push(hypothesis.attributes.model_number);
  }

  // Broad query: brand + category/subcategory
  broadParts.push(hypothesis.subcategory || hypothesis.category);

  return {
    strict: strictParts.join(' '),
    broad: broadParts.join(' '),
  };
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
    const { imageUrl, sessionId } = await req.json();

    if (!imageUrl) {
      return new Response(
        JSON.stringify({ error: 'imageUrl is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    console.log(`[Hypothesis] Starting vision extraction for session ${sessionId}`);

    // Call OpenAI Vision API - NO web search tool, NO reasoning
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // Fast, cheap vision model
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
        temperature: 0.3, // Low temperature for consistent outputs
      }),
    });

    const duration = Date.now() - startTime;

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`OpenAI API error (${response.status}): ${errorData}`);
    }

    const data = await response.json();
    const rawOutput = data.choices?.[0]?.message?.content || '';

    console.log(`[Hypothesis] Vision completed in ${duration}ms`);

    // Parse the JSON response
    let visionResponse: VisionResponse;
    try {
      // Try to extract JSON from the response
      let jsonStr = rawOutput;
      const match = rawOutput.match(/```json\s*([\s\S]*?)\s*```/) ||
                    rawOutput.match(/```\s*([\s\S]*?)\s*```/) ||
                    rawOutput.match(/\{[\s\S]*"product_name"[\s\S]*\}/);
      if (match) {
        jsonStr = match[1] || match[0];
      }
      visionResponse = JSON.parse(jsonStr.trim());
    } catch (parseError) {
      console.error('[Hypothesis] Failed to parse vision response:', rawOutput);
      // Create a fallback hypothesis
      visionResponse = {
        product_name: 'Unknown Product',
        brand: null,
        category: 'other',
        subcategory: null,
        attributes: {},
        confidence: 0.2,
        disambiguation_needed: true,
        disambiguation_options: ['Unable to identify - please try a clearer image'],
      };
    }

    // Validate and normalize the response
    if (!CATEGORIES.includes(visionResponse.category as typeof CATEGORIES[number])) {
      visionResponse.category = 'other';
    }

    // Build search queries
    const searchQueries = buildSearchQueries(visionResponse);

    // Construct the full hypothesis
    const hypothesis: ProductHypothesis = {
      session_id: sessionId,
      product_name: visionResponse.product_name,
      brand: visionResponse.brand || null,
      category: visionResponse.category,
      subcategory: visionResponse.subcategory || null,
      attributes: visionResponse.attributes || {},
      search_queries: searchQueries,
      confidence: Math.max(0, Math.min(1, visionResponse.confidence || 0.5)),
      disambiguation_needed: visionResponse.disambiguation_needed || false,
      disambiguation_options: visionResponse.disambiguation_options || [],
      raw_vision_output: rawOutput,
      created_at: new Date().toISOString(),
    };

    // Save hypothesis as artifact if we have a session ID
    if (sessionId) {
      try {
        const supabase = createSupabaseClient();

        // Save hypothesis artifact
        await supabase.from('session_artifacts').insert({
          session_id: sessionId,
          artifact_type: 'hypothesis',
          payload: hypothesis,
          duration_ms: duration,
        });

        // Update session status and timings
        await supabase
          .from('search_sessions')
          .update({
            status: 'searching',
            stage_timings: {
              hypothesis_at: new Date().toISOString(),
            },
          })
          .eq('id', sessionId);

        console.log(`[Hypothesis] Saved artifact for session ${sessionId}`);
      } catch (artifactError) {
        console.error('[Hypothesis] Failed to save artifact (non-blocking):', artifactError);
      }
    }

    return new Response(
      JSON.stringify({
        hypothesis,
        duration_ms: duration,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[Hypothesis] Error after ${duration}ms:`, error);

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        duration_ms: duration,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

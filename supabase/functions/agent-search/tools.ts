/**
 * Tool execution logic for the agent-search orchestrator.
 *
 * When OpenAI returns tool_calls, this module executes them by calling
 * the search-products Supabase edge function via HTTP.
 */

import type { ToolCall } from './openai.ts';

// ============================================================================
// Types
// ============================================================================

export interface SearchProductsArgs {
  query: string;
  categoryLabel: string;
  categoryDescription?: string;
  minPrice?: number;
  maxPrice?: number;
  sortBy?: string;
}

export interface ToolResult {
  toolCallId: string;
  functionName: string;
  result: string; // JSON string to send back to OpenAI
  /** Parsed category data for DB persistence */
  categoryData?: {
    label: string;
    searchQuery: string;
    description: string;
    products: unknown[];
  };
}

// ============================================================================
// Tool Execution
// ============================================================================

/**
 * Execute a single tool call by dispatching to the appropriate handler.
 */
async function executeSingleTool(
  toolCall: ToolCall,
  supabaseUrl: string,
  authHeader: string,
  country?: string
): Promise<ToolResult> {
  const { id, function: fn } = toolCall;
  const args = JSON.parse(fn.arguments);

  switch (fn.name) {
    case 'search_products':
      return await executeSearchProducts(id, args, supabaseUrl, authHeader, country);
    default:
      return {
        toolCallId: id,
        functionName: fn.name,
        result: JSON.stringify({ error: `Unknown tool: ${fn.name}` }),
      };
  }
}

/**
 * Execute the search_products tool by calling the search-products edge function.
 */
async function executeSearchProducts(
  toolCallId: string,
  args: SearchProductsArgs,
  supabaseUrl: string,
  authHeader: string,
  country?: string
): Promise<ToolResult> {
  try {
    const searchUrl = `${supabaseUrl}/functions/v1/search-products`;

    const requestBody = {
      query: args.query,
      categoryLabel: args.categoryLabel,
      source: 'amazon',
      filters: {
        ...(args.minPrice != null && { minPrice: args.minPrice }),
        ...(args.maxPrice != null && { maxPrice: args.maxPrice }),
        ...(args.sortBy && { sortBy: args.sortBy }),
      },
      ...(country && { country }),
    };

    const response = await fetch(searchUrl, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
        'apikey': Deno.env.get('SUPABASE_ANON_KEY') || '',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`search-products call failed (${response.status}):`, errorText);
      return {
        toolCallId,
        functionName: 'search_products',
        result: JSON.stringify({
          error: `Search failed for "${args.categoryLabel}": ${response.status}`,
          categoryLabel: args.categoryLabel,
          products: [],
        }),
      };
    }

    const data = await response.json();

    // Build a summary for OpenAI (it doesn't need full product details)
    const productSummary = (data.products || []).slice(0, 10).map((p: Record<string, unknown>) => ({
      title: p.title,
      price: p.price,
      brand: p.brand,
      rating: p.rating,
      reviewCount: p.reviewCount,
    }));

    const summaryForAI = {
      categoryLabel: args.categoryLabel,
      totalResults: data.totalResults || 0,
      products: productSummary,
    };

    return {
      toolCallId,
      functionName: 'search_products',
      result: JSON.stringify(summaryForAI),
      categoryData: {
        label: args.categoryLabel,
        searchQuery: args.query,
        description: args.categoryDescription || '',
        products: data.products || [],
      },
    };
  } catch (error) {
    console.error(`search_products tool error:`, error);
    return {
      toolCallId,
      functionName: 'search_products',
      result: JSON.stringify({
        error: `Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        categoryLabel: args.categoryLabel,
        products: [],
      }),
    };
  }
}

/**
 * Execute multiple tool calls in parallel.
 * Returns results in the same order as the input tool calls.
 */
export async function executeToolCalls(
  toolCalls: ToolCall[],
  supabaseUrl: string,
  authHeader: string,
  country?: string
): Promise<ToolResult[]> {
  const results = await Promise.all(
    toolCalls.map((tc) => executeSingleTool(tc, supabaseUrl, authHeader, country))
  );
  return results;
}

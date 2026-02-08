/**
 * agent-search Edge Function (Orchestrator) — Streaming SSE
 *
 * The brain of the agentic text search feature. Manages the OpenAI
 * function-calling agent loop, conversation persistence, and rate limiting.
 * Returns results progressively via Server-Sent Events (SSE) so the
 * client can display categories as they're discovered.
 *
 * SSE Event Types:
 *   event: status   → { text: "Analyzing query..." }
 *   event: category → { label, description, searchQuery, products[] }
 *   event: summary  → { content, suggestedQuestions[] }
 *   event: done     → { conversationId, messageId, rateLimit }
 *   event: error    → { message, code? }
 *
 * Request body:
 *   { conversationId?, query }
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import {
  resolveAuth,
  checkRateLimit,
  corsHeaders,
  errorResponse,
  type AuthResult,
} from '../_shared/auth.ts';
import { SYSTEM_PROMPT, buildUserMessage } from './prompt.ts';
import {
  callOpenAI,
  TOOL_DEFINITIONS,
  type ChatMessage,
  type ToolCall,
} from './openai.ts';
import { executeToolCalls, type ToolResult } from './tools.ts';

// ============================================================================
// Configuration
// ============================================================================

const RATE_LIMIT_AUTHENTICATED = 20;
const RATE_LIMIT_ANONYMOUS = 5;
const RATE_LIMIT_WINDOW_SECONDS = 7 * 24 * 60 * 60;
const MAX_AGENT_LOOPS = 3;

// ============================================================================
// SSE Helpers
// ============================================================================

/**
 * Encode an SSE event.
 */
function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/**
 * Create a streaming SSE Response.
 * Returns { response, writer } where writer.write() enqueues SSE chunks.
 */
function createSSEStream() {
  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
  });

  const writer = {
    write(event: string, data: unknown) {
      if (controller) {
        controller.enqueue(encoder.encode(sseEvent(event, data)));
      }
    },
    close() {
      if (controller) {
        controller.close();
      }
    },
  };

  const response = new Response(stream, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });

  return { response, writer };
}

// ============================================================================
// Database Helpers
// ============================================================================

function getSupabaseAdmin() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase configuration missing');
  }
  return { client: createClient(supabaseUrl, supabaseServiceKey), url: supabaseUrl };
}

async function createConversation(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  title: string
): Promise<string> {
  const { data, error } = await supabase
    .from('conversations')
    .insert({ user_id: userId, title })
    .select('id')
    .single();

  if (error) throw new Error(`Failed to create conversation: ${error.message}`);
  return data.id;
}

async function saveMessage(
  supabase: ReturnType<typeof createClient>,
  conversationId: string,
  role: 'user' | 'assistant',
  content: string,
  metadata: Record<string, unknown> = {}
): Promise<string> {
  const { data, error } = await supabase
    .from('messages')
    .insert({ conversation_id: conversationId, role, content, metadata })
    .select('id')
    .single();

  if (error) throw new Error(`Failed to save message: ${error.message}`);
  return data.id;
}

async function loadConversationHistory(
  supabase: ReturnType<typeof createClient>,
  conversationId: string
): Promise<Array<{ role: string; content: string }>> {
  const { data, error } = await supabase
    .from('messages')
    .select('role, content')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Failed to load conversation history:', error);
    return [];
  }
  return data || [];
}

/**
 * Save a single search category and its products to the database.
 * Returns the saved category with product IDs.
 */
async function saveSingleCategory(
  supabase: ReturnType<typeof createClient>,
  conversationId: string,
  messageId: string,
  toolResult: ToolResult,
  sortOrder: number
): Promise<{ id: string; label: string; description: string; products: unknown[] } | null> {
  if (!toolResult.categoryData) return null;

  const { label, searchQuery, description, products } = toolResult.categoryData;

  // Insert category
  const { data: category, error: catError } = await supabase
    .from('search_categories')
    .insert({
      conversation_id: conversationId,
      message_id: messageId,
      label,
      search_query: searchQuery,
      description,
      sort_order: sortOrder,
    })
    .select('id')
    .single();

  if (catError) {
    console.error('Failed to save search category:', catError);
    return null;
  }

  // Insert products
  if (products.length > 0) {
    const productRows = (products as Array<Record<string, unknown>>).map((p) => ({
      category_id: category.id,
      title: p.title as string,
      price: p.price as string | null,
      image_url: p.imageUrl as string | null,
      affiliate_url: p.affiliateUrl as string,
      source: (p.source as string) || 'Amazon',
      asin: p.asin as string | null,
      rating: p.rating as number | null,
      review_count: p.reviewCount as number | null,
      brand: p.brand as string | null,
    }));

    const { error: prodError } = await supabase
      .from('search_products')
      .insert(productRows);

    if (prodError) {
      console.error('Failed to save search products:', prodError);
    }
  }

  // Fetch saved products with IDs
  const { data: savedProducts } = await supabase
    .from('search_products')
    .select('*')
    .eq('category_id', category.id)
    .order('created_at', { ascending: true });

  return {
    id: category.id,
    label,
    description,
    products: savedProducts || [],
  };
}

// ============================================================================
// Streaming Agent Loop
// ============================================================================

interface StreamWriter {
  write(event: string, data: unknown): void;
}

/**
 * Run the OpenAI agent loop with streaming.
 * Each time a tool call completes (a category with products), we immediately
 * stream it to the client, save it to the DB, and continue.
 */
async function runStreamingAgentLoop(
  writer: StreamWriter,
  openaiKey: string,
  messages: ChatMessage[],
  supabaseUrl: string,
  authHeader: string,
  supabase: ReturnType<typeof createClient>,
  conversationId: string,
  messageId: string
): Promise<{
  summary: string;
  recommendations: Array<{ categoryLabel: string; productTitle: string; reason: string }>;
  followUpQuestion: string | null;
  followUpOptions: string[];
  allCategories: Array<{ id: string; label: string; description: string; products: unknown[] }>;
}> {
  let currentMessages = [...messages];
  let sortOrder = 0;
  const allCategories: Array<{ id: string; label: string; description: string; products: unknown[] }> = [];

  for (let loop = 0; loop < MAX_AGENT_LOOPS; loop++) {
    writer.write('status', { text: loop === 0 ? 'Analyzing your query...' : 'Refining results...' });

    // Call OpenAI
    const response = await callOpenAI(openaiKey, currentMessages, TOOL_DEFINITIONS);
    const choice = response.choices[0];
    if (!choice) throw new Error('No response from OpenAI');

    const assistantMessage = choice.message;

    // Check if the model wants to call tools
    if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      // Add the assistant's tool-calling message to history
      currentMessages.push({
        role: 'assistant',
        content: assistantMessage.content || '',
        tool_calls: assistantMessage.tool_calls,
      });

      writer.write('status', {
        text: `Searching ${assistantMessage.tool_calls.length} categor${assistantMessage.tool_calls.length === 1 ? 'y' : 'ies'}...`,
      });

      // Execute all tool calls in parallel
      const toolResults = await executeToolCalls(
        assistantMessage.tool_calls,
        supabaseUrl,
        authHeader
      );

      // Stream each completed category immediately
      for (const result of toolResults) {
        if (result.categoryData) {
          // Save to DB
          const savedCategory = await saveSingleCategory(
            supabase,
            conversationId,
            messageId,
            result,
            sortOrder++
          );

          if (savedCategory) {
            allCategories.push(savedCategory);

            // Stream to client
            writer.write('category', savedCategory);
          }
        }

        // Add tool result to message history
        currentMessages.push({
          role: 'tool',
          tool_call_id: result.toolCallId,
          content: result.result,
        });
      }

      continue;
    }

    // No tool calls — this is the final response
    const content = assistantMessage.content || '';

    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          summary: parsed.summary || 'Here are the results I found for you.',
          recommendations: parsed.recommendations || [],
          followUpQuestion: parsed.followUpQuestion || null,
          followUpOptions: parsed.followUpOptions || [],
          allCategories,
        };
      }
    } catch (parseError) {
      console.error('Failed to parse agent response as JSON:', parseError);
    }

    return {
      summary: content || 'Here are the results I found for you.',
      recommendations: [],
      followUpQuestion: null,
      followUpOptions: [],
      allCategories,
    };
  }

  // Max loops reached
  return {
    summary: 'Here are the results I found for you.',
    recommendations: [],
    followUpQuestion: null,
    followUpOptions: [],
    allCategories,
  };
}

// ============================================================================
// Main Handler
// ============================================================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // =========================================================================
  // Step 1: Authenticate
  // =========================================================================
  let auth: AuthResult;
  try {
    auth = await resolveAuth(req);
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
  // Step 2: Rate limit
  // =========================================================================
  const rateLimit = auth.type === 'user' ? RATE_LIMIT_AUTHENTICATED : RATE_LIMIT_ANONYMOUS;
  const rateLimitSubject = `textsearch:${auth.subject}`;
  const rateLimitResult = await checkRateLimit(
    rateLimitSubject,
    rateLimit,
    RATE_LIMIT_WINDOW_SECONDS
  );

  if (!rateLimitResult.allowed) {
    return errorResponse(
      'Rate limit exceeded',
      429,
      {
        code: 'rate_limited',
        remaining: rateLimitResult.remaining,
        reset_at: rateLimitResult.reset_at,
        limit: rateLimitResult.limit,
        used: rateLimitResult.used,
        message: auth.type === 'anon'
          ? 'You have reached your guest search limit. Sign in for more searches.'
          : 'You have reached your weekly search limit.',
      }
    );
  }

  // =========================================================================
  // Step 3: Parse request
  // =========================================================================
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return errorResponse('Invalid JSON body', 400);
  }

  const { conversationId: existingConversationId, query } = body;

  if (!query || typeof query !== 'string' || (query as string).trim().length === 0) {
    return errorResponse('query is required', 400);
  }

  const openaiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiKey) {
    return errorResponse('OpenAI API key not configured', 500);
  }

  // =========================================================================
  // Step 4: Start SSE stream
  // =========================================================================
  const { response, writer } = createSSEStream();

  // Run the agent logic asynchronously so the response streams back immediately
  (async () => {
    try {
      const { client: supabase, url: supabaseUrl } = getSupabaseAdmin();

      // Create or load conversation
      let conversationId = existingConversationId as string | undefined;
      let conversationHistory: Array<{ role: string; content: string }> = [];

      if (conversationId) {
        conversationHistory = await loadConversationHistory(supabase, conversationId);
      } else {
        const title = (query as string).trim().substring(0, 100);
        conversationId = await createConversation(supabase, auth.id, title);
      }

      // Save user message
      await saveMessage(supabase, conversationId, 'user', (query as string).trim());

      // Pre-create the assistant message (we'll update its content later)
      const messageId = await saveMessage(
        supabase,
        conversationId,
        'assistant',
        '', // Placeholder — updated after agent loop
        {}
      );

      // Build OpenAI messages
      const openaiMessages: ChatMessage[] = [
        { role: 'system', content: SYSTEM_PROMPT },
      ];

      for (const msg of conversationHistory) {
        openaiMessages.push({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        });
      }

      openaiMessages.push({
        role: 'user',
        content: buildUserMessage((query as string).trim()),
      });

      // Run streaming agent loop
      const authHeader = req.headers.get('Authorization') || '';

      const result = await runStreamingAgentLoop(
        writer,
        openaiKey,
        openaiMessages,
        supabaseUrl,
        authHeader,
        supabase,
        conversationId,
        messageId
      );

      // Update the assistant message with final content
      const assistantMetadata = {
        recommendations: result.recommendations,
        followUpQuestion: result.followUpQuestion,
        followUpOptions: result.followUpOptions,
        categoriesCount: result.allCategories.length,
      };

      await supabase
        .from('messages')
        .update({
          content: result.summary,
          metadata: assistantMetadata,
        })
        .eq('id', messageId);

      // Stream summary
      writer.write('summary', {
        content: result.summary,
        recommendations: result.recommendations,
        followUpQuestion: result.followUpQuestion,
        followUpOptions: result.followUpOptions,
      });

      // Track analytics
      if (auth.type === 'user') {
        try {
          await supabase.rpc('increment_analytics', {
            p_user_id: auth.id,
            p_event_type: 'scan',
          });
        } catch (analyticsError) {
          console.error('Failed to track search analytics:', analyticsError);
        }
      }

      // Stream done event with metadata
      writer.write('done', {
        conversationId,
        messageId,
        categories: result.allCategories,
        rateLimit: {
          remaining: rateLimitResult.remaining,
          limit: rateLimitResult.limit,
          reset_at: rateLimitResult.reset_at,
        },
      });
    } catch (error) {
      console.error('Error in agent-search stream:', error);
      writer.write('error', {
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      writer.close();
    }
  })();

  return response;
});

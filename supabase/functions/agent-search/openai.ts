/**
 * OpenAI client setup and tool definitions for the agent-search orchestrator.
 *
 * Uses GPT-5.2 (gpt-5.2) — OpenAI's flagship agentic model.
 * - State-of-the-art tool-calling performance
 * - 400K context window / 128K max output tokens
 * - reasoning_effort: "none" (default, not declared)
 */

// ============================================================================
// Types
// ============================================================================

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ChatCompletionResponse {
  id: string;
  choices: Array<{
    index: number;
    message: {
      role: 'assistant';
      content: string | null;
      tool_calls?: ToolCall[];
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// ============================================================================
// Constants
// ============================================================================

const OPENAI_MODEL = 'gpt-5.2';
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

// ============================================================================
// Tool Definitions
// ============================================================================

export const TOOL_DEFINITIONS = [
  {
    type: 'function' as const,
    function: {
      name: 'search_products',
      description: 'Search for products matching a specific category or criteria on Amazon. Call this multiple times with different queries to search across different product categories.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search keywords optimized for product search (include product name and key differentiating terms)',
          },
          categoryLabel: {
            type: 'string',
            description: 'Short display label for this category (2-4 words, shown to user)',
          },
          categoryDescription: {
            type: 'string',
            description: 'Brief explanation of why this category is relevant to the user\'s query',
          },
          minPrice: {
            type: 'number',
            description: 'Minimum price filter in USD (only use when user specifies a budget)',
          },
          maxPrice: {
            type: 'number',
            description: 'Maximum price filter in USD (only use when user specifies a budget)',
          },
          sortBy: {
            type: 'string',
            enum: ['relevance', 'price_asc', 'price_desc', 'rating'],
            description: 'How to sort results. Default is relevance.',
          },
        },
        required: ['query', 'categoryLabel'],
      },
    },
  },
];

// ============================================================================
// OpenAI API Client
// ============================================================================

/**
 * Call the OpenAI Chat Completions API.
 */
export async function callOpenAI(
  apiKey: string,
  messages: ChatMessage[],
  tools?: typeof TOOL_DEFINITIONS
): Promise<ChatCompletionResponse> {
  const body: Record<string, unknown> = {
    model: OPENAI_MODEL,
    messages,
  };

  if (tools && tools.length > 0) {
    body.tools = tools;
    body.tool_choice = 'auto';
  }

  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`OpenAI API error (${response.status}):`, errorText);
    throw new Error(`OpenAI API request failed (${response.status}): ${errorText}`);
  }

  return await response.json();
}

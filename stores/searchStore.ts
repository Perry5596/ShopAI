import { create } from 'zustand';
import { conversationService, searchService } from '@/utils/supabase-service';
import type {
  Conversation,
  Message,
  SearchCategory,
  SearchProduct,
  ProductRecommendation,
  AgentSearchResponse,
  Identity,
} from '@/types';

// ============================================================================
// Helper: Map a raw DB product row into client-side SearchProduct
// ============================================================================

function mapDbProduct(p: Record<string, unknown>, categoryId: string): SearchProduct {
  return {
    id: (p.id as string) || '',
    categoryId,
    title: (p.title as string) || '',
    price: (p.price as string | null) ?? null,
    imageUrl: (p.image_url as string | null) ?? null,
    affiliateUrl: (p.affiliate_url as string) || '',
    source: (p.source as string) || 'Amazon',
    asin: (p.asin as string | null) ?? null,
    rating: (p.rating as number | null) ?? null,
    reviewCount: (p.review_count as number | null) ?? null,
    brand: (p.brand as string | null) ?? null,
    createdAt: (p.created_at as string) || new Date().toISOString(),
  };
}

// ============================================================================
// Helper: Convert agent-search response into client-side types (non-streaming)
// ============================================================================

function mapAgentResponseToMessage(
  response: AgentSearchResponse
): { message: Message; categories: SearchCategory[] } {
  const categories: SearchCategory[] = response.categories.map((cat, index) => ({
    id: cat.id,
    conversationId: response.conversationId,
    messageId: response.message.id,
    label: cat.label,
    searchQuery: '',
    description: cat.description || null,
    sortOrder: index,
    products: cat.products.map((p) => ({
      id: p.id,
      categoryId: p.category_id,
      title: p.title,
      price: p.price,
      imageUrl: p.image_url,
      affiliateUrl: p.affiliate_url,
      source: p.source,
      asin: p.asin,
      rating: p.rating,
      reviewCount: p.review_count,
      brand: p.brand,
      createdAt: p.created_at,
    })),
    createdAt: new Date().toISOString(),
  }));

  const message: Message = {
    id: response.message.id,
    conversationId: response.conversationId,
    role: 'assistant',
    content: response.message.content,
    categories,
    suggestedQuestions: response.suggestedQuestions,
    createdAt: new Date().toISOString(),
  };

  return { message, categories };
}

// ============================================================================
// Store Interface
// ============================================================================

interface SearchState {
  /** List of conversations for history */
  conversations: Conversation[];
  /** Currently active conversation (with messages, categories, products) */
  activeConversation: Conversation | null;
  /** Loading state during agent processing */
  isSearching: boolean;
  /** Status text from the streaming agent (e.g., "Analyzing your query...") */
  streamStatus: string | null;
  /** Current follow-up suggestions */
  suggestedQuestions: string[];
  /** Error message */
  error: string | null;
  /** Rate limit info from last response */
  lastRateLimitInfo: {
    remaining: number;
    limit: number;
    reset_at: string | null;
  } | null;

  // Actions
  startSearch: (query: string, identity: Identity) => Promise<void>;
  sendFollowUp: (conversationId: string, query: string, identity: Identity) => Promise<void>;
  fetchConversations: (userId: string) => Promise<void>;
  loadConversation: (conversationId: string) => Promise<void>;
  deleteConversation: (conversationId: string) => Promise<void>;
  clearActiveConversation: () => void;
  reset: () => void;
}

// ============================================================================
// Store Implementation
// ============================================================================

export const useSearchStore = create<SearchState>((set, get) => ({
  conversations: [],
  activeConversation: null,
  isSearching: false,
  streamStatus: null,
  suggestedQuestions: [],
  error: null,
  lastRateLimitInfo: null,

  startSearch: async (query: string, identity: Identity) => {
    set({ isSearching: true, error: null, streamStatus: null, suggestedQuestions: [] });

    try {
      // Add optimistic user message
      const optimisticUserMessage: Message = {
        id: `temp-${Date.now()}`,
        conversationId: '',
        role: 'user',
        content: query,
        createdAt: new Date().toISOString(),
      };

      // Create a placeholder assistant message that will be populated by streaming events
      const streamingAssistantMessage: Message = {
        id: `streaming-${Date.now()}`,
        conversationId: '',
        role: 'assistant',
        content: '',
        categories: [],
        suggestedQuestions: [],
        createdAt: new Date().toISOString(),
      };

      set({
        activeConversation: {
          id: '',
          userId: identity.id,
          title: query.substring(0, 100),
          status: 'active',
          messages: [optimisticUserMessage, streamingAssistantMessage],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      });

      // Use streaming API with callbacks
      const response = await searchService.agentSearchStream(
        query,
        identity,
        {
          onStatus: (text) => {
            set({ streamStatus: text });
          },

          onCategory: (category) => {
            // Map raw DB products to client-side SearchProduct
            const clientCategory: SearchCategory = {
              id: category.id,
              conversationId: '', // Will be updated on done
              messageId: '',
              label: category.label,
              searchQuery: '',
              description: category.description || null,
              sortOrder: get().activeConversation?.messages
                .find((m) => m.id.startsWith('streaming-'))
                ?.categories?.length || 0,
              products: (category.products as Array<Record<string, unknown>>).map(
                (p) => mapDbProduct(p, category.id)
              ),
              createdAt: new Date().toISOString(),
            };

            // Append category to the streaming assistant message
            set((state) => {
              if (!state.activeConversation) return state;

              const messages = state.activeConversation.messages.map((msg) => {
                if (msg.id.startsWith('streaming-')) {
                  return {
                    ...msg,
                    categories: [...(msg.categories || []), clientCategory],
                  };
                }
                return msg;
              });

              return {
                activeConversation: {
                  ...state.activeConversation,
                  messages,
                },
              };
            });
          },

          onSummary: (data: Record<string, unknown>) => {
            set((state) => {
              if (!state.activeConversation) return state;

              const messages = state.activeConversation.messages.map((msg) => {
                if (msg.id.startsWith('streaming-')) {
                  return {
                    ...msg,
                    content: (data.content as string) || '',
                    recommendations: (data.recommendations as ProductRecommendation[]) || [],
                    followUpQuestion: (data.followUpQuestion as string) || null,
                    followUpOptions: (data.followUpOptions as string[]) || [],
                  };
                }
                return msg;
              });

              return {
                activeConversation: {
                  ...state.activeConversation,
                  messages,
                },
                suggestedQuestions: [], // deprecated
                streamStatus: null,
              };
            });
          },

          onDone: (data) => {
            // Finalize: update IDs and conversation metadata
            set((state) => {
              if (!state.activeConversation) return state;

              const messages = state.activeConversation.messages.map((msg) => {
                if (msg.id === optimisticUserMessage.id) {
                  return { ...msg, conversationId: data.conversationId };
                }
                if (msg.id.startsWith('streaming-')) {
                  return {
                    ...msg,
                    id: data.messageId,
                    conversationId: data.conversationId,
                  };
                }
                return msg;
              });

              const conversation: Conversation = {
                ...state.activeConversation,
                id: data.conversationId,
                messages,
                updatedAt: new Date().toISOString(),
              };

              return {
                activeConversation: conversation,
                isSearching: false,
                streamStatus: null,
                lastRateLimitInfo: data.rateLimit || null,
                conversations: [conversation, ...state.conversations.filter((c) => c.id !== data.conversationId)],
              };
            });
          },

          onError: (message) => {
            set({
              isSearching: false,
              streamStatus: null,
              error: message,
            });
          },
        }
      );
    } catch (error) {
      console.error('Search failed:', error);
      set({
        isSearching: false,
        streamStatus: null,
        error: error instanceof Error ? error.message : 'Search failed. Please try again.',
      });
      throw error;
    }
  },

  sendFollowUp: async (conversationId: string, query: string, identity: Identity) => {
    const { activeConversation } = get();
    if (!activeConversation) {
      throw new Error('No active conversation');
    }

    set({ isSearching: true, error: null, streamStatus: null, suggestedQuestions: [] });

    try {
      // Add optimistic user message
      const optimisticUserMessage: Message = {
        id: `temp-${Date.now()}`,
        conversationId,
        role: 'user',
        content: query,
        createdAt: new Date().toISOString(),
      };

      // Create streaming assistant placeholder
      const streamingAssistantMessage: Message = {
        id: `streaming-followup-${Date.now()}`,
        conversationId,
        role: 'assistant',
        content: '',
        categories: [],
        suggestedQuestions: [],
        createdAt: new Date().toISOString(),
      };

      set((state) => ({
        activeConversation: state.activeConversation
          ? {
              ...state.activeConversation,
              messages: [
                ...state.activeConversation.messages,
                optimisticUserMessage,
                streamingAssistantMessage,
              ],
            }
          : null,
      }));

      await searchService.agentSearchStream(
        query,
        identity,
        {
          onStatus: (text) => {
            set({ streamStatus: text });
          },

          onCategory: (category) => {
            const clientCategory: SearchCategory = {
              id: category.id,
              conversationId,
              messageId: '',
              label: category.label,
              searchQuery: '',
              description: category.description || null,
              sortOrder: 0,
              products: (category.products as Array<Record<string, unknown>>).map(
                (p) => mapDbProduct(p, category.id)
              ),
              createdAt: new Date().toISOString(),
            };

            set((state) => {
              if (!state.activeConversation) return state;

              const messages = state.activeConversation.messages.map((msg) => {
                if (msg.id.startsWith('streaming-followup-')) {
                  return {
                    ...msg,
                    categories: [...(msg.categories || []), clientCategory],
                  };
                }
                return msg;
              });

              return {
                activeConversation: {
                  ...state.activeConversation,
                  messages,
                },
              };
            });
          },

          onSummary: (data: Record<string, unknown>) => {
            set((state) => {
              if (!state.activeConversation) return state;

              const messages = state.activeConversation.messages.map((msg) => {
                if (msg.id.startsWith('streaming-followup-')) {
                  return {
                    ...msg,
                    content: (data.content as string) || '',
                    recommendations: (data.recommendations as ProductRecommendation[]) || [],
                    followUpQuestion: (data.followUpQuestion as string) || null,
                    followUpOptions: (data.followUpOptions as string[]) || [],
                  };
                }
                return msg;
              });

              return {
                activeConversation: {
                  ...state.activeConversation,
                  messages,
                },
                suggestedQuestions: [],
                streamStatus: null,
              };
            });
          },

          onDone: (data) => {
            set((state) => {
              if (!state.activeConversation) return state;

              const messages = state.activeConversation.messages.map((msg) => {
                if (msg.id.startsWith('streaming-followup-')) {
                  return {
                    ...msg,
                    id: data.messageId,
                    conversationId: data.conversationId,
                  };
                }
                return msg;
              });

              const updated: Conversation = {
                ...state.activeConversation,
                messages,
                updatedAt: new Date().toISOString(),
              };

              return {
                activeConversation: updated,
                isSearching: false,
                streamStatus: null,
                lastRateLimitInfo: data.rateLimit || null,
                conversations: state.conversations.map((c) =>
                  c.id === conversationId ? updated : c
                ),
              };
            });
          },

          onError: (message) => {
            set({
              isSearching: false,
              streamStatus: null,
              error: message,
            });
          },
        },
        conversationId
      );
    } catch (error) {
      console.error('Follow-up failed:', error);
      // Remove optimistic messages on error
      set((state) => ({
        isSearching: false,
        streamStatus: null,
        error: error instanceof Error ? error.message : 'Follow-up failed. Please try again.',
        activeConversation: state.activeConversation
          ? {
              ...state.activeConversation,
              messages: state.activeConversation.messages.filter(
                (m) => !m.id.startsWith('temp-') && !m.id.startsWith('streaming-')
              ),
            }
          : null,
      }));
      throw error;
    }
  },

  fetchConversations: async (userId: string) => {
    try {
      const { conversations } = await conversationService.fetchConversations(userId);
      set({ conversations });
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
    }
  },

  loadConversation: async (conversationId: string) => {
    try {
      const conversation = await conversationService.getConversationById(conversationId);
      if (conversation) {
        const lastAssistantMsg = [...conversation.messages]
          .reverse()
          .find((m) => m.role === 'assistant');
        const suggestedQuestions = lastAssistantMsg?.suggestedQuestions || [];

        set({ activeConversation: conversation, suggestedQuestions });
      }
    } catch (error) {
      console.error('Failed to load conversation:', error);
    }
  },

  deleteConversation: async (conversationId: string) => {
    try {
      // Optimistic removal
      set((state) => ({
        conversations: state.conversations.filter((c) => c.id !== conversationId),
        activeConversation:
          state.activeConversation?.id === conversationId ? null : state.activeConversation,
      }));

      await conversationService.deleteConversation(conversationId);
    } catch (error) {
      console.error('Failed to delete conversation:', error);
    }
  },

  clearActiveConversation: () => {
    set({ activeConversation: null, suggestedQuestions: [], error: null, streamStatus: null });
  },

  reset: () => {
    set({
      conversations: [],
      activeConversation: null,
      isSearching: false,
      streamStatus: null,
      suggestedQuestions: [],
      error: null,
      lastRateLimitInfo: null,
    });
  },
}));

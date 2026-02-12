import { create } from 'zustand';
import { conversationService, searchService } from '@/utils/supabase-service';
import { trackSearch } from '@/utils/ads-analytics';
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
    isFavorite: (p.is_favorite as boolean) ?? false,
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
      isFavorite: false,
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
    recommendations: response.recommendations,
    followUpQuestion: response.followUpQuestion,
    followUpOptions: response.followUpOptions,
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
  /** Loading state while fetching an existing conversation from DB */
  isLoadingConversation: boolean;
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
  toggleConversationFavorite: (conversationId: string) => Promise<void>;
  renameConversation: (conversationId: string, title: string) => Promise<void>;
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
  isLoadingConversation: false,
  streamStatus: null,
  suggestedQuestions: [],
  error: null,
  lastRateLimitInfo: null,

  startSearch: async (query: string, identity: Identity) => {
    set({ isSearching: true, error: null, streamStatus: null, suggestedQuestions: [] });

    // Track search event for ads attribution
    trackSearch(query);

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
          isFavorite: false,
          messages: [optimisticUserMessage, streamingAssistantMessage],
          thumbnailUrl: null,
          totalCategories: 0,
          totalProducts: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      });

      // Use streaming API with callbacks
      await searchService.agentSearchStream(
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
                  // Update both conversationId AND id so cleanup won't strip this message
                  return {
                    ...msg,
                    id: `user-${data.conversationId}-${Date.now()}`,
                    conversationId: data.conversationId,
                  };
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

              // Compute summary fields for instant display on home screen
              let totalCategories = 0;
              let totalProducts = 0;
              let thumbnailUrl: string | null = state.activeConversation.thumbnailUrl;

              for (const msg of messages) {
                if (msg.categories) {
                  totalCategories += msg.categories.length;
                  for (const cat of msg.categories) {
                    totalProducts += cat.products?.length || 0;
                  }
                  // Use the first product image from the first category as thumbnail
                  if (!thumbnailUrl && msg.categories.length > 0) {
                    const firstCat = msg.categories[0];
                    const withImage = firstCat.products?.find((p) => p.imageUrl);
                    if (withImage) thumbnailUrl = withImage.imageUrl;
                  }
                }
              }

              const conversation: Conversation = {
                ...state.activeConversation,
                id: data.conversationId,
                messages,
                thumbnailUrl,
                totalCategories,
                totalProducts,
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
            // Clean up optimistic messages on SSE error
            set((state) => ({
              isSearching: false,
              streamStatus: null,
              error: message,
              activeConversation: null, // Reset to show empty search on error
            }));
          },
        }
      );

      // Safety net: if onDone didn't fire (e.g. server closed stream without
      // sending done event), ensure isSearching is reset so the UI isn't stuck.
      if (get().isSearching) {
        console.warn('startSearch: stream resolved without onDone — resetting state');
        set({ isSearching: false, streamStatus: null });
      }
    } catch (error) {
      console.error('Search failed:', error);
      // Clean up optimistic messages and reset conversation on failure
      set({
        isSearching: false,
        streamStatus: null,
        error: error instanceof Error ? error.message : 'Search failed. Please try again.',
        activeConversation: null,
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

    // Track follow-up search event for ads attribution
    trackSearch(query);

    // Track exact IDs so error cleanup only removes THIS follow-up's messages
    const now = Date.now();
    const optimisticUserId = `temp-followup-${now}`;
    const streamingAssistantId = `streaming-followup-${now}`;

    try {
      // Add optimistic user message
      const optimisticUserMessage: Message = {
        id: optimisticUserId,
        conversationId,
        role: 'user',
        content: query,
        createdAt: new Date().toISOString(),
      };

      // Create streaming assistant placeholder
      const streamingAssistantMessage: Message = {
        id: streamingAssistantId,
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
                if (msg.id === streamingAssistantId) {
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
                if (msg.id === streamingAssistantId) {
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
                if (msg.id === optimisticUserId) {
                  // Finalize user message ID so it won't be caught by cleanup filters
                  return {
                    ...msg,
                    id: `user-${data.conversationId}-${Date.now()}`,
                    conversationId: data.conversationId,
                  };
                }
                if (msg.id === streamingAssistantId) {
                  return {
                    ...msg,
                    id: data.messageId,
                    conversationId: data.conversationId,
                  };
                }
                return msg;
              });

              // Recompute summary totals
              let totalCategories = 0;
              let totalProducts = 0;
              for (const msg of messages) {
                if (msg.categories) {
                  totalCategories += msg.categories.length;
                  for (const cat of msg.categories) {
                    totalProducts += cat.products?.length || 0;
                  }
                }
              }

              const updated: Conversation = {
                ...state.activeConversation,
                messages,
                totalCategories,
                totalProducts,
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
            // Clean up only this follow-up's optimistic messages on SSE error
            set((state) => ({
              isSearching: false,
              streamStatus: null,
              error: message,
              activeConversation: state.activeConversation
                ? {
                    ...state.activeConversation,
                    messages: state.activeConversation.messages.filter(
                      (m) => m.id !== optimisticUserId && m.id !== streamingAssistantId
                    ),
                  }
                : null,
            }));
          },
        },
        conversationId
      );

      // Safety net: if onDone didn't fire, ensure isSearching is reset
      if (get().isSearching) {
        console.warn('sendFollowUp: stream resolved without onDone — resetting state');
        set((state) => ({
          isSearching: false,
          streamStatus: null,
          activeConversation: state.activeConversation
            ? {
                ...state.activeConversation,
                messages: state.activeConversation.messages.filter(
                  (m) => m.id !== optimisticUserId && m.id !== streamingAssistantId
                ),
              }
            : null,
        }));
      }
    } catch (error) {
      console.error('Follow-up failed:', error);
      // Remove only this follow-up's optimistic messages on error (preserve prior messages)
      set((state) => ({
        isSearching: false,
        streamStatus: null,
        error: error instanceof Error ? error.message : 'Follow-up failed. Please try again.',
        activeConversation: state.activeConversation
          ? {
              ...state.activeConversation,
              messages: state.activeConversation.messages.filter(
                (m) => m.id !== optimisticUserId && m.id !== streamingAssistantId
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
    set({ isLoadingConversation: true });
    try {
      const conversation = await conversationService.getConversationById(conversationId);
      if (conversation) {
        const lastAssistantMsg = [...conversation.messages]
          .reverse()
          .find((m) => m.role === 'assistant');
        const suggestedQuestions = lastAssistantMsg?.suggestedQuestions || [];

        set({ activeConversation: conversation, suggestedQuestions, isLoadingConversation: false });
      } else {
        set({ isLoadingConversation: false });
      }
    } catch (error) {
      console.error('Failed to load conversation:', error);
      set({ isLoadingConversation: false });
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

  toggleConversationFavorite: async (conversationId: string) => {
    // Optimistic toggle
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === conversationId ? { ...c, isFavorite: !c.isFavorite } : c
      ),
      activeConversation:
        state.activeConversation?.id === conversationId
          ? { ...state.activeConversation, isFavorite: !state.activeConversation.isFavorite }
          : state.activeConversation,
    }));

    try {
      await conversationService.toggleFavorite(conversationId);
    } catch (error) {
      console.error('Failed to toggle conversation favorite:', error);
      // Revert on failure
      set((state) => ({
        conversations: state.conversations.map((c) =>
          c.id === conversationId ? { ...c, isFavorite: !c.isFavorite } : c
        ),
        activeConversation:
          state.activeConversation?.id === conversationId
            ? { ...state.activeConversation, isFavorite: !state.activeConversation.isFavorite }
            : state.activeConversation,
      }));
    }
  },

  renameConversation: async (conversationId: string, title: string) => {
    const trimmed = title.trim();
    if (!trimmed) return;

    // Optimistic update
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === conversationId ? { ...c, title: trimmed } : c
      ),
      activeConversation:
        state.activeConversation?.id === conversationId
          ? { ...state.activeConversation, title: trimmed }
          : state.activeConversation,
    }));

    try {
      await conversationService.renameConversation(conversationId, trimmed);
    } catch (error) {
      console.error('Failed to rename conversation:', error);
    }
  },

  clearActiveConversation: () => {
    set({ activeConversation: null, suggestedQuestions: [], error: null, streamStatus: null, isLoadingConversation: false });
  },

  reset: () => {
    set({
      conversations: [],
      activeConversation: null,
      isSearching: false,
      isLoadingConversation: false,
      streamStatus: null,
      suggestedQuestions: [],
      error: null,
      lastRateLimitInfo: null,
    });
  },
}));

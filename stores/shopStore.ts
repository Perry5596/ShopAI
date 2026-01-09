import { create } from 'zustand';
import { shopService, productService, profileService } from '@/utils/supabase-service';
import type { Shop, SnapResult } from '@/types';

/**
 * Parse a price string like "$129.99" to cents (12999)
 */
function parsePriceToCents(priceStr: string): number {
  // Remove currency symbols and parse
  const cleaned = priceStr.replace(/[^0-9.]/g, '');
  const parsed = parseFloat(cleaned);
  if (isNaN(parsed)) return 0;
  return Math.round(parsed * 100);
}

/**
 * Calculate savings: average price - lowest price (in cents)
 */
function calculateSavings(prices: number[]): number {
  if (prices.length < 2) return 0;
  const total = prices.reduce((sum, p) => sum + p, 0);
  const average = total / prices.length;
  const lowest = Math.min(...prices);
  return Math.max(0, Math.round(average - lowest));
}

const PAGE_SIZE = 8;

interface ShopState {
  shops: Shop[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  error: string | null;

  // Actions
  fetchShops: (userId: string) => Promise<void>;
  fetchMoreShops: (userId: string) => Promise<void>;
  getShopById: (id: string) => Shop | undefined;
  addShop: (shop: Shop) => void;
  updateShop: (id: string, updates: Partial<Shop>) => void;
  deleteShop: (id: string, userId: string) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;

  // Process shop results (called when AI/dummy data returns)
  completeShopProcessing: (shopId: string, userId: string, result: SnapResult) => Promise<void>;
  failShopProcessing: (shopId: string, error: string) => Promise<void>;

  // Reset state
  reset: () => void;
}

export const useShopStore = create<ShopState>((set, get) => ({
  shops: [],
  isLoading: false,
  isLoadingMore: false,
  hasMore: true,
  error: null,

  fetchShops: async (userId: string) => {
    set({ isLoading: true, error: null });
    try {
      const { shops, hasMore } = await shopService.fetchUserShops(userId, PAGE_SIZE, 0);
      set({ shops, hasMore, isLoading: false });
    } catch (error) {
      console.error('Failed to fetch shops:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch shops',
        isLoading: false,
        hasMore: false,
      });
    }
  },

  fetchMoreShops: async (userId: string) => {
    const { isLoadingMore, hasMore, shops } = get();
    
    // Don't fetch if already loading or no more items
    if (isLoadingMore || !hasMore) return;

    set({ isLoadingMore: true });
    try {
      const { shops: newShops, hasMore: moreAvailable } = await shopService.fetchUserShops(
        userId,
        PAGE_SIZE,
        shops.length
      );
      
      set({
        shops: [...shops, ...newShops],
        hasMore: moreAvailable,
        isLoadingMore: false,
      });
    } catch (error) {
      console.error('Failed to fetch more shops:', error);
      set({ isLoadingMore: false });
    }
  },

  getShopById: (id: string) => {
    return get().shops.find((shop) => shop.id === id);
  },

  addShop: (shop: Shop) => {
    set((state) => ({
      shops: [shop, ...state.shops],
    }));
  },

  updateShop: (id: string, updates: Partial<Shop>) => {
    set((state) => ({
      shops: state.shops.map((shop) =>
        shop.id === id ? { ...shop, ...updates, updatedAt: new Date().toISOString() } : shop
      ),
    }));
  },

  deleteShop: async (id: string, userId: string) => {
    try {
      // Remove from local state immediately for responsiveness
      set((state) => ({
        shops: state.shops.filter((shop) => shop.id !== id),
      }));

      // Delete from database
      await shopService.deleteShop(id);

      // Note: Storage cleanup would be handled here if needed
      // await storageService.deleteShopImage(userId, id);
    } catch (error) {
      console.error('Failed to delete shop:', error);
      // Re-fetch shops to restore state on error
      get().fetchShops(userId);
      throw error;
    }
  },

  toggleFavorite: async (id: string) => {
    const shop = get().getShopById(id);
    if (!shop) return;

    const newIsFavorite = !shop.isFavorite;

    // Optimistic update
    set((state) => ({
      shops: state.shops.map((s) =>
        s.id === id ? { ...s, isFavorite: newIsFavorite } : s
      ),
    }));

    try {
      await shopService.updateShop(id, { isFavorite: newIsFavorite });
    } catch (error) {
      // Revert on error
      set((state) => ({
        shops: state.shops.map((s) =>
          s.id === id ? { ...s, isFavorite: !newIsFavorite } : s
        ),
      }));
      console.error('Failed to toggle favorite:', error);
      throw error;
    }
  },

  completeShopProcessing: async (shopId: string, userId: string, result: SnapResult) => {
    try {
      // Create products in database with recommended flag
      const productsToCreate = result.products.map((p, index) => ({
        ...p,
        isRecommended: index === result.recommendedIndex,
      }));

      const createdProducts = await productService.createProducts(shopId, productsToCreate);

      // Calculate savings (average - lowest price in cents)
      const prices = result.products.map((p) => parsePriceToCents(p.price));
      const savings = calculateSavings(prices);

      // Update shop in database with savings
      await shopService.updateShop(shopId, {
        title: result.title,
        description: result.description,
        status: 'completed',
        savings,
      });

      // Increment user's lifetime stats
      await profileService.incrementStats(userId, {
        shops: 1,
        products: createdProducts.length,
        savings,
      });

      // Find the recommendation
      const recommendation = createdProducts.find((p) => p.isRecommended);

      // Update local state
      set((state) => ({
        shops: state.shops.map((shop) =>
          shop.id === shopId
            ? {
                ...shop,
                title: result.title,
                description: result.description,
                status: 'completed' as const,
                savings,
                products: createdProducts,
                recommendation,
                updatedAt: new Date().toISOString(),
              }
            : shop
        ),
      }));
    } catch (error) {
      console.error('Failed to complete shop processing:', error);
      // Mark as failed if we can't save the results
      await get().failShopProcessing(
        shopId,
        error instanceof Error ? error.message : 'Failed to save results'
      );
    }
  },

  failShopProcessing: async (shopId: string, errorMessage: string) => {
    try {
      await shopService.updateShop(shopId, { status: 'failed' });
    } catch (error) {
      console.error('Failed to update shop status to failed:', error);
    }

    set((state) => ({
      shops: state.shops.map((shop) =>
        shop.id === shopId
          ? {
              ...shop,
              status: 'failed' as const,
              description: errorMessage,
              updatedAt: new Date().toISOString(),
            }
          : shop
      ),
    }));
  },

  reset: () => {
    set({ shops: [], isLoading: false, isLoadingMore: false, hasMore: true, error: null });
  },
}));

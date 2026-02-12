import { supabase } from '@/utils/supabase';

// ============================================================================
// Raw Data Types (lightweight projections for analytics)
// ============================================================================

export interface ShopAnalyticsRow {
  created_at: string;
  savings: number;
  status: string;
}

export interface ProductAnalyticsRow {
  price: string | null;
  source: string;
  is_favorite: boolean;
  created_at: string;
}

export interface ConversationAnalyticsRow {
  created_at: string;
  total_products: number;
  total_categories: number;
}

export interface SearchProductAnalyticsRow {
  price: string | null;
  source: string;
  brand: string | null;
  is_favorite: boolean;
  created_at: string;
}

export interface SearchCategoryAnalyticsRow {
  label: string;
  created_at: string;
}

export interface UserAnalyticsRow {
  scan_count: number;
  link_click_count: number;
  text_search_count: number;
}

export interface AnalyticsRawData {
  shops: ShopAnalyticsRow[];
  products: ProductAnalyticsRow[];
  conversations: ConversationAnalyticsRow[];
  searchProducts: SearchProductAnalyticsRow[];
  searchCategories: SearchCategoryAnalyticsRow[];
  userAnalytics: UserAnalyticsRow | null;
}

// ============================================================================
// Analytics Data Service
// ============================================================================

export const analyticsDataService = {
  /**
   * Fetch all raw analytics data for a user in parallel.
   * Returns lightweight projections optimized for client-side processing.
   */
  async fetchAllAnalyticsData(userId: string): Promise<AnalyticsRawData> {
    const [
      shopsResult,
      productsResult,
      conversationsResult,
      searchDataResult,
      userAnalyticsResult,
    ] = await Promise.all([
      // 1. Shops timeline
      supabase
        .from('shops')
        .select('created_at, savings, status')
        .eq('user_id', userId)
        .order('created_at', { ascending: true }),

      // 2. Products (joined through user's shops)
      fetchUserProducts(userId),

      // 3. Conversations timeline
      supabase
        .from('conversations')
        .select('created_at, total_products, total_categories')
        .eq('user_id', userId)
        .order('created_at', { ascending: true }),

      // 4. Search products + categories (joined through conversations)
      fetchUserSearchData(userId),

      // 5. User analytics counters
      supabase
        .from('user_analytics')
        .select('scan_count, link_click_count, text_search_count')
        .eq('user_id', userId)
        .maybeSingle(),
    ]);

    if (shopsResult.error) throw shopsResult.error;
    if (conversationsResult.error) throw conversationsResult.error;
    if (userAnalyticsResult.error) throw userAnalyticsResult.error;

    return {
      shops: (shopsResult.data as ShopAnalyticsRow[]) || [],
      products: productsResult.products,
      conversations: (conversationsResult.data as ConversationAnalyticsRow[]) || [],
      searchProducts: searchDataResult.searchProducts,
      searchCategories: searchDataResult.searchCategories,
      userAnalytics: (userAnalyticsResult.data as UserAnalyticsRow) || null,
    };
  },
};

// ============================================================================
// Helper: Fetch products through user's shops
// ============================================================================

async function fetchUserProducts(
  userId: string
): Promise<{ products: ProductAnalyticsRow[] }> {
  // Get all shop IDs for this user
  const { data: shopData, error: shopError } = await supabase
    .from('shops')
    .select('id')
    .eq('user_id', userId);

  if (shopError) throw shopError;
  if (!shopData || shopData.length === 0) return { products: [] };

  const shopIds = shopData.map((s: { id: string }) => s.id);

  // Fetch products for those shops
  const { data: productData, error: prodError } = await supabase
    .from('products')
    .select('price, source, is_favorite, created_at')
    .in('shop_id', shopIds)
    .order('created_at', { ascending: true });

  if (prodError) throw prodError;

  return {
    products: (productData as ProductAnalyticsRow[]) || [],
  };
}

// ============================================================================
// Helper: Fetch search products + categories through conversations
// ============================================================================

async function fetchUserSearchData(userId: string): Promise<{
  searchProducts: SearchProductAnalyticsRow[];
  searchCategories: SearchCategoryAnalyticsRow[];
}> {
  // Get all conversation IDs for this user
  const { data: convData, error: convError } = await supabase
    .from('conversations')
    .select('id')
    .eq('user_id', userId);

  if (convError) throw convError;
  if (!convData || convData.length === 0) {
    return { searchProducts: [], searchCategories: [] };
  }

  const conversationIds = convData.map((c: { id: string }) => c.id);

  // Fetch categories for these conversations
  const { data: catData, error: catError } = await supabase
    .from('search_categories')
    .select('id, label, created_at')
    .in('conversation_id', conversationIds)
    .order('created_at', { ascending: true });

  if (catError) throw catError;

  const categories = (catData || []) as (SearchCategoryAnalyticsRow & { id: string })[];
  const categoryIds = categories.map((c) => c.id);

  if (categoryIds.length === 0) {
    return {
      searchProducts: [],
      searchCategories: categories.map(({ label, created_at }) => ({ label, created_at })),
    };
  }

  // Fetch search products for these categories
  const { data: prodData, error: prodError } = await supabase
    .from('search_products')
    .select('price, source, brand, is_favorite, created_at')
    .in('category_id', categoryIds)
    .order('created_at', { ascending: true });

  if (prodError) throw prodError;

  return {
    searchProducts: (prodData as SearchProductAnalyticsRow[]) || [],
    searchCategories: categories.map(({ label, created_at }) => ({ label, created_at })),
  };
}

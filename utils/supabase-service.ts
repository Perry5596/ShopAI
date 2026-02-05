import { File } from 'expo-file-system';
import { supabase } from './supabase';
import type {
  UserProfile,
  Shop,
  ProductLink,
  DbShop,
  DbProduct,
  DbProfile,
  ShopStatus,
  RateLimitStatus,
  RateLimitIncrementResult,
} from '@/types';

// ============================================================================
// Type Converters
// ============================================================================

function dbShopToShop(dbShop: DbShop, products: ProductLink[] = []): Shop {
  const recommendation = products.find((p) => p.isRecommended);
  return {
    id: dbShop.id,
    userId: dbShop.user_id,
    imageUrl: dbShop.image_url,
    title: dbShop.title,
    description: dbShop.description ?? undefined,
    createdAt: dbShop.created_at,
    updatedAt: dbShop.updated_at,
    isFavorite: dbShop.is_favorite,
    status: dbShop.status,
    savings: dbShop.savings ?? 0,
    products,
    recommendation,
  };
}

function dbProductToProductLink(dbProduct: DbProduct): ProductLink {
  return {
    id: dbProduct.id,
    shopId: dbProduct.shop_id,
    title: dbProduct.title,
    price: dbProduct.price ?? undefined,
    imageUrl: dbProduct.image_url ?? undefined,
    affiliateUrl: dbProduct.affiliate_url,
    source: dbProduct.source,
    isRecommended: dbProduct.is_recommended,
    rating: dbProduct.rating ?? undefined,
    reviewCount: dbProduct.review_count ?? undefined,
  };
}

function dbProfileToUserProfile(dbProfile: DbProfile): UserProfile {
  return {
    id: dbProfile.id,
    email: dbProfile.email ?? '',
    name: dbProfile.name ?? 'User',
    username: dbProfile.username ?? undefined,
    avatarUrl: dbProfile.avatar_url ?? undefined,
    isPremium: dbProfile.is_premium,
    totalShops: dbProfile.total_shops ?? 0,
    totalProducts: dbProfile.total_products ?? 0,
    totalSavings: dbProfile.total_savings ?? 0,
    favoriteAmazon: dbProfile.favorite_amazon ?? false,
    favoriteTarget: dbProfile.favorite_target ?? false,
    favoriteBestBuy: dbProfile.favorite_best_buy ?? false,
    favoriteWalmart: dbProfile.favorite_walmart ?? false,
    favoriteEbay: dbProfile.favorite_ebay ?? false,
    notificationsEnabled: dbProfile.notifications_enabled ?? true,
    pushToken: dbProfile.push_token ?? undefined,
    lastActivityAt: dbProfile.last_activity_at ?? undefined,
    currentStreak: dbProfile.current_streak ?? 0,
    lastActiveDate: dbProfile.last_active_date ?? undefined,
    createdAt: dbProfile.created_at,
    updatedAt: dbProfile.updated_at,
  };
}

// ============================================================================
// Profile Service
// ============================================================================

export const profileService = {
  async getProfile(userId: string): Promise<UserProfile | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned
        return null;
      }
      throw error;
    }

    return dbProfileToUserProfile(data as DbProfile);
  },

  async upsertProfile(
    userId: string,
    profile: Partial<Omit<UserProfile, 'id'>>
  ): Promise<UserProfile> {
    const { data, error } = await supabase
      .from('profiles')
      .upsert({
        id: userId,
        email: profile.email,
        name: profile.name,
        username: profile.username,
        avatar_url: profile.avatarUrl,
        is_premium: profile.isPremium,
        favorite_amazon: profile.favoriteAmazon,
        favorite_target: profile.favoriteTarget,
        favorite_best_buy: profile.favoriteBestBuy,
        favorite_walmart: profile.favoriteWalmart,
        favorite_ebay: profile.favoriteEbay,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return dbProfileToUserProfile(data as DbProfile);
  },

  /**
   * Increment lifetime stats for a user (these only go up, never down)
   * Called when a shop is completed successfully
   */
  async incrementStats(
    userId: string,
    stats: { shops?: number; products?: number; savings?: number }
  ): Promise<void> {
    // Use RPC or raw SQL to atomically increment
    // For now, we'll fetch and update (not ideal but works)
    const { data: profile, error: fetchError } = await supabase
      .from('profiles')
      .select('total_shops, total_products, total_savings')
      .eq('id', userId)
      .single();

    if (fetchError) throw fetchError;

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        total_shops: (profile?.total_shops ?? 0) + (stats.shops ?? 0),
        total_products: (profile?.total_products ?? 0) + (stats.products ?? 0),
        total_savings: (profile?.total_savings ?? 0) + (stats.savings ?? 0),
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (updateError) throw updateError;
  },

  /**
   * Update favorite stores for a user
   */
  async updateFavoriteStores(
    userId: string,
    stores: {
      amazon?: boolean;
      target?: boolean;
      bestBuy?: boolean;
      walmart?: boolean;
      ebay?: boolean;
    }
  ): Promise<UserProfile> {
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (stores.amazon !== undefined) updateData.favorite_amazon = stores.amazon;
    if (stores.target !== undefined) updateData.favorite_target = stores.target;
    if (stores.bestBuy !== undefined) updateData.favorite_best_buy = stores.bestBuy;
    if (stores.walmart !== undefined) updateData.favorite_walmart = stores.walmart;
    if (stores.ebay !== undefined) updateData.favorite_ebay = stores.ebay;

    const { data, error } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;
    return dbProfileToUserProfile(data as DbProfile);
  },

  /**
   * Update push notification token for a user
   */
  async updatePushToken(userId: string, pushToken: string | null): Promise<void> {
    const { error } = await supabase
      .from('profiles')
      .update({
        push_token: pushToken,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (error) throw error;
  },

  /**
   * Update notifications enabled preference for a user
   */
  async updateNotificationsEnabled(userId: string, enabled: boolean): Promise<UserProfile> {
    const { data, error } = await supabase
      .from('profiles')
      .update({
        notifications_enabled: enabled,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;
    return dbProfileToUserProfile(data as DbProfile);
  },

  /**
   * Update last activity timestamp for a user
   * Called when the app becomes active to track user engagement
   */
  async updateLastActivity(userId: string): Promise<void> {
    // Use the RPC function for atomic update
    const { error } = await supabase.rpc('update_last_activity', {
      p_user_id: userId,
    });

    if (error) {
      // Fallback to direct update if RPC fails
      console.warn('RPC update_last_activity failed, using direct update:', error);
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          last_activity_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (updateError) throw updateError;
    }
  },

  /**
   * Update daily streak for a user
   * Called when the app becomes active to track consecutive usage days
   * 
   * Logic:
   * - If today matches lastActiveDate: do nothing (already counted)
   * - If yesterday equals lastActiveDate: increment streak, update date
   * - If more than 1 day gap: reset streak to 1, update date
   */
  async updateStreak(userId: string): Promise<{ streak: number; updated: boolean }> {
    // Fetch current streak data
    const { data: profile, error: fetchError } = await supabase
      .from('profiles')
      .select('current_streak, last_active_date')
      .eq('id', userId)
      .single();

    if (fetchError) throw fetchError;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    const lastActiveDate = profile?.last_active_date;
    const currentStreak = profile?.current_streak ?? 0;

    // If already active today, don't update
    if (lastActiveDate === todayStr) {
      return { streak: currentStreak, updated: false };
    }

    let newStreak: number;

    if (lastActiveDate) {
      const lastDate = new Date(lastActiveDate);
      lastDate.setHours(0, 0, 0, 0);
      
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      // Check if last active was yesterday
      if (lastDate.getTime() === yesterday.getTime()) {
        // Consecutive day - increment streak
        newStreak = currentStreak + 1;
      } else {
        // Gap in usage - reset streak
        newStreak = 1;
      }
    } else {
      // First time user - start streak at 1
      newStreak = 1;
    }

    // Update the database
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        current_streak: newStreak,
        last_active_date: todayStr,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (updateError) throw updateError;

    return { streak: newStreak, updated: true };
  },
};

// ============================================================================
// Shop Service
// ============================================================================

export const shopService = {
  /**
   * Fetch user shops with pagination support
   * @param userId - User ID to fetch shops for
   * @param limit - Number of shops to fetch (default 8)
   * @param offset - Number of shops to skip (default 0)
   * @returns Object containing shops array and hasMore boolean
   */
  async fetchUserShops(
    userId: string,
    limit = 8,
    offset = 0
  ): Promise<{ shops: Shop[]; hasMore: boolean }> {
    // Fetch shops with limit + 1 to check if there are more
    const { data: shopsData, error: shopsError } = await supabase
      .from('shops')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit); // Fetch limit + 1 to check hasMore

    if (shopsError) throw shopsError;
    if (!shopsData || shopsData.length === 0) return { shops: [], hasMore: false };

    // Check if there are more items
    const hasMore = shopsData.length > limit;
    const shopsToProcess = hasMore ? shopsData.slice(0, limit) : shopsData;

    // Fetch all products for these shops
    const shopIds = shopsToProcess.map((s) => s.id);
    const { data: productsData, error: productsError } = await supabase
      .from('products')
      .select('*')
      .in('shop_id', shopIds);

    if (productsError) throw productsError;

    // Group products by shop_id
    const productsByShopId: Record<string, ProductLink[]> = {};
    (productsData as DbProduct[])?.forEach((p) => {
      if (!productsByShopId[p.shop_id]) {
        productsByShopId[p.shop_id] = [];
      }
      productsByShopId[p.shop_id].push(dbProductToProductLink(p));
    });

    // Convert to Shop objects
    const shops = (shopsToProcess as DbShop[]).map((dbShop) =>
      dbShopToShop(dbShop, productsByShopId[dbShop.id] || [])
    );

    return { shops, hasMore };
  },

  async getShopById(shopId: string): Promise<Shop | null> {
    const { data: shopData, error: shopError } = await supabase
      .from('shops')
      .select('*')
      .eq('id', shopId)
      .single();

    if (shopError) {
      if (shopError.code === 'PGRST116') return null;
      throw shopError;
    }

    // Fetch products for this shop
    const { data: productsData, error: productsError } = await supabase
      .from('products')
      .select('*')
      .eq('shop_id', shopId);

    if (productsError) throw productsError;

    const products = (productsData as DbProduct[])?.map(dbProductToProductLink) || [];
    return dbShopToShop(shopData as DbShop, products);
  },

  async createShop(
    userId: string,
    shop: {
      imageUrl: string;
      title: string;
      description?: string;
      status?: ShopStatus;
    }
  ): Promise<Shop> {
    const { data, error } = await supabase
      .from('shops')
      .insert({
        user_id: userId,
        image_url: shop.imageUrl,
        title: shop.title,
        description: shop.description,
        status: shop.status || 'processing',
        is_favorite: false,
      })
      .select()
      .single();

    if (error) throw error;
    return dbShopToShop(data as DbShop, []);
  },

  async updateShop(
    shopId: string,
    updates: Partial<{
      title: string;
      description: string;
      isFavorite: boolean;
      status: ShopStatus;
      imageUrl: string;
      savings: number;
    }>
  ): Promise<Shop> {
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (updates.title !== undefined) updateData.title = updates.title;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.isFavorite !== undefined) updateData.is_favorite = updates.isFavorite;
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.imageUrl !== undefined) updateData.image_url = updates.imageUrl;
    if (updates.savings !== undefined) updateData.savings = updates.savings;

    const { data, error } = await supabase
      .from('shops')
      .update(updateData)
      .eq('id', shopId)
      .select()
      .single();

    if (error) throw error;

    // Fetch products for the updated shop
    const { data: productsData } = await supabase
      .from('products')
      .select('*')
      .eq('shop_id', shopId);

    const products = (productsData as DbProduct[])?.map(dbProductToProductLink) || [];
    return dbShopToShop(data as DbShop, products);
  },

  async deleteShop(shopId: string): Promise<void> {
    const { error } = await supabase.from('shops').delete().eq('id', shopId);

    if (error) throw error;
  },

  /**
   * Count favorited shops for a user (lightweight query, doesn't fetch full shop data)
   * @param userId - User ID to count favorites for
   * @returns Number of favorited shops
   */
  async countFavoriteShops(userId: string): Promise<number> {
    const { count, error } = await supabase
      .from('shops')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_favorite', true);

    if (error) throw error;
    return count ?? 0;
  },

  /**
   * Fetch user's favorited shops
   * @param userId - User ID to fetch favorited shops for
   * @param limit - Number of shops to fetch (default 50)
   * @param offset - Number of shops to skip (default 0)
   * @returns Object containing shops array and hasMore boolean
   */
  async fetchFavoriteShops(
    userId: string,
    limit = 50,
    offset = 0
  ): Promise<{ shops: Shop[]; hasMore: boolean }> {
    // Fetch favorited shops with limit + 1 to check if there are more
    const { data: shopsData, error: shopsError } = await supabase
      .from('shops')
      .select('*')
      .eq('user_id', userId)
      .eq('is_favorite', true)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit);

    if (shopsError) throw shopsError;
    if (!shopsData || shopsData.length === 0) return { shops: [], hasMore: false };

    // Check if there are more items
    const hasMore = shopsData.length > limit;
    const shopsToProcess = hasMore ? shopsData.slice(0, limit) : shopsData;

    // Fetch all products for these shops
    const shopIds = shopsToProcess.map((s) => s.id);
    const { data: productsData, error: productsError } = await supabase
      .from('products')
      .select('*')
      .in('shop_id', shopIds);

    if (productsError) throw productsError;

    // Group products by shop_id
    const productsByShopId: Record<string, ProductLink[]> = {};
    (productsData as DbProduct[])?.forEach((p) => {
      if (!productsByShopId[p.shop_id]) {
        productsByShopId[p.shop_id] = [];
      }
      productsByShopId[p.shop_id].push(dbProductToProductLink(p));
    });

    // Convert to Shop objects
    const shops = (shopsToProcess as DbShop[]).map((dbShop) =>
      dbShopToShop(dbShop, productsByShopId[dbShop.id] || [])
    );

    return { shops, hasMore };
  },
};

// ============================================================================
// Product Service
// ============================================================================

export const productService = {
  async createProducts(
    shopId: string,
    products: Omit<ProductLink, 'id' | 'shopId'>[]
  ): Promise<ProductLink[]> {
    if (products.length === 0) return [];

    const insertData = products.map((p) => ({
      shop_id: shopId,
      title: p.title,
      price: p.price,
      image_url: p.imageUrl,
      affiliate_url: p.affiliateUrl,
      source: p.source,
      is_recommended: p.isRecommended,
      rating: p.rating,
      review_count: p.reviewCount,
    }));

    const { data, error } = await supabase
      .from('products')
      .insert(insertData)
      .select();

    if (error) throw error;
    return (data as DbProduct[]).map(dbProductToProductLink);
  },

  async getProductsByShopId(shopId: string): Promise<ProductLink[]> {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('shop_id', shopId);

    if (error) throw error;
    return (data as DbProduct[])?.map(dbProductToProductLink) || [];
  },

  async deleteProductsByShopId(shopId: string): Promise<void> {
    const { error } = await supabase.from('products').delete().eq('shop_id', shopId);

    if (error) throw error;
  },
};

// ============================================================================
// Rate Limit Service
// ============================================================================

export const rateLimitService = {
  /**
   * Check rate limit status for display purposes (read-only, doesn't consume quota)
   * Uses the new unified rate_limits table with subject-based rate limiting.
   * Note: Rate limiting is now enforced server-side in the Edge Function.
   *
   * @param subject - Rate limit subject (e.g., "user:<uuid>" or "anon:<uuid>")
   * @param limit - Maximum requests allowed in window (default: 14)
   * @returns Rate limit status
   */
  async checkRateLimitStatus(
    subject: string,
    limit: number = 14
  ): Promise<RateLimitStatus> {
    const { data, error } = await supabase.rpc('rate_limit_check', {
      p_subject: subject,
      p_limit: limit,
      p_window_seconds: 7 * 24 * 60 * 60, // 7 days
    });

    if (error) {
      console.error('Failed to check rate limit:', error);
      // Fail open for better UX - server will enforce anyway
      return {
        canShop: true,
        shopsUsed: 0,
        shopsRemaining: limit,
        maxShops: limit,
        windowStart: null,
        resetsAt: null,
      };
    }

    // Map the new response format to the legacy interface
    return {
      canShop: data.allowed,
      shopsUsed: data.used,
      shopsRemaining: data.remaining,
      maxShops: data.limit,
      windowStart: null, // Not returned by new function
      resetsAt: data.reset_at,
    };
  },

  /**
   * @deprecated Use checkRateLimitStatus with subject instead
   * Legacy function for backward compatibility with user ID
   */
  async checkRateLimit(userId: string): Promise<RateLimitStatus> {
    return this.checkRateLimitStatus(`user:${userId}`);
  },

  /**
   * @deprecated Rate limit increments are now handled server-side
   * This function is kept for backward compatibility but does nothing.
   */
  async incrementRateLimit(userId: string): Promise<RateLimitIncrementResult> {
    console.warn('incrementRateLimit is deprecated - rate limiting is now handled server-side');
    // Return a mock success response
    return {
      success: true,
      shopsUsed: 0,
      shopsRemaining: 14,
      maxShops: 14,
      windowStart: new Date().toISOString(),
      resetsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };
  },
};

// ============================================================================
// Analytics Service
// ============================================================================

export const analyticsService = {
  /**
   * Track a link click event for the authenticated user.
   * This increments the link_click_count in the user_analytics table.
   * 
   * @param userId - The authenticated user's ID
   * @returns Promise that resolves when tracking is complete
   */
  async trackLinkClick(userId: string): Promise<void> {
    try {
      const { error } = await supabase.rpc('increment_analytics', {
        p_user_id: userId,
        p_event_type: 'link_click',
      });

      if (error) {
        // Log but don't throw - analytics should not break the user experience
        console.error('Failed to track link click:', error);
      }
    } catch (err) {
      // Silently fail - analytics tracking should never break the app
      console.error('Error tracking link click:', err);
    }
  },

  /**
   * Track a scan event for the authenticated user.
   * Note: Scans are typically tracked server-side in the analyze-product function,
   * but this can be used for client-side tracking if needed.
   * 
   * @param userId - The authenticated user's ID
   * @returns Promise that resolves when tracking is complete
   */
  async trackScan(userId: string): Promise<void> {
    try {
      const { error } = await supabase.rpc('increment_analytics', {
        p_user_id: userId,
        p_event_type: 'scan',
      });

      if (error) {
        console.error('Failed to track scan:', error);
      }
    } catch (err) {
      console.error('Error tracking scan:', err);
    }
  },
};

// ============================================================================
// Storage Service
// ============================================================================

export const storageService = {
  async uploadShopImage(
    userId: string,
    shopId: string,
    uri: string
  ): Promise<string> {
    // Create a File instance from the URI (expo-file-system)
    const file = new File(uri);

    // Read file as ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();

    // Determine file extension and content type
    const fileExt = file.extension?.replace('.', '') || 'jpg';
    const contentType = fileExt === 'png' ? 'image/png' : 'image/jpeg';
    const filePath = `${userId}/${shopId}.${fileExt}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('shop-images')
      .upload(filePath, arrayBuffer, {
        contentType,
        upsert: true,
      });

    if (uploadError) throw uploadError;

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from('shop-images').getPublicUrl(filePath);

    return publicUrl;
  },

  async deleteShopImage(userId: string, shopId: string): Promise<void> {
    // Try to delete both jpg and png extensions
    const extensions = ['jpg', 'jpeg', 'png'];
    for (const ext of extensions) {
      const filePath = `${userId}/${shopId}.${ext}`;
      await supabase.storage.from('shop-images').remove([filePath]);
    }
  },

  getImageUrl(userId: string, shopId: string, extension = 'jpg'): string {
    const filePath = `${userId}/${shopId}.${extension}`;
    const {
      data: { publicUrl },
    } = supabase.storage.from('shop-images').getPublicUrl(filePath);
    return publicUrl;
  },

  async uploadProfileAvatar(userId: string, uri: string): Promise<string> {
    // Create a File instance from the URI (expo-file-system)
    const file = new File(uri);

    // Read file as ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();

    // Determine file extension and content type
    const fileExt = file.extension?.replace('.', '') || 'jpg';
    const contentType = fileExt === 'png' ? 'image/png' : 'image/jpeg';
    const filePath = `${userId}/profile/avatar.${fileExt}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('shop-images')
      .upload(filePath, arrayBuffer, {
        contentType,
        upsert: true,
      });

    if (uploadError) throw uploadError;

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from('shop-images').getPublicUrl(filePath);

    return publicUrl;
  },

  /**
   * Upload an image via the Edge Function (works for both users and guests).
   * This is used when the client can't upload directly to storage (e.g., guests).
   */
  async uploadImageViaEdge(
    uri: string,
    anonToken?: string
  ): Promise<string> {
    // Create a File instance from the URI (expo-file-system)
    const file = new File(uri);

    // Read file as ArrayBuffer and convert to base64
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Convert to base64
    let binary = '';
    for (let i = 0; i < uint8Array.length; i++) {
      binary += String.fromCharCode(uint8Array[i]);
    }
    const base64Data = btoa(binary);

    // Determine content type
    const fileExt = file.extension?.replace('.', '') || 'jpg';
    const contentType = fileExt === 'png' ? 'image/png' : 'image/jpeg';

    // Build headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (anonToken) {
      headers['X-Anon-Token'] = anonToken;
    }

    // Call the Edge Function
    const { data, error } = await supabase.functions.invoke('upload-image', {
      headers,
      body: {
        imageData: base64Data,
        contentType,
      },
    });

    if (error) {
      console.error('Upload via edge error:', error);
      throw new Error(error.message || 'Failed to upload image');
    }

    if (!data?.imageUrl) {
      throw new Error('No image URL returned from upload');
    }

    return data.imageUrl;
  },
};

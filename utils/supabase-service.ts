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
    products,
    recommendation,
  };
}

function dbProductToProductLink(dbProduct: DbProduct): ProductLink {
  return {
    id: dbProduct.id,
    shopId: dbProduct.shop_id,
    title: dbProduct.title,
    price: dbProduct.price,
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
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return dbProfileToUserProfile(data as DbProfile);
  },
};

// ============================================================================
// Shop Service
// ============================================================================

export const shopService = {
  async fetchUserShops(userId: string): Promise<Shop[]> {
    // Fetch shops
    const { data: shopsData, error: shopsError } = await supabase
      .from('shops')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (shopsError) throw shopsError;
    if (!shopsData || shopsData.length === 0) return [];

    // Fetch all products for these shops
    const shopIds = shopsData.map((s) => s.id);
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
    return (shopsData as DbShop[]).map((dbShop) =>
      dbShopToShop(dbShop, productsByShopId[dbShop.id] || [])
    );
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
};

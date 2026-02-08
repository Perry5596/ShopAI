import { View, Text, ScrollView, ActivityIndicator, Image, TouchableOpacity, Linking, FlatList } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { IconButton } from '@/components/ui/IconButton';
import { RecentShops } from '@/components/home/RecentShops';
import { useAuth } from '@/contexts/AuthContext';
import { shopService, savedProductService } from '@/utils/supabase-service';
import { useState, useEffect, useCallback } from 'react';
import * as Haptics from 'expo-haptics';
import type { Shop, SearchProduct } from '@/types';

// ============================================================================
// Saved Product Card (for individually saved products)
// ============================================================================

function SavedProductCard({
  product,
  onUnsave,
}: {
  product: SearchProduct;
  onUnsave: (productId: string) => void;
}) {
  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Linking.openURL(product.affiliateUrl);
  };

  const handleUnsave = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onUnsave(product.id);
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.7}
      className="bg-card rounded-2xl border border-border-light overflow-hidden mb-3 flex-row">
      {/* Product Image */}
      <View className="w-20 h-20 bg-white items-center justify-center">
        {product.imageUrl ? (
          <Image
            source={{ uri: product.imageUrl }}
            className="w-full h-full"
            resizeMode="contain"
          />
        ) : (
          <Ionicons name="bag-outline" size={24} color="#9CA3AF" />
        )}
      </View>

      {/* Product Info */}
      <View className="flex-1 p-3 justify-center">
        <Text className="text-[14px] font-inter-semibold text-foreground" numberOfLines={2}>
          {product.title}
        </Text>
        <View className="flex-row items-center mt-1">
          {product.price ? (
            <Text className="text-[14px] font-bold text-foreground mr-2">
              {product.price}
            </Text>
          ) : null}
          {product.brand ? (
            <Text className="text-[11px] text-foreground-muted">
              {product.brand}
            </Text>
          ) : null}
        </View>
        {product.rating != null && (
          <View className="flex-row items-center mt-0.5">
            <Ionicons name="star" size={10} color="#F59E0B" />
            <Text className="text-[11px] text-foreground-muted ml-0.5">
              {product.rating.toFixed(1)}
              {product.reviewCount ? ` (${product.reviewCount.toLocaleString()})` : ''}
            </Text>
          </View>
        )}
      </View>

      {/* Unsave button */}
      <TouchableOpacity
        onPress={handleUnsave}
        className="px-3 items-center justify-center"
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Ionicons name="bookmark" size={20} color="#F59E0B" />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

// ============================================================================
// Tab Selector
// ============================================================================

type TabId = 'shops' | 'products';

function TabSelector({
  activeTab,
  onTabChange,
  shopCount,
  productCount,
}: {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  shopCount: number;
  productCount: number;
}) {
  return (
    <View className="flex-row mb-4 bg-background-secondary rounded-xl p-1">
      <TouchableOpacity
        onPress={() => onTabChange('shops')}
        className={`flex-1 py-2.5 rounded-lg items-center ${
          activeTab === 'shops' ? 'bg-card' : ''
        }`}
        style={
          activeTab === 'shops'
            ? { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 2, elevation: 1 }
            : undefined
        }>
        <Text
          className={`text-[14px] font-inter-semibold ${
            activeTab === 'shops' ? 'text-foreground' : 'text-foreground-muted'
          }`}>
          Shops {shopCount > 0 ? `(${shopCount})` : ''}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => onTabChange('products')}
        className={`flex-1 py-2.5 rounded-lg items-center ${
          activeTab === 'products' ? 'bg-card' : ''
        }`}
        style={
          activeTab === 'products'
            ? { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 2, elevation: 1 }
            : undefined
        }>
        <Text
          className={`text-[14px] font-inter-semibold ${
            activeTab === 'products' ? 'text-foreground' : 'text-foreground-muted'
          }`}>
          Products {productCount > 0 ? `(${productCount})` : ''}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// ============================================================================
// Main Screen
// ============================================================================

export default function SavedItemsScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>('shops');
  const [favoriteShops, setFavoriteShops] = useState<Shop[]>([]);
  const [savedProducts, setSavedProducts] = useState<SearchProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!user?.id) return;

    setIsLoading(true);
    setError(null);
    try {
      const [shopsResult, products] = await Promise.all([
        shopService.fetchFavoriteShops(user.id),
        savedProductService.fetchSavedProducts(user.id),
      ]);
      setFavoriteShops(shopsResult.shops);
      setSavedProducts(products);
    } catch (err) {
      console.error('Failed to load saved items:', err);
      setError(err instanceof Error ? err.message : 'Failed to load saved items');
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleUnsaveProduct = useCallback(async (productId: string) => {
    // Optimistic removal
    setSavedProducts((prev) => prev.filter((p) => p.id !== productId));
    try {
      await savedProductService.toggleFavorite(productId);
    } catch {
      // Revert — reload
      loadData();
    }
  }, [loadData]);

  const renderEmptyState = (type: 'shops' | 'products') => (
    <View className="items-center justify-center py-12">
      <View className="w-16 h-16 rounded-full bg-background-secondary items-center justify-center mb-4">
        <Ionicons
          name={type === 'shops' ? 'bookmark-outline' : 'bag-outline'}
          size={32}
          color="#9CA3AF"
        />
      </View>
      <Text className="text-[16px] font-inter-medium text-foreground-muted">
        {type === 'shops' ? 'No saved shops yet' : 'No saved products yet'}
      </Text>
      <Text className="text-[14px] font-inter text-foreground-subtle mt-1 text-center px-8">
        {type === 'shops'
          ? 'Tap the bookmark icon on any shop to save it here'
          : 'Long-press a product in search results and choose "Save for Later"'}
      </Text>
    </View>
  );

  return (
    <View className="flex-1 bg-background-secondary">
      {/* Header */}
      <View
        className="bg-background-secondary"
        style={{ paddingTop: insets.top + 8 }}>
        <View className="flex-row items-center px-5 mb-4">
          <IconButton
            icon="chevron-back"
            variant="ghost"
            size="md"
            onPress={() => router.back()}
          />
          <Text className="text-[22px] font-inter-semibold text-foreground ml-2">
            Saved Items
          </Text>
        </View>
      </View>

      {/* Content */}
      <ScrollView
        className="flex-1 px-5"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        {isLoading ? (
          <View className="items-center justify-center py-12">
            <ActivityIndicator size="large" color="#000000" />
            <Text className="text-[14px] font-inter text-foreground-muted mt-4">
              Loading saved items...
            </Text>
          </View>
        ) : error ? (
          <View className="items-center justify-center py-12">
            <Text className="text-[16px] font-inter-medium text-red-500 mb-2">
              Error
            </Text>
            <Text className="text-[14px] font-inter text-foreground-muted text-center px-8">
              {error}
            </Text>
          </View>
        ) : (
          <>
            {/* Tab selector */}
            <TabSelector
              activeTab={activeTab}
              onTabChange={setActiveTab}
              shopCount={favoriteShops.length}
              productCount={savedProducts.length}
            />

            {/* Shops tab */}
            {activeTab === 'shops' && (
              favoriteShops.length === 0
                ? renderEmptyState('shops')
                : <RecentShops
                    shops={favoriteShops}
                    conversations={[]}
                    isLoadingMore={false}
                    hasMore={false}
                    onEditTitle={() => {}}
                  />
            )}

            {/* Products tab */}
            {activeTab === 'products' && (
              savedProducts.length === 0
                ? renderEmptyState('products')
                : savedProducts.map((product) => (
                    <SavedProductCard
                      key={product.id}
                      product={product}
                      onUnsave={handleUnsaveProduct}
                    />
                  ))
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

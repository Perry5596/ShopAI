import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Image,
  TouchableOpacity,
  Linking,
  TextInput,
  Alert,
  Share,
  Platform,
  ActionSheetIOS,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { IconButton } from '@/components/ui/IconButton';
import { useAuth } from '@/contexts/AuthContext';
import { useSearchStore } from '@/stores/searchStore';
import {
  shopService,
  savedProductService,
  productService,
  conversationService,
} from '@/utils/supabase-service';
import { useShopStore } from '@/stores';
import { useState, useEffect, useCallback, useMemo } from 'react';
import * as Haptics from 'expo-haptics';
import type { Shop, SearchProduct, ProductLink, Conversation } from '@/types';

// ============================================================================
// Unified saved product type (combines scan products + search products)
// ============================================================================

type SavedProductItem = {
  id: string;
  title: string;
  price: string | null;
  imageUrl: string | null;
  affiliateUrl: string;
  source: string;
  brand: string | null;
  rating: number | null;
  reviewCount: number | null;
  createdAt: string;
  /** 'scan' = from image scan (products table), 'search' = from AI search (search_products table) */
  origin: 'scan' | 'search';
};

function productLinkToSavedItem(p: ProductLink): SavedProductItem {
  return {
    id: p.id,
    title: p.title,
    price: p.price ?? null,
    imageUrl: p.imageUrl ?? null,
    affiliateUrl: p.affiliateUrl,
    source: p.source,
    brand: null,
    rating: p.rating ?? null,
    reviewCount: p.reviewCount ?? null,
    createdAt: p.createdAt ?? new Date().toISOString(),
    origin: 'scan',
  };
}

function searchProductToSavedItem(p: SearchProduct): SavedProductItem {
  return {
    id: p.id,
    title: p.title,
    price: p.price,
    imageUrl: p.imageUrl,
    affiliateUrl: p.affiliateUrl,
    source: p.source,
    brand: p.brand,
    rating: p.rating,
    reviewCount: p.reviewCount,
    createdAt: p.createdAt,
    origin: 'search',
  };
}

// ============================================================================
// Unified shop/conversation type for Shops tab
// ============================================================================

type SavedShopItem = {
  id: string;
  title: string;
  imageUrl: string | null;
  productCount: number;
  createdAt: string;
  /** 'shop' = image scan, 'conversation' = AI search */
  type: 'shop' | 'conversation';
};

// ============================================================================
// Saved Product Card (long-press menu: remove, share, copy)
// ============================================================================

function SavedProductCard({
  product,
  onUnsave,
}: {
  product: SavedProductItem;
  onUnsave: (productId: string, origin: 'scan' | 'search') => void;
}) {
  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Linking.openURL(product.affiliateUrl);
  };

  const handleLongPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const options = ['Copy Link', 'Share', 'Remove from Saved', 'Cancel'];
    const destructiveIndex = 2;
    const cancelIndex = 3;

    const handleAction = (index: number) => {
      switch (index) {
        case 0:
          Clipboard.setStringAsync(product.affiliateUrl);
          break;
        case 1:
          Share.share({ url: product.affiliateUrl, title: product.title });
          break;
        case 2:
          onUnsave(product.id, product.origin);
          break;
      }
    };

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: cancelIndex, destructiveButtonIndex: destructiveIndex },
        handleAction
      );
    } else {
      Alert.alert('Options', '', [
        { text: 'Copy Link', onPress: () => handleAction(0) },
        { text: 'Share', onPress: () => handleAction(1) },
        { text: 'Remove from Saved', style: 'destructive', onPress: () => handleAction(2) },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      onLongPress={handleLongPress}
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

      {/* Bookmark icon */}
      <View className="px-3 items-center justify-center">
        <Ionicons name="bookmark" size={20} color="#F59E0B" />
      </View>
    </TouchableOpacity>
  );
}

// ============================================================================
// Saved Shop / Conversation Card
// ============================================================================

function SavedShopCard({
  item,
  onPress,
  onRemove,
}: {
  item: SavedShopItem;
  onPress: () => void;
  onRemove: (id: string, type: 'shop' | 'conversation') => void;
}) {
  const handleLongPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const options = ['Remove from Favorites', 'Cancel'];
    const destructiveIndex = 0;
    const cancelIndex = 1;

    const handleAction = (index: number) => {
      if (index === 0) {
        onRemove(item.id, item.type);
      }
    };

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: cancelIndex, destructiveButtonIndex: destructiveIndex },
        handleAction
      );
    } else {
      Alert.alert('Options', '', [
        { text: 'Remove from Favorites', style: 'destructive', onPress: () => handleAction(0) },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      onLongPress={handleLongPress}
      activeOpacity={0.7}
      className="bg-card rounded-2xl border border-border-light overflow-hidden mb-3 flex-row">
      {/* Thumbnail */}
      <View className="w-20 h-20 bg-white items-center justify-center">
        {item.imageUrl ? (
          <Image
            source={{ uri: item.imageUrl }}
            className="w-full h-full"
            resizeMode="cover"
          />
        ) : (
          <Ionicons
            name={item.type === 'conversation' ? 'chatbubble-outline' : 'camera-outline'}
            size={24}
            color="#9CA3AF"
          />
        )}
      </View>

      {/* Info */}
      <View className="flex-1 p-3 justify-center">
        <Text className="text-[14px] font-inter-semibold text-foreground" numberOfLines={2}>
          {item.title || 'Untitled'}
        </Text>
        <View className="flex-row items-center mt-1">
          <Ionicons
            name={item.type === 'conversation' ? 'search' : 'camera'}
            size={10}
            color="#9CA3AF"
          />
          <Text className="text-[11px] text-foreground-muted ml-1">
            {item.type === 'conversation' ? 'AI Search' : 'Scan'} · {item.productCount} product{item.productCount !== 1 ? 's' : ''}
          </Text>
        </View>
      </View>

      {/* Star */}
      <View className="px-3 items-center justify-center">
        <Ionicons name="star" size={18} color="#F59E0B" />
      </View>
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
  const loadConversation = useSearchStore((s) => s.loadConversation);

  const [activeTab, setActiveTab] = useState<TabId>('shops');
  const [searchQuery, setSearchQuery] = useState('');

  // Data
  const [favoriteShops, setFavoriteShops] = useState<Shop[]>([]);
  const [favoriteConversations, setFavoriteConversations] = useState<Conversation[]>([]);
  const [savedScanProducts, setSavedScanProducts] = useState<ProductLink[]>([]);
  const [savedSearchProducts, setSavedSearchProducts] = useState<SearchProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Load data ──────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!user?.id) return;

    setIsLoading(true);
    setError(null);
    try {
      const [shopsResult, conversations, scanProducts, searchProducts] = await Promise.all([
        shopService.fetchFavoriteShops(user.id),
        conversationService.fetchFavoriteConversations(user.id),
        productService.fetchFavoriteProducts(user.id),
        savedProductService.fetchSavedProducts(user.id),
      ]);
      setFavoriteShops(shopsResult.shops);
      setFavoriteConversations(conversations);
      setSavedScanProducts(scanProducts);
      setSavedSearchProducts(searchProducts);
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

  // ── Unified & sorted shop items (shops + conversations, sorted by date) ─
  const shopItems = useMemo<SavedShopItem[]>(() => {
    const items: SavedShopItem[] = [];

    for (const shop of favoriteShops) {
      items.push({
        id: shop.id,
        title: shop.title,
        imageUrl: shop.imageUrl,
        productCount: shop.products.length,
        createdAt: shop.createdAt,
        type: 'shop',
      });
    }

    for (const conv of favoriteConversations) {
      items.push({
        id: conv.id,
        title: conv.title ?? 'AI Search',
        imageUrl: conv.thumbnailUrl,
        productCount: conv.totalProducts,
        createdAt: conv.createdAt,
        type: 'conversation',
      });
    }

    // Sort by date descending
    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return items;
  }, [favoriteShops, favoriteConversations]);

  // ── Unified & sorted product items (scan + search, sorted by date) ─────
  const productItems = useMemo<SavedProductItem[]>(() => {
    const items: SavedProductItem[] = [
      ...savedScanProducts.map(productLinkToSavedItem),
      ...savedSearchProducts.map(searchProductToSavedItem),
    ];

    // Sort by date descending
    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return items;
  }, [savedScanProducts, savedSearchProducts]);

  // ── Filtered by search query ───────────────────────────────────────────
  const filteredShopItems = useMemo(() => {
    if (!searchQuery.trim()) return shopItems;
    const q = searchQuery.toLowerCase();
    return shopItems.filter((item) => item.title.toLowerCase().includes(q));
  }, [shopItems, searchQuery]);

  const filteredProductItems = useMemo(() => {
    if (!searchQuery.trim()) return productItems;
    const q = searchQuery.toLowerCase();
    return productItems.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        (item.brand && item.brand.toLowerCase().includes(q)) ||
        item.source.toLowerCase().includes(q)
    );
  }, [productItems, searchQuery]);

  // ── Actions ────────────────────────────────────────────────────────────
  const handleUnsaveProduct = useCallback(
    async (productId: string, origin: 'scan' | 'search') => {
      // Optimistic removal
      if (origin === 'scan') {
        setSavedScanProducts((prev) => prev.filter((p) => p.id !== productId));
      } else {
        setSavedSearchProducts((prev) => prev.filter((p) => p.id !== productId));
      }
      try {
        if (origin === 'scan') {
          await productService.toggleFavorite(productId);
        } else {
          await savedProductService.toggleFavorite(productId);
        }
      } catch {
        loadData();
      }
    },
    [loadData]
  );

  const handleShopPress = useCallback(
    (item: SavedShopItem) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (item.type === 'shop') {
        router.push(`/(app)/shop/${item.id}` as any);
      } else {
        // Load conversation and navigate to search screen
        loadConversation(item.id);
        router.push('/(app)/search' as any);
      }
    },
    [loadConversation]
  );

  const handleRemoveShop = useCallback(
    async (id: string, type: 'shop' | 'conversation') => {
      // Optimistic removal
      if (type === 'shop') {
        setFavoriteShops((prev) => prev.filter((s) => s.id !== id));
      } else {
        setFavoriteConversations((prev) => prev.filter((c) => c.id !== id));
      }
      try {
        if (type === 'shop') {
          const { toggleFavorite } = useShopStore.getState();
          await toggleFavorite(id);
        } else {
          await conversationService.toggleFavorite(id);
        }
      } catch {
        loadData();
      }
    },
    [loadData]
  );

  // ── Render helpers ─────────────────────────────────────────────────────
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
          : 'Long-press a product and choose "Save for Later"'}
      </Text>
    </View>
  );

  const renderNoResults = () => (
    <View className="items-center justify-center py-12">
      <Ionicons name="search-outline" size={32} color="#9CA3AF" />
      <Text className="text-[14px] font-inter text-foreground-muted mt-3">
        No results for "{searchQuery}"
      </Text>
    </View>
  );

  return (
    <View className="flex-1 bg-background-secondary">
      {/* Header */}
      <View
        className="bg-background-secondary"
        style={{ paddingTop: insets.top + 8 }}>
        <View className="flex-row items-center px-5 mb-3">
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

        {/* Search Bar */}
        <View className="px-5 mb-3">
          <View className="flex-row items-center bg-card rounded-xl border border-border-light px-3 py-2">
            <Ionicons name="search" size={18} color="#9CA3AF" />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search saved items..."
              placeholderTextColor="#9CA3AF"
              className="flex-1 ml-2 text-[14px] font-inter text-foreground"
              returnKeyType="search"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </View>
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
              shopCount={shopItems.length}
              productCount={productItems.length}
            />

            {/* Shops tab */}
            {activeTab === 'shops' && (
              shopItems.length === 0
                ? renderEmptyState('shops')
                : filteredShopItems.length === 0
                  ? renderNoResults()
                  : filteredShopItems.map((item) => (
                      <SavedShopCard
                        key={`${item.type}-${item.id}`}
                        item={item}
                        onPress={() => handleShopPress(item)}
                        onRemove={handleRemoveShop}
                      />
                    ))
            )}

            {/* Products tab */}
            {activeTab === 'products' && (
              productItems.length === 0
                ? renderEmptyState('products')
                : filteredProductItems.length === 0
                  ? renderNoResults()
                  : filteredProductItems.map((product) => (
                      <SavedProductCard
                        key={`${product.origin}-${product.id}`}
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

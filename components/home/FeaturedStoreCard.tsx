import { useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  FlatList,
  ScrollView,
  TouchableOpacity,
  Linking,
  Dimensions,
  ImageBackground,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { FeaturedStore, FeaturedStoreProduct } from '@/types';
import { trackLinkClick } from '@/utils/ads-analytics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_MARGIN = 20;
const CARD_WIDTH = SCREEN_WIDTH - CARD_MARGIN * 2;
const PRODUCT_CARD_WIDTH = 150;
const PRODUCT_CARD_HEIGHT = 190;

// ============================================================================
// Product Mini Card (inside the horizontal scroll)
// ============================================================================

interface ProductMiniCardProps {
  product: FeaturedStoreProduct;
  onPress: (product: FeaturedStoreProduct) => void;
}

function ProductMiniCard({ product, onPress }: ProductMiniCardProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => onPress(product)}
      style={{
        width: PRODUCT_CARD_WIDTH,
        height: PRODUCT_CARD_HEIGHT,
        marginRight: 12,
      }}
      className="bg-white rounded-2xl overflow-hidden"
    >
      {/* Price Badge */}
      {product.price && (
        <View
          className="absolute top-2 left-2 z-10 px-2.5 py-1 rounded-full"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
        >
          <Text className="text-white text-[12px] font-inter-semibold">
            {product.price}
          </Text>
        </View>
      )}

      {/* Product Image */}
      <View className="items-center justify-center p-3 pt-8" style={{ height: 130 }}>
        {product.imageUrl ? (
          <Image
            source={{ uri: product.imageUrl }}
            style={{ width: PRODUCT_CARD_WIDTH - 30, height: 100 }}
            resizeMode="contain"
          />
        ) : (
          <View className="items-center justify-center flex-1">
            <Ionicons name="image-outline" size={40} color="#D1D5DB" />
          </View>
        )}
      </View>

      {/* Rating Row */}
      {product.rating != null && (
        <View className="flex-row items-center px-2.5">
          <Ionicons name="star" size={10} color="#F59E0B" />
          <Text className="text-[10px] font-inter text-gray-500 ml-0.5">
            {product.rating.toFixed(1)}
          </Text>
          {product.reviewCount != null && (
            <Text className="text-[10px] font-inter text-gray-400 ml-0.5">
              ({formatCount(product.reviewCount)})
            </Text>
          )}
        </View>
      )}

      {/* Product Title */}
      <Text
        className="text-[11px] font-inter text-gray-700 px-2.5 mt-1 pb-2"
        numberOfLines={2}
      >
        {product.title}
      </Text>
    </TouchableOpacity>
  );
}

// ============================================================================
// Pagination Dots
// ============================================================================

interface PaginationDotsProps {
  count: number;
  activeIndex: number;
}

function PaginationDots({ count, activeIndex }: PaginationDotsProps) {
  if (count <= 1) return null;

  return (
    <View className="flex-row items-center justify-center mt-3">
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={{
            width: i === activeIndex ? 20 : 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: i === activeIndex ? '#000000' : '#D1D5DB',
            marginHorizontal: 3,
          }}
        />
      ))}
    </View>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function computeSavings(products: FeaturedStoreProduct[]): number | null {
  let totalSavings = 0;
  let hasSavings = false;

  for (const p of products) {
    if (
      p.extractedOldPrice != null &&
      p.extractedPrice != null &&
      p.extractedOldPrice > p.extractedPrice
    ) {
      totalSavings += p.extractedOldPrice - p.extractedPrice;
      hasSavings = true;
    }
  }

  return hasSavings ? Math.round(totalSavings) : null;
}

// ============================================================================
// Single Store Card
// ============================================================================

interface SingleStoreCardProps {
  store: FeaturedStore;
  onLinkClick?: () => void;
}

function SingleStoreCard({ store, onLinkClick }: SingleStoreCardProps) {
  const handleProductPress = (product: FeaturedStoreProduct) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onLinkClick?.();
    trackLinkClick('Amazon', product.title, product.affiliateUrl);
    Linking.openURL(product.affiliateUrl).catch(() => {});
  };

  const handleStorePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onLinkClick?.();
    const url = store.storeUrl || store.products[0]?.affiliateUrl;
    if (url) {
      trackLinkClick('Amazon', store.brandName, url);
      Linking.openURL(url).catch(() => {});
    }
  };

  const savings = computeSavings(store.products);

  return (
    <View style={{ width: CARD_WIDTH }}>
      {/* Background: gradient + optional image */}
      <LinearGradient
        colors={[store.backgroundGradientStart, store.backgroundGradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ borderRadius: 24, overflow: 'hidden' }}
      >
        {store.backgroundImageUrl && (
          <ImageBackground
            source={{ uri: store.backgroundImageUrl }}
            resizeMode="cover"
            blurRadius={8}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              opacity: 0.3,
            }}
          />
        )}

        <View className="px-4 pt-4 pb-4">
          {/* Header Row */}
          <View className="flex-row items-start justify-between mb-1">
            <View className="flex-1">
              {/* Brand Name */}
              <Text
                className="text-white text-[22px] font-inter-bold leading-tight"
                numberOfLines={2}
              >
                {store.brandName.toUpperCase()}
              </Text>
            </View>

            {/* Brand Logo (optional) */}
            {store.brandLogoUrl && (
              <Image
                source={{ uri: store.brandLogoUrl }}
                style={{ width: 36, height: 36, borderRadius: 18 }}
                resizeMode="contain"
              />
            )}
          </View>

          {/* Category Tag */}
          <View className="flex-row mb-4">
            <View
              className="px-2.5 py-1 rounded-full"
              style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}
            >
              <Text className="text-white text-[11px] font-inter-medium">
                {store.shoppingCategory}
              </Text>
            </View>
          </View>

          {/* Product Carousel */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingRight: 8 }}
          >
            {store.products.map((product) => (
              <ProductMiniCard
                key={product.id}
                product={product}
                onPress={handleProductPress}
              />
            ))}
          </ScrollView>

          {/* Bottom Row: Savings / CTA */}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={handleStorePress}
            className="flex-row items-center justify-between mt-4"
          >
            <View>
              {savings != null ? (
                <Text className="text-white text-[20px] font-inter-bold">
                  Save ${savings}
                </Text>
              ) : (
                <Text className="text-white text-[20px] font-inter-bold">
                  Shop Now
                </Text>
              )}
              <Text
                className="text-[12px] font-inter mt-0.5"
                style={{ color: 'rgba(255,255,255,0.7)' }}
              >
                Featured Store of the Week
              </Text>
            </View>

            <View
              className="items-center justify-center rounded-full"
              style={{
                width: 40,
                height: 40,
                backgroundColor: 'rgba(255,255,255,0.2)',
              }}
            >
              <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
            </View>
          </TouchableOpacity>

          {/* Affiliate Disclosure */}
          <Text
            className="text-[9px] font-inter mt-2"
            style={{ color: 'rgba(255,255,255,0.45)' }}
          >
            Ad · We may earn a commission from purchases made through these links.
          </Text>
        </View>
      </LinearGradient>
    </View>
  );
}

// ============================================================================
// Main Carousel Component (exported)
// ============================================================================

interface FeaturedStoreCardProps {
  stores: FeaturedStore[];
  /** Called when any affiliate link is tapped (for Supabase analytics) */
  onLinkClick?: () => void;
}

export function FeaturedStoreCard({ stores, onLinkClick }: FeaturedStoreCardProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const carouselRef = useRef<FlatList>(null);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetX = event.nativeEvent.contentOffset.x;
      const index = Math.round(offsetX / SCREEN_WIDTH);
      setActiveIndex(index);
    },
    []
  );

  if (stores.length === 0) return null;

  // Single store — no carousel needed
  if (stores.length === 1) {
    return (
      <View style={{ marginHorizontal: CARD_MARGIN }}>
        <SingleStoreCard store={stores[0]} onLinkClick={onLinkClick} />
      </View>
    );
  }

  // Multiple stores — horizontal carousel with pagination dots
  return (
    <View>
      <FlatList
        ref={carouselRef}
        data={stores}
        renderItem={({ item }) => (
          <View style={{ width: SCREEN_WIDTH, paddingHorizontal: CARD_MARGIN }}>
            <SingleStoreCard store={item} onLinkClick={onLinkClick} />
          </View>
        )}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        snapToInterval={SCREEN_WIDTH}
        decelerationRate="fast"
        onScroll={handleScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingHorizontal: 0 }}
        getItemLayout={(_, index) => ({
          length: SCREEN_WIDTH,
          offset: SCREEN_WIDTH * index,
          index,
        })}
      />
      <PaginationDots count={stores.length} activeIndex={activeIndex} />
    </View>
  );
}

import { View, Text, Image, TouchableOpacity, Linking, ImageSourcePropType } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { SearchProduct } from '@/types';

// Affiliate logo imports (reuse from shop feature)
const affiliateLogos: Record<string, ImageSourcePropType> = {
  amazon: require('@/assets/affiliate_logos/Amazon.com, Inc..png'),
  ebay: require('@/assets/affiliate_logos/eBay Inc..png'),
  target: require('@/assets/affiliate_logos/Target Corporation.png'),
  bestbuy: require('@/assets/affiliate_logos/Best Buy Co., Inc..png'),
  walmart: require('@/assets/affiliate_logos/Walmart Inc..png'),
};

function getAffiliateLogo(source: string): ImageSourcePropType | null {
  const s = source.toLowerCase();
  if (s.includes('amazon')) return affiliateLogos.amazon;
  if (s.includes('ebay')) return affiliateLogos.ebay;
  if (s.includes('target')) return affiliateLogos.target;
  if (s.includes('best buy') || s.includes('bestbuy')) return affiliateLogos.bestbuy;
  if (s.includes('walmart')) return affiliateLogos.walmart;
  return null;
}

function StarRating({ rating, size = 10 }: { rating: number; size?: number }) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  const empty = 5 - full - (half ? 1 : 0);
  return (
    <View className="flex-row items-center">
      {[...Array(full)].map((_, i) => (
        <Ionicons key={`f${i}`} name="star" size={size} color="#F59E0B" />
      ))}
      {half && <Ionicons name="star-half" size={size} color="#F59E0B" />}
      {[...Array(empty)].map((_, i) => (
        <Ionicons key={`e${i}`} name="star-outline" size={size} color="#F59E0B" />
      ))}
    </View>
  );
}

interface SearchProductCardProps {
  product: SearchProduct;
  /** Whether this product is the AI recommended pick for its category */
  isRecommended?: boolean;
  /** Short reason why it's recommended */
  recommendReason?: string;
  onLinkClick?: () => void;
}

const CARD_WIDTH = 160;

/**
 * Compact product card for horizontal carousel display.
 * Shows an "AI Pick" badge when recommended.
 */
export function SearchProductCard({ product, isRecommended, recommendReason, onLinkClick }: SearchProductCardProps) {
  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onLinkClick?.();
    Linking.openURL(product.affiliateUrl);
  };

  const logo = getAffiliateLogo(product.source);

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.7}
      style={{ width: CARD_WIDTH }}
      className={`bg-card rounded-2xl overflow-hidden mr-3 ${
        isRecommended ? 'border-2 border-amber-400' : 'border border-border-light'
      }`}>
      {/* AI Pick badge */}
      {isRecommended && (
        <View className="bg-amber-400 px-2.5 py-1 flex-row items-center justify-center">
          <Ionicons name="sparkles" size={10} color="#000" />
          <Text className="text-[10px] font-inter-semibold text-black ml-1">
            AI Pick
          </Text>
        </View>
      )}

      {/* Product Image */}
      <View className="w-full aspect-square bg-white items-center justify-center">
        {product.imageUrl ? (
          <Image
            source={{ uri: product.imageUrl }}
            className="w-full h-full"
            resizeMode="contain"
          />
        ) : (
          <Ionicons name="bag-outline" size={32} color="#9CA3AF" />
        )}
      </View>

      {/* Product Info */}
      <View className="p-2.5">
        {/* Price */}
        {product.price ? (
          <Text className="text-[16px] font-bold text-foreground mb-0.5" numberOfLines={1}>
            {product.price}
          </Text>
        ) : (
          <Text className="text-[12px] text-foreground-muted italic mb-0.5">
            See price
          </Text>
        )}

        {/* Title */}
        <Text className="text-[12px] text-foreground leading-tight mb-1.5" numberOfLines={2}>
          {product.title}
        </Text>

        {/* Rating */}
        {product.rating != null && (
          <View className="flex-row items-center mb-1.5">
            <StarRating rating={product.rating} size={9} />
            {product.reviewCount != null && (
              <Text className="text-[10px] text-foreground-muted ml-1">
                ({product.reviewCount.toLocaleString()})
              </Text>
            )}
          </View>
        )}

        {/* Brand / Retailer */}
        <View className="flex-row items-center justify-between">
          {product.brand ? (
            <Text className="text-[10px] text-foreground-muted flex-1 mr-1" numberOfLines={1}>
              {product.brand}
            </Text>
          ) : logo ? (
            <View className="h-4 justify-center">
              <Image source={logo} style={{ width: 16, height: 16 }} resizeMode="contain" />
            </View>
          ) : (
            <Text className="text-[10px] text-foreground-muted">{product.source}</Text>
          )}
          <Ionicons name="open-outline" size={10} color="#9CA3AF" />
        </View>
      </View>
    </TouchableOpacity>
  );
}

import { View, Text, Image, TouchableOpacity, Linking, Dimensions, Alert, Share, ImageSourcePropType, Platform, ActionSheetIOS } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { Badge } from '../ui/Badge';
import type { ProductLink } from '@/types';
import * as Haptics from 'expo-haptics';

// Affiliate logo imports
const affiliateLogos: Record<string, ImageSourcePropType> = {
  amazon: require('@/assets/affiliate_logos/Amazon.com, Inc..png'),
  ebay: require('@/assets/affiliate_logos/eBay Inc..png'),
  target: require('@/assets/affiliate_logos/Target Corporation.png'),
  bestbuy: require('@/assets/affiliate_logos/Best Buy Co., Inc..png'),
  walmart: require('@/assets/affiliate_logos/Walmart Inc..png'),
};

interface ProductLinksProps {
  links: ProductLink[];
  recommendation?: ProductLink;
  onShareProduct?: (product: ProductLink) => void;
  onLinkClick?: () => void;
  onSaveProduct?: (productId: string) => void;
}

const { width: screenWidth } = Dimensions.get('window');
const CARD_WIDTH = (screenWidth - 48) / 2; // 2 columns with padding

/**
 * Get affiliate logo based on source name
 */
function getAffiliateLogo(source: string): ImageSourcePropType | null {
  const sourceLower = source.toLowerCase();

  if (sourceLower.includes('amazon')) return affiliateLogos.amazon;
  if (sourceLower.includes('ebay')) return affiliateLogos.ebay;
  if (sourceLower.includes('target')) return affiliateLogos.target;
  if (sourceLower.includes('best buy') || sourceLower.includes('bestbuy')) return affiliateLogos.bestbuy;
  if (sourceLower.includes('walmart')) return affiliateLogos.walmart;

  return null;
}

/**
 * Get retailer-specific styling based on source name
 */
function getRetailerStyle(source: string): {
  bgColor: string;
  textColor: string;
} {
  const sourceLower = source.toLowerCase();

  if (sourceLower.includes('amazon')) {
    return { bgColor: 'bg-white', textColor: '#FF9900' };
  }
  if (sourceLower.includes('ebay')) {
    return { bgColor: 'bg-white', textColor: '#E53238' };
  }
  if (sourceLower.includes('target')) {
    return { bgColor: 'bg-white', textColor: '#CC0000' };
  }
  if (sourceLower.includes('best buy') || sourceLower.includes('bestbuy')) {
    return { bgColor: 'bg-white', textColor: '#0046BE' };
  }
  if (sourceLower.includes('walmart')) {
    return { bgColor: 'bg-white', textColor: '#0071DC' };
  }

  // Default fallback
  return { bgColor: 'bg-background-secondary', textColor: '#6B7280' };
}

/**
 * Retailer logo component - shows official logo or brand name as fallback
 */
function RetailerLogo({ source, size = 20, showNameFallback = true }: { source: string; size?: number; showNameFallback?: boolean }) {
  const logo = getAffiliateLogo(source);
  
  if (logo) {
    return (
      <Image
        source={logo}
        style={{ width: size, height: size }}
        resizeMode="contain"
      />
    );
  }
  
  // Fallback: show brand name for unknown retailers
  if (showNameFallback) {
    const fontSize = Math.max(8, Math.min(12, size * 0.5));
    return (
      <Text 
        className="text-foreground-muted font-medium text-center" 
        style={{ fontSize }}
        numberOfLines={2}
      >
        {source}
      </Text>
    );
  }
  
  return <Ionicons name="bag-outline" size={size * 0.7} color="#9CA3AF" />;
}

/**
 * Render star rating with partial stars
 */
function StarRating({ rating, size = 12 }: { rating: number; size?: number }) {
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating - fullStars >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

  return (
    <View className="flex-row items-center">
      {[...Array(fullStars)].map((_, i) => (
        <Ionicons key={`full-${i}`} name="star" size={size} color="#F59E0B" />
      ))}
      {hasHalfStar && <Ionicons name="star-half" size={size} color="#F59E0B" />}
      {[...Array(emptyStars)].map((_, i) => (
        <Ionicons key={`empty-${i}`} name="star-outline" size={size} color="#F59E0B" />
      ))}
    </View>
  );
}

/**
 * Google Lens-style product card for grid display
 */
function ProductCard({ link, onShareProduct, onLinkClick, onSaveProduct }: { link: ProductLink; onShareProduct?: (product: ProductLink) => void; onLinkClick?: () => void; onSaveProduct?: (productId: string) => void }) {
  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onLinkClick?.();
    Linking.openURL(link.affiliateUrl);
  };

  const handleLongPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const saveLabel = link.isFavorite ? 'Remove from Saved' : 'Save for Later';
    const options = ['Copy Link', 'Share', saveLabel, 'Cancel'];
    const cancelIndex = options.length - 1;

    const handleAction = (index: number) => {
      switch (index) {
        case 0: // Copy Link
          Clipboard.setStringAsync(link.affiliateUrl);
          break;
        case 1: // Share
          Share.share({ url: link.affiliateUrl, title: link.title });
          break;
        case 2: // Save / Unsave
          onSaveProduct?.(link.id);
          break;
      }
    };

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: cancelIndex },
        handleAction
      );
    } else {
      Alert.alert('Options', '', [
        { text: 'Copy Link', onPress: () => handleAction(0) },
        { text: 'Share', onPress: () => handleAction(1) },
        { text: saveLabel, onPress: () => handleAction(2) },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  };

  const retailerStyle = getRetailerStyle(link.source);

  return (
    <TouchableOpacity
      onPress={handlePress}
      onLongPress={handleLongPress}
      activeOpacity={0.7}
      style={{ width: CARD_WIDTH }}
      className="bg-card rounded-2xl overflow-hidden border border-border-light mb-3">
      {/* Product Image */}
      <View className="w-full aspect-square bg-white items-center justify-center">
        {link.imageUrl ? (
          <Image
            source={{ uri: link.imageUrl }}
            className="w-full h-full"
            resizeMode="contain"
          />
        ) : (
          <View className={`w-16 h-16 rounded-xl items-center justify-center ${retailerStyle.bgColor}`}>
            <RetailerLogo source={link.source} size={160} />
          </View>
        )}
      </View>

      {/* Product Info */}
      <View className="p-3">
        {/* Price */}
        {link.price ? (
          <Text className="text-[18px] font-bold text-foreground mb-1">
            {link.price}
          </Text>
        ) : (
          <Text className="text-[14px] text-foreground-muted italic mb-1">
            See price
          </Text>
        )}

        {/* Title */}
        <Text className="text-[13px] text-foreground leading-tight mb-2" numberOfLines={2}>
          {link.title}
        </Text>

        {/* Rating & Reviews */}
        {link.rating && (
          <View className="flex-row items-center mb-2">
            <StarRating rating={link.rating} size={11} />
            <Text className="text-[12px] text-foreground ml-1 font-medium">
              {link.rating.toFixed(1)}
            </Text>
            {link.reviewCount && (
              <Text className="text-[11px] text-foreground-muted ml-1">
                ({link.reviewCount.toLocaleString()})
              </Text>
            )}
          </View>
        )}

        {/* Retailer Badge */}
        <View className="flex-row items-center">
          {getAffiliateLogo(link.source) ? (
            <View className="flex-1 h-16 justify-center">
              <RetailerLogo source={link.source} size={64} />
            </View>
          ) : (
            <Text className="text-[12px] text-foreground-muted flex-1" numberOfLines={1}>
              {link.source}
            </Text>
          )}
          <Ionicons name="open-outline" size={14} color="#9CA3AF" />
        </View>
      </View>
    </TouchableOpacity>
  );
}

/**
 * Featured recommendation card with larger display
 */
function RecommendedCard({ link, onShareProduct, onLinkClick, onSaveProduct }: { link: ProductLink; onShareProduct?: (product: ProductLink) => void; onLinkClick?: () => void; onSaveProduct?: (productId: string) => void }) {
  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onLinkClick?.();
    Linking.openURL(link.affiliateUrl);
  };

  const handleLongPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const saveLabel = link.isFavorite ? 'Remove from Saved' : 'Save for Later';
    const options = ['Copy Link', 'Share', saveLabel, 'Cancel'];
    const cancelIndex = options.length - 1;

    const handleAction = (index: number) => {
      switch (index) {
        case 0: // Copy Link
          Clipboard.setStringAsync(link.affiliateUrl);
          break;
        case 1: // Share
          Share.share({ url: link.affiliateUrl, title: link.title });
          break;
        case 2: // Save / Unsave
          onSaveProduct?.(link.id);
          break;
      }
    };

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: cancelIndex },
        handleAction
      );
    } else {
      Alert.alert('Options', '', [
        { text: 'Copy Link', onPress: () => handleAction(0) },
        { text: 'Share', onPress: () => handleAction(1) },
        { text: saveLabel, onPress: () => handleAction(2) },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  };

  const retailerStyle = getRetailerStyle(link.source);

  return (
    <TouchableOpacity
      onPress={handlePress}
      onLongPress={handleLongPress}
      activeOpacity={0.7}
      className="bg-amber-50 rounded-2xl overflow-hidden border-2 border-amber-300 mb-4">
      {/* Header Badge */}
      <View className="flex-row items-center justify-between px-4 pt-3 pb-2">
        <View className="flex-row items-center">
          <Ionicons name="sparkles" size={16} color="#F59E0B" />
          <Text className="text-[14px] font-semibold text-amber-700 ml-1">
            Best Match
          </Text>
        </View>
        <Badge text="#1 Result" variant="premium" />
      </View>

      {/* Product Image - Large */}
      <View className="w-full aspect-[4/3] bg-white mx-4 rounded-xl overflow-hidden" style={{ width: screenWidth - 56 }}>
        {link.imageUrl ? (
          <Image
            source={{ uri: link.imageUrl }}
            className="w-full h-full"
            resizeMode="contain"
          />
        ) : (
          <View className="flex-1 items-center justify-center">
            <View className={`w-20 h-20 rounded-xl items-center justify-center ${retailerStyle.bgColor}`}>
              <RetailerLogo source={link.source} size={224} />
            </View>
          </View>
        )}
      </View>

      {/* Product Info */}
      <View className="p-4">
        {/* Price */}
        <View className="flex-row items-baseline mb-2">
          {link.price ? (
            <Text className="text-[24px] font-bold text-foreground">
              {link.price}
            </Text>
          ) : (
            <Text className="text-[16px] text-foreground-muted italic">
              See price on {link.source}
            </Text>
          )}
        </View>

        {/* Title */}
        <Text className="text-[15px] text-foreground font-medium leading-snug mb-2" numberOfLines={2}>
          {link.title}
        </Text>

        {/* Rating & Reviews */}
        {link.rating && (
          <View className="flex-row items-center mb-3">
            <StarRating rating={link.rating} size={14} />
            <Text className="text-[14px] text-foreground ml-1.5 font-semibold">
              {link.rating.toFixed(1)}
            </Text>
            {link.reviewCount && (
              <Text className="text-[13px] text-foreground-muted ml-1">
                ({link.reviewCount.toLocaleString()} reviews)
              </Text>
            )}
          </View>
        )}

        {/* Retailer & Shop Button */}
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center">
            {getAffiliateLogo(link.source) ? (
              <View className="h-20 justify-center">
                <RetailerLogo source={link.source} size={80} />
              </View>
            ) : (
              <Text className="text-[14px] text-foreground-muted">
                {link.source}
              </Text>
            )}
          </View>
          <View className="flex-row items-center bg-amber-600 px-4 py-2 rounded-full">
            <Text className="text-[14px] font-semibold text-white mr-1">
              Shop Now
            </Text>
            <Ionicons name="arrow-forward" size={14} color="#FFFFFF" />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export function ProductLinks({ links, recommendation, onShareProduct, onLinkClick, onSaveProduct }: ProductLinksProps) {
  const filteredLinks = links.filter((l) => l.id !== recommendation?.id);

  // Split into pairs for 2-column grid
  const rows: ProductLink[][] = [];
  for (let i = 0; i < filteredLinks.length; i += 2) {
    rows.push(filteredLinks.slice(i, i + 2));
  }

  return (
    <View className="px-4 pt-4">
      {/* Recommendation - Featured Card */}
      {recommendation && <RecommendedCard link={recommendation} onShareProduct={onShareProduct} onLinkClick={onLinkClick} onSaveProduct={onSaveProduct} />}

      {/* Other Links - Grid Layout */}
      {filteredLinks.length > 0 && (
        <>
          <Text className="text-[16px] font-semibold text-foreground mb-3">
            More from retailers
          </Text>

          {/* 2-Column Grid */}
          {rows.map((row, rowIndex) => (
            <View key={rowIndex} className="flex-row justify-between">
              {row.map((link) => (
                <ProductCard key={link.id} link={link} onShareProduct={onShareProduct} onLinkClick={onLinkClick} onSaveProduct={onSaveProduct} />
              ))}
              {/* Add empty space if odd number of items in last row */}
              {row.length === 1 && <View style={{ width: CARD_WIDTH }} />}
            </View>
          ))}
        </>
      )}

      {/* Empty State */}
      {links.length === 0 && (
        <View className="items-center py-8">
          <Ionicons name="search-outline" size={48} color="#9CA3AF" />
          <Text className="text-[16px] text-foreground-muted mt-4 text-center">
            No products found from supported retailers
          </Text>
        </View>
      )}
    </View>
  );
}

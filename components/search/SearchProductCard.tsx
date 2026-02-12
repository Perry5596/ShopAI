import { useState } from 'react';
import {
  View, Text, Image, TouchableOpacity, Linking,
  ActionSheetIOS, Platform, Alert, Share,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { SearchProduct } from '@/types';
import { trackLinkClick } from '@/utils/ads-analytics';

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
  /** Called when the user saves/unsaves this product via long-press menu */
  onSaveProduct?: (productId: string) => Promise<boolean>;
}

const CARD_WIDTH = 160;

/**
 * Compact product card for horizontal carousel display.
 * Shows an "AI Pick" badge when recommended.
 * Long-press opens a native menu with Copy Link, Share, Save for Later.
 */
export function SearchProductCard({
  product,
  isRecommended,
  recommendReason,
  onLinkClick,
  onSaveProduct,
}: SearchProductCardProps) {
  const [isSaved, setIsSaved] = useState(product.isFavorite);

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onLinkClick?.();
    trackLinkClick(product.source, product.title, product.affiliateUrl);
    Linking.openURL(product.affiliateUrl);
  };

  const handleCopyLink = async () => {
    await Clipboard.setStringAsync(product.affiliateUrl);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `${product.title}\n${product.affiliateUrl}`,
        url: product.affiliateUrl, // iOS uses this
      });
    } catch {
      // User cancelled — ignore
    }
  };

  const handleSaveForLater = async () => {
    if (!onSaveProduct) return;
    try {
      // Optimistic update
      const prev = isSaved;
      setIsSaved(!prev);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      const newState = await onSaveProduct(product.id);
      setIsSaved(newState);
    } catch {
      // Revert on failure
      setIsSaved(product.isFavorite);
    }
  };

  const handleLongPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const saveLabel = isSaved ? 'Remove from Saved' : 'Save for Later';

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Copy Link', 'Share', saveLabel, 'Cancel'],
          cancelButtonIndex: 3,
        },
        (buttonIndex) => {
          if (buttonIndex === 0) handleCopyLink();
          else if (buttonIndex === 1) handleShare();
          else if (buttonIndex === 2) handleSaveForLater();
        }
      );
    } else {
      // Android fallback: use Alert as a simple action menu
      Alert.alert(
        product.title,
        undefined,
        [
          { text: 'Copy Link', onPress: handleCopyLink },
          { text: 'Share', onPress: handleShare },
          { text: saveLabel, onPress: handleSaveForLater },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    }
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      onLongPress={handleLongPress}
      delayLongPress={400}
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

        {/* Brand */}
        <View className="flex-row items-center justify-between">
          {product.brand ? (
            <Text className="text-[10px] text-foreground-muted flex-1 mr-1" numberOfLines={1}>
              {product.brand}
            </Text>
          ) : (
            <View className="flex-1" />
          )}
          <Ionicons name="open-outline" size={10} color="#9CA3AF" />
        </View>
      </View>
    </TouchableOpacity>
  );
}

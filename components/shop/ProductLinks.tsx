import { View, Text, Image, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FontAwesome5, FontAwesome6 } from '@expo/vector-icons';
import { Badge } from '../ui/Badge';
import type { ProductLink } from '@/types';
import * as Haptics from 'expo-haptics';

interface ProductLinksProps {
  links: ProductLink[];
  recommendation?: ProductLink;
}

/**
 * Get retailer-specific icon and color based on source name
 */
function getRetailerStyle(source: string): {
  icon: React.ReactNode;
  bgColor: string;
} {
  const sourceLower = source.toLowerCase();

  if (sourceLower.includes('amazon')) {
    return {
      icon: <FontAwesome5 name="amazon" size={20} color="#FF9900" />,
      bgColor: 'bg-[#232F3E]',
    };
  }
  if (sourceLower.includes('ebay')) {
    return {
      icon: <Text className="text-[12px] font-bold text-white">eBay</Text>,
      bgColor: 'bg-[#E53238]',
    };
  }
  if (sourceLower.includes('target')) {
    return {
      icon: <FontAwesome6 name="bullseye" size={18} color="#CC0000" />,
      bgColor: 'bg-white',
    };
  }
  if (sourceLower.includes('best buy') || sourceLower.includes('bestbuy')) {
    return {
      icon: <Text className="text-[10px] font-bold text-[#FFE000]">BBY</Text>,
      bgColor: 'bg-[#0046BE]',
    };
  }
  if (sourceLower.includes('walmart')) {
    return {
      icon: <FontAwesome6 name="star" size={16} color="#FFC220" />,
      bgColor: 'bg-[#0071DC]',
    };
  }

  // Default fallback
  return {
    icon: <Ionicons name="bag-outline" size={20} color="#9CA3AF" />,
    bgColor: 'bg-background-secondary',
  };
}

function ProductLinkItem({ link }: { link: ProductLink }) {
  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Linking.openURL(link.affiliateUrl);
  };

  const retailerStyle = getRetailerStyle(link.source);

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.7}
      className="flex-row items-center bg-card rounded-xl p-3 mb-2 border border-border-light">
      {/* Retailer Logo / Product Image */}
      <View className={`w-14 h-14 rounded-lg overflow-hidden mr-3 items-center justify-center ${retailerStyle.bgColor}`}>
        {link.imageUrl ? (
          <Image
            source={{ uri: link.imageUrl }}
            className="w-full h-full"
            resizeMode="cover"
          />
        ) : (
          retailerStyle.icon
        )}
      </View>

      {/* Product Info */}
      <View className="flex-1">
        <Text className="text-[14px] font-medium text-foreground" numberOfLines={1}>
          {link.title}
        </Text>
        <View className="flex-row items-center mt-1">
          {link.price ? (
            <Text className="text-[16px] font-bold text-foreground">{link.price}</Text>
          ) : (
            <Text className="text-[14px] text-foreground-muted italic">Price not available</Text>
          )}
          <Text className="text-[12px] text-foreground-muted ml-2">{link.source}</Text>
        </View>
        {link.rating && (
          <View className="flex-row items-center mt-1">
            <Ionicons name="star" size={12} color="#F59E0B" />
            <Text className="text-[12px] text-foreground-muted ml-1">
              {link.rating} ({link.reviewCount})
            </Text>
          </View>
        )}
      </View>

      {/* Arrow */}
      <Ionicons name="open-outline" size={20} color="#9CA3AF" />
    </TouchableOpacity>
  );
}

function RecommendedItem({ link }: { link: ProductLink }) {
  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Linking.openURL(link.affiliateUrl);
  };

  const retailerStyle = getRetailerStyle(link.source);

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.7}
      className="bg-amber-50 rounded-xl p-4 mb-4 border border-amber-200">
      <View className="flex-row items-center mb-2">
        <Ionicons name="sparkles" size={16} color="#F59E0B" />
        <Text className="text-[14px] font-semibold text-amber-700 ml-1">
          AI Recommendation
        </Text>
        <Badge text="Best Match" variant="premium" className="ml-auto" />
      </View>

      <View className="flex-row items-center">
        {/* Retailer Logo / Product Image */}
        <View className={`w-16 h-16 rounded-lg overflow-hidden mr-3 items-center justify-center ${link.imageUrl ? 'bg-white' : retailerStyle.bgColor}`}>
          {link.imageUrl ? (
            <Image
              source={{ uri: link.imageUrl }}
              className="w-full h-full"
              resizeMode="cover"
            />
          ) : (
            retailerStyle.icon
          )}
        </View>

        <View className="flex-1">
          <Text className="text-[15px] font-semibold text-foreground" numberOfLines={2}>
            {link.title}
          </Text>
          <View className="flex-row items-center mt-1">
            {link.price ? (
              <Text className="text-[18px] font-bold text-foreground">{link.price}</Text>
            ) : (
              <Text className="text-[14px] text-foreground-muted italic">Price not available</Text>
            )}
            <Text className="text-[12px] text-foreground-muted ml-2">{link.source}</Text>
          </View>
        </View>

        <Ionicons name="open-outline" size={24} color="#B45309" />
      </View>
    </TouchableOpacity>
  );
}

export function ProductLinks({ links, recommendation }: ProductLinksProps) {
  const filteredLinks = links.filter((l) => l.id !== recommendation?.id);

  return (
    <View className="px-5 pt-4">
      {/* Recommendation */}
      {recommendation && <RecommendedItem link={recommendation} />}

      {/* Other Links */}
      <Text className="text-[16px] font-semibold text-foreground mb-3">
        {links.length} product{links.length !== 1 ? 's' : ''} found
      </Text>

      {/* Render as regular View instead of FlatList to avoid nesting issues */}
      {filteredLinks.map((link) => (
        <ProductLinkItem key={link.id} link={link} />
      ))}
    </View>
  );
}

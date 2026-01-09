import { View, Text, Image, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { Shop } from '@/types';

interface RecentShopsProps {
  shops: Shop[];
}

function ShopItem({ shop }: { shop: Shop }) {
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  return (
    <TouchableOpacity
      className="flex-row bg-card rounded-2xl overflow-hidden mb-3"
      activeOpacity={0.7}
      onPress={() => router.push(`/(app)/shop/${shop.id}`)}
      style={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 1,
      }}>
      {/* Thumbnail */}
      <View className="w-28 h-28 bg-background-secondary">
        {shop.imageUrl ? (
          <Image
            source={{ uri: shop.imageUrl }}
            className="w-full h-full"
            resizeMode="cover"
          />
        ) : (
          <View className="w-full h-full items-center justify-center">
            <Ionicons name="image-outline" size={32} color="#9CA3AF" />
          </View>
        )}
      </View>

      {/* Content */}
      <View className="flex-1 p-3 justify-center">
        <View className="flex-row items-center justify-between mb-1">
          <Text
            className="text-[16px] font-inter-medium text-foreground flex-1"
            numberOfLines={1}>
            {shop.title}
          </Text>
          <Text className="text-[12px] font-inter text-foreground-muted ml-2">
            {formatTime(shop.createdAt)}
          </Text>
        </View>

        {shop.products.length > 0 && (
          <View className="flex-row items-center mt-1">
            <Ionicons name="link-outline" size={14} color="#6B7280" />
            <Text className="text-[13px] font-inter text-foreground-muted ml-1">
              {shop.products.length} link{shop.products.length !== 1 ? 's' : ''} found
            </Text>
          </View>
        )}

        {shop.recommendation && (
          <View className="flex-row items-center mt-1">
            <Ionicons name="sparkles" size={14} color="#F59E0B" />
            <Text className="text-[13px] font-inter text-amber-600 ml-1" numberOfLines={1}>
              {shop.recommendation.title}
            </Text>
          </View>
        )}
      </View>

      {/* Chevron */}
      <View className="justify-center pr-3">
        <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
      </View>
    </TouchableOpacity>
  );
}

export function RecentShops({ shops }: RecentShopsProps) {
  if (shops.length === 0) {
    return (
      <View className="items-center justify-center py-12">
        <View className="w-16 h-16 rounded-full bg-background-secondary items-center justify-center mb-4">
          <Ionicons name="bag-outline" size={32} color="#9CA3AF" />
        </View>
        <Text className="text-[16px] font-inter-medium text-foreground-muted">No shops yet</Text>
        <Text className="text-[14px] font-inter text-foreground-subtle mt-1 text-center px-8">
          Tap the + button to scan your first item
        </Text>
      </View>
    );
  }

  return (
    <View>
      <Text className="text-[18px] font-inter-semibold text-foreground mb-4 px-5">
        Recent shops
      </Text>
      <View className="px-5">
        {shops.map((shop) => (
          <ShopItem key={shop.id} shop={shop} />
        ))}
      </View>
    </View>
  );
}

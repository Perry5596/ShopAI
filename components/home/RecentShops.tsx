import { View, Text, Image, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { Shop } from '@/types';

interface RecentShopsProps {
  shops: Shop[];
  isLoadingMore?: boolean;
  hasMore?: boolean;
}

function ShopItem({ shop }: { shop: Shop }) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const shopDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    
    // Check if it's today
    const isToday = today.getTime() === shopDate.getTime();
    
    if (isToday) {
      // Today: show time only
      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    } else {
      // Not today: show date only
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
      });
    }
  };

  const isProcessing = shop.status === 'processing';
  const isFailed = shop.status === 'failed';

  return (
    <TouchableOpacity
      className="flex-row bg-card rounded-2xl overflow-hidden mb-3"
      activeOpacity={0.7}
      onPress={() => router.push(`/(app)/shop/${shop.id}`)}
      style={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 6,
        elevation: 4,
      }}>
      {/* Thumbnail */}
      <View className="w-28 h-28 bg-background-secondary">
        {shop.imageUrl ? (
          <View className="w-full h-full">
            <Image
              source={{ uri: shop.imageUrl }}
              className="w-full h-full"
              resizeMode="cover"
            />
            {/* Processing overlay */}
            {isProcessing && (
              <View className="absolute inset-0 bg-black/40 items-center justify-center">
                <ActivityIndicator size="small" color="#FFFFFF" />
              </View>
            )}
            {/* Failed overlay */}
            {isFailed && (
              <View className="absolute inset-0 bg-red-500/20 items-center justify-center">
                <Ionicons name="alert-circle" size={24} color="#EF4444" />
              </View>
            )}
          </View>
        ) : (
          <View className="w-full h-full items-center justify-center">
            <Ionicons name="image-outline" size={32} color="#9CA3AF" />
          </View>
        )}
      </View>

      {/* Content */}
      <View className="flex-1 p-3 justify-center">
        <View className="flex-row items-center justify-between mb-1">
          {isProcessing ? (
            <View className="flex-row items-center flex-1">
              <Text
                className="text-[16px] font-inter-medium text-foreground-muted flex-1"
                numberOfLines={1}>
                Analyzing...
              </Text>
            </View>
          ) : (
            <Text
              className={`text-[16px] font-inter-medium flex-1 ${isFailed ? 'text-red-500' : 'text-foreground'}`}
              numberOfLines={1}>
              {isFailed ? 'Analysis Failed' : shop.title}
            </Text>
          )}
          <Text className="text-[12px] font-inter text-foreground-muted ml-2">
            {formatDate(shop.createdAt)}
          </Text>
        </View>

        {/* Processing state content */}
        {isProcessing && (
          <View className="flex-row items-center mt-1">
            <Ionicons name="hourglass-outline" size={14} color="#6B7280" />
            <Text className="text-[13px] font-inter text-foreground-muted ml-1">
              Finding products...
            </Text>
          </View>
        )}

        {/* Failed state content */}
        {isFailed && (
          <View className="flex-row items-center mt-1">
            <Ionicons name="refresh-outline" size={14} color="#EF4444" />
            <Text className="text-[13px] font-inter text-red-500 ml-1">
              Tap to view details
            </Text>
          </View>
        )}

        {/* Completed state content */}
        {!isProcessing && !isFailed && (
          <>
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
          </>
        )}
      </View>

      {/* Chevron */}
      <View className="justify-center pr-3">
        <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
      </View>
    </TouchableOpacity>
  );
}

type ShopSection = {
  title: string;
  shops: Shop[];
};

export function RecentShops({ shops, isLoadingMore, hasMore }: RecentShopsProps) {
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

  // Group shops by time period
  const groupShopsByTime = (shops: Shop[]): ShopSection[] => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const oneWeekAgo = new Date(today);
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const oneMonthAgo = new Date(today);
    oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);

    const sections: ShopSection[] = [
      { title: 'Today', shops: [] },
      { title: 'This Week', shops: [] },
      { title: 'This Month', shops: [] },
      { title: 'Older', shops: [] },
    ];

    shops.forEach((shop) => {
      const shopDate = new Date(shop.createdAt);
      const shopDateOnly = new Date(shopDate.getFullYear(), shopDate.getMonth(), shopDate.getDate());
      
      const daysDiff = Math.floor((today.getTime() - shopDateOnly.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysDiff === 0) {
        sections[0].shops.push(shop);
      } else if (daysDiff <= 7) {
        sections[1].shops.push(shop);
      } else if (daysDiff <= 30) {
        sections[2].shops.push(shop);
      } else {
        sections[3].shops.push(shop);
      }
    });

    // Filter out empty sections
    return sections.filter((section) => section.shops.length > 0);
  };

  const sections = groupShopsByTime(shops);

  return (
    <View>
      <Text className="text-[18px] font-inter-semibold text-foreground mb-4 px-5">
        Recent shops
      </Text>
      <View className="px-5">
        {sections.map((section, sectionIndex) => (
          <View key={section.title}>
            {/* Section Header */}
            <Text className={`text-[14px] font-inter-semibold text-foreground-muted mb-3 ${sectionIndex === 0 ? '' : 'mt-4'}`}>
              {section.title}
            </Text>
            
            {/* Section Shops */}
            {section.shops.map((shop) => (
              <ShopItem key={shop.id} shop={shop} />
            ))}
          </View>
        ))}
        
        {/* Loading more indicator */}
        {isLoadingMore && (
          <View className="items-center py-4">
            <ActivityIndicator size="small" color="#000000" />
            <Text className="text-[13px] font-inter text-foreground-muted mt-2">
              Loading more...
            </Text>
          </View>
        )}
        
        {/* End of list indicator */}
        {!hasMore && shops.length > 0 && (
          <View className="items-center py-4">
            <Text className="text-[13px] font-inter text-foreground-subtle">
              You&apos;ve seen all your shops
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

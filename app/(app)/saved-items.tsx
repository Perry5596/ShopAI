import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { IconButton } from '@/components/ui/IconButton';
import { RecentShops } from '@/components/home/RecentShops';
import { useAuth } from '@/contexts/AuthContext';
import { shopService } from '@/utils/supabase-service';
import { useState, useEffect } from 'react';
import type { Shop } from '@/types';

export default function SavedItemsScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [favoriteShops, setFavoriteShops] = useState<Shop[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.id) {
      loadFavoriteShops();
    }
  }, [user?.id]);

  const loadFavoriteShops = async () => {
    if (!user?.id) return;
    
    setIsLoading(true);
    setError(null);
    try {
      const { shops } = await shopService.fetchFavoriteShops(user.id);
      setFavoriteShops(shops);
    } catch (err) {
      console.error('Failed to load favorite shops:', err);
      setError(err instanceof Error ? err.message : 'Failed to load saved items');
    } finally {
      setIsLoading(false);
    }
  };

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
        ) : favoriteShops.length === 0 ? (
          <View className="items-center justify-center py-12">
            <View className="w-16 h-16 rounded-full bg-background-secondary items-center justify-center mb-4">
              <Ionicons name="bookmark-outline" size={32} color="#9CA3AF" />
            </View>
            <Text className="text-[16px] font-inter-medium text-foreground-muted">
              No saved items yet
            </Text>
            <Text className="text-[14px] font-inter text-foreground-subtle mt-1 text-center px-8">
              Tap the bookmark icon on any shop to save it here
            </Text>
          </View>
        ) : (
          <RecentShops shops={favoriteShops} isLoadingMore={false} hasMore={false} />
        )}
      </ScrollView>
    </View>
  );
}

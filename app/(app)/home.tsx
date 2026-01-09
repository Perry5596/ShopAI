import { useEffect } from 'react';
import { View, ScrollView, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Header, StatsCard, MiniStatsRow, RecentShops, FloatingActionButton } from '@/components/home';
import { useAuth } from '@/contexts/AuthContext';
import { useShopStore } from '@/stores';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { profile, user } = useAuth();
  const { shops, isLoading, error, fetchShops } = useShopStore();

  // Fetch shops when user is available
  useEffect(() => {
    if (user?.id) {
      fetchShops(user.id);
    }
  }, [user?.id, fetchShops]);

  // Calculate stats from actual shops
  const completedShops = shops.filter((s) => s.status === 'completed');
  const totalProducts = completedShops.reduce((acc, s) => acc + s.products.length, 0);
  const totalFavorites = shops.filter((s) => s.isFavorite).length;

  // Calculate shops created this week
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const thisWeek = shops.filter((s) => new Date(s.createdAt) >= oneWeekAgo).length;

  return (
    <LinearGradient
      colors={['#F5F5F7', '#FFFFFF']}
      locations={[0, 0.4]}
      style={{ flex: 1 }}>
      {/* Content - Header scrolls with content */}
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top, paddingBottom: 100 }}>
        {/* Header */}
        <Header
          userName={profile?.name}
          userAvatar={profile?.avatarUrl}
        />

        {/* Stats Section */}
        <View className="pt-4">
          {/* Main Stats Card */}
          <StatsCard
            totalShops={shops.length}
            totalProducts={totalProducts}
            favorites={totalFavorites}
            thisWeek={thisWeek}
          />

          {/* Mini Stats Row */}
          <MiniStatsRow
            favorites={totalFavorites}
            products={totalProducts}
            savings={47}
          />
        </View>

        {/* Loading State */}
        {isLoading && shops.length === 0 && (
          <View className="items-center justify-center py-12">
            <ActivityIndicator size="large" color="#000000" />
            <Text className="text-[14px] font-inter text-foreground-muted mt-3">
              Loading your shops...
            </Text>
          </View>
        )}

        {/* Error State */}
        {error && shops.length === 0 && (
          <View className="items-center justify-center py-12 px-8">
            <Text className="text-[16px] font-inter-medium text-red-500 text-center">
              {error}
            </Text>
          </View>
        )}

        {/* Recent Shops */}
        {!isLoading && (
          <View>
            <RecentShops shops={shops} />
          </View>
        )}
      </ScrollView>

      {/* Gradient fade for safe area at top */}
      <LinearGradient
        colors={[
          'rgba(255,255,255,0.95)', 
          'rgba(255,255,255,0.6)', 
          'rgba(255,255,255,0.0)'
        ]}
        locations={[0, 0.35, 0.5]}
        style={[styles.blurOverlay, { height: insets.top * 2 }]}
        pointerEvents="none"
      />

      {/* Floating Action Button */}
      <FloatingActionButton />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  blurOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
});

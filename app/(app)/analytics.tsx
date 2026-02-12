import { View, Text, ScrollView, StyleSheet, RefreshControl, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BottomTabBar } from '@/components/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useAnalyticsData } from '@/hooks/useAnalyticsData';
import {
  HeroStats,
  SavingsChart,
  ActivityChart,
  RetailerBreakdown,
  PriceDistribution,
  TopBrands,
  ShoppingHabits,
  CategoryInsights,
  EngagementFunnel,
  ChartCard,
} from '@/components/analytics';
import { useState, useCallback } from 'react';

export default function AnalyticsScreen() {
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  const {
    data,
    isLoading,
    error,
    refresh,
    savingsRange,
    setSavingsRange,
    activityRange,
    setActivityRange,
  } = useAnalyticsData(user?.id, profile ?? null);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    refresh();
    // Give it a moment to show the refresh indicator
    setTimeout(() => setRefreshing(false), 1000);
  }, [refresh]);

  // Format member since date
  const memberSinceText = data?.memberSince
    ? formatMemberSince(data.memberSince)
    : null;

  return (
    <LinearGradient
      colors={['#EBEBED', '#F5F5F7']}
      locations={[0, 0.25]}
      style={{ flex: 1 }}>
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top, paddingBottom: 140 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#000000"
            progressViewOffset={insets.top}
          />
        }>
        {/* Header */}
        <View className="flex-row items-center justify-between px-5 py-5 mt-4">
          <Text className="text-[32px] font-inter-bold text-foreground">
            Analytics
          </Text>
        </View>

        {/* Loading State */}
        {isLoading && !data && (
          <View className="items-center py-20">
            <ActivityIndicator size="large" color="#000000" />
            <Text className="text-[14px] font-inter text-foreground-muted mt-3">
              Loading your analytics...
            </Text>
          </View>
        )}

        {/* Error State */}
        {error && !data && (
          <ChartCard>
            <View className="items-center py-6">
              <View className="w-14 h-14 bg-red-50 rounded-full items-center justify-center mb-3">
                <Ionicons name="alert-circle" size={28} color="#EF4444" />
              </View>
              <Text className="text-[16px] font-inter-semibold text-foreground mb-1">
                Something went wrong
              </Text>
              <Text className="text-[13px] font-inter text-foreground-muted text-center">
                Pull down to refresh and try again
              </Text>
            </View>
          </ChartCard>
        )}

        {/* Analytics Content */}
        {data && (
          <>
            {/* 1. Hero Stats Row */}
            <HeroStats stats={data.heroStats} />

            {/* 2. Savings Over Time */}
            <SavingsChart
              data={data.savingsTimeSeries}
              range={savingsRange}
              onRangeChange={setSavingsRange}
              totalSavings={data.heroStats.totalSavings}
            />

            {/* 3. Activity Timeline */}
            <ActivityChart
              data={data.activityTimeSeries}
              range={activityRange}
              onRangeChange={setActivityRange}
            />

            {/* 4. Retailer Breakdown */}
            <RetailerBreakdown data={data.retailerBreakdown} />

            {/* 5. Price Distribution */}
            <PriceDistribution data={data.priceDistribution} />

            {/* 6. Top Brands (conditional) */}
            <TopBrands data={data.topBrands} />

            {/* 7. Shopping Habits */}
            <ShoppingHabits
              data={data.shoppingHabits}
              hasData={data.hasShopData || data.hasSearchData}
            />

            {/* 8. Category Insights (conditional) */}
            <CategoryInsights data={data.categoryInsights} />

            {/* 9. Engagement Funnel */}
            <EngagementFunnel data={data.engagementFunnel} />

            {/* 10. Member Since Footer */}
            {memberSinceText && (
              <View className="items-center pt-4 pb-2 px-5">
                <View className="flex-row items-center">
                  <Ionicons name="time-outline" size={14} color="#9CA3AF" />
                  <Text className="text-[13px] font-inter text-foreground-subtle ml-1.5">
                    {memberSinceText}
                  </Text>
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Gradient fade for safe area at top */}
      <LinearGradient
        colors={[
          'rgba(255,255,255,0.95)',
          'rgba(255,255,255,0.6)',
          'rgba(255,255,255,0.0)',
        ]}
        locations={[0, 0.35, 0.5]}
        style={[styles.blurOverlay, { height: insets.top * 2 }]}
        pointerEvents="none"
      />

      {/* Bottom Tab Bar */}
      <BottomTabBar />
    </LinearGradient>
  );
}

/**
 * Format a createdAt ISO string into a human-readable "Member for X" label.
 */
function formatMemberSince(createdAt: string): string {
  const created = new Date(createdAt);
  const now = new Date();
  const diffMs = now.getTime() - created.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 1) return 'Joined today';
  if (diffDays === 1) return 'Member for 1 day';
  if (diffDays < 30) return `Member for ${diffDays} days`;

  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths === 1) return 'Member for 1 month';
  if (diffMonths < 12) return `Member for ${diffMonths} months`;

  const diffYears = Math.floor(diffMonths / 12);
  const remainingMonths = diffMonths % 12;
  if (diffYears === 1 && remainingMonths === 0) return 'Member for 1 year';
  if (remainingMonths === 0) return `Member for ${diffYears} years`;
  return `Member for ${diffYears}y ${remainingMonths}m`;
}

const styles = StyleSheet.create({
  blurOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
});

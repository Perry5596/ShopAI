import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BottomTabBar } from '@/components/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function AnalyticsScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();

  // Get stats from profile
  const totalShops = profile?.totalShops ?? 0;
  const totalProducts = profile?.totalProducts ?? 0;
  const totalSavings = profile?.totalSavings ?? 0;
  const savingsInDollars = Math.round(totalSavings / 100);

  return (
    <LinearGradient
      colors={['#EBEBED', '#F5F5F7']}
      locations={[0, 0.25]}
      style={{ flex: 1 }}>
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top, paddingBottom: 140 }}>
        {/* Header - same styling as home page */}
        <View className="flex-row items-center justify-between px-5 py-3 mt-4">
          <Text className="text-[26px] font-inter-bold text-foreground">
            Analytics
          </Text>
        </View>

        {/* Stats Overview */}
        <View className="px-5 pt-6">
          <Text className="text-[18px] font-inter-semibold text-foreground mb-4">
            Your Shopping Stats
          </Text>

          {/* Stats Grid */}
          <View className="flex-row flex-wrap gap-3">
            {/* Total Shops */}
            <View
              className="flex-1 min-w-[45%] bg-card rounded-2xl p-4"
              style={{
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.06,
                shadowRadius: 4,
                elevation: 2,
              }}>
              <View className="w-10 h-10 bg-blue-100 rounded-full items-center justify-center mb-3">
                <Ionicons name="bag" size={20} color="#3B82F6" />
              </View>
              <Text className="text-[28px] font-inter-bold text-foreground">
                {totalShops}
              </Text>
              <Text className="text-[14px] font-inter text-foreground-muted">
                Total Shops
              </Text>
            </View>

            {/* Total Products */}
            <View
              className="flex-1 min-w-[45%] bg-card rounded-2xl p-4"
              style={{
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.06,
                shadowRadius: 4,
                elevation: 2,
              }}>
              <View className="w-10 h-10 bg-green-100 rounded-full items-center justify-center mb-3">
                <Ionicons name="cube" size={20} color="#22C55E" />
              </View>
              <Text className="text-[28px] font-inter-bold text-foreground">
                {totalProducts}
              </Text>
              <Text className="text-[14px] font-inter text-foreground-muted">
                Products Found
              </Text>
            </View>

            {/* Total Savings */}
            <View
              className="flex-1 min-w-[45%] bg-card rounded-2xl p-4"
              style={{
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.06,
                shadowRadius: 4,
                elevation: 2,
              }}>
              <View className="w-10 h-10 bg-purple-100 rounded-full items-center justify-center mb-3">
                <Ionicons name="cash" size={20} color="#A855F7" />
              </View>
              <Text className="text-[28px] font-inter-bold text-foreground">
                ${savingsInDollars}
              </Text>
              <Text className="text-[14px] font-inter text-foreground-muted">
                Total Savings
              </Text>
            </View>
          </View>
        </View>

        {/* Coming Soon Section */}
        <View className="px-5 pt-8">
          <View
            className="bg-card rounded-2xl p-6 items-center"
            style={{
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.06,
              shadowRadius: 4,
              elevation: 2,
            }}>
            <View className="w-16 h-16 bg-gray-100 rounded-full items-center justify-center mb-4">
              <Ionicons name="trending-up" size={32} color="#6B7280" />
            </View>
            <Text className="text-[18px] font-inter-semibold text-foreground text-center mb-2">
              More Analytics Coming Soon
            </Text>
            <Text className="text-[14px] font-inter text-foreground-muted text-center">
              We're working on detailed charts and insights to help you track your shopping patterns and savings over time.
            </Text>
          </View>
        </View>
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

      {/* Bottom Tab Bar */}
      <BottomTabBar />
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

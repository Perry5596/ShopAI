import { View, TouchableOpacity, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import { Avatar } from '../ui/Avatar';
import { useAuth } from '@/contexts/AuthContext';
import { useSearchStore } from '@/stores/searchStore';

type TabItem = {
  name: string;
  route: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconActive: keyof typeof Ionicons.glyphMap;
  label: string;
};

const tabs: TabItem[] = [
  {
    name: 'home',
    route: '/(app)/home',
    icon: 'home-outline',
    iconActive: 'home',
    label: 'Home',
  },
  {
    name: 'analytics',
    route: '/(app)/analytics',
    icon: 'bar-chart-outline',
    iconActive: 'bar-chart',
    label: 'Analytics',
  },
  {
    name: 'profile',
    route: '/(app)/profile',
    icon: 'person-outline',
    iconActive: 'person',
    label: 'Profile',
  },
];

export function BottomTabBar() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const { profile, isGuest } = useAuth();
  const clearActiveConversation = useSearchStore((s) => s.clearActiveConversation);

  // Animation values
  const menuOpen = useSharedValue(0); // 0 = closed, 1 = open

  const handleTabPress = (route: string) => {
    // Close menu if open
    if (menuOpen.value > 0.5) {
      menuOpen.value = withSpring(0, { damping: 20, stiffness: 300 });
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(route as any);
  };

  const handlePlusPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (menuOpen.value > 0.5) {
      menuOpen.value = withSpring(0, { damping: 20, stiffness: 300 });
    } else {
      menuOpen.value = withSpring(1, { damping: 18, stiffness: 280 });
    }
  };

  const closeMenu = () => {
    menuOpen.value = withSpring(0, { damping: 20, stiffness: 300 });
  };

  const handleScanProduct = () => {
    closeMenu();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTimeout(() => router.push('/(app)/snap'), 100);
  };

  const handleSearchProducts = () => {
    closeMenu();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    clearActiveConversation();
    setTimeout(() => router.push('/(app)/search' as any), 100);
  };

  const isActive = (route: string) => {
    const normalizedRoute = route.replace(/\([^)]+\)/g, '').replace(/\/+/g, '/');
    return pathname === normalizedRoute || pathname.startsWith(normalizedRoute + '/');
  };

  // Animated styles for the + button rotation
  const plusButtonStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${interpolate(menuOpen.value, [0, 1], [0, 45])}deg` }],
  }));

  // Animated styles for the backdrop
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: menuOpen.value * 0.4,
    pointerEvents: menuOpen.value > 0.1 ? 'auto' as const : 'none' as const,
  }));

  // Animated styles for the menu container
  const menuContainerStyle = useAnimatedStyle(() => ({
    opacity: menuOpen.value,
    transform: [
      { translateY: interpolate(menuOpen.value, [0, 1], [30, 0]) },
      { scale: interpolate(menuOpen.value, [0, 1], [0.9, 1]) },
    ],
    pointerEvents: menuOpen.value > 0.5 ? 'auto' as const : 'none' as const,
  }));

  // Staggered animations for each button
  const scanButtonStyle = useAnimatedStyle(() => ({
    opacity: interpolate(menuOpen.value, [0.2, 0.7], [0, 1]),
    transform: [
      { translateY: interpolate(menuOpen.value, [0.2, 0.7], [20, 0]) },
    ],
  }));

  const searchButtonStyle = useAnimatedStyle(() => ({
    opacity: interpolate(menuOpen.value, [0.35, 0.85], [0, 1]),
    transform: [
      { translateY: interpolate(menuOpen.value, [0.35, 0.85], [20, 0]) },
    ],
  }));

  return (
    <>
      {/* Backdrop - covers the whole screen when menu is open */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: '#000',
            zIndex: 40,
          },
          backdropStyle,
        ]}>
        <Pressable onPress={closeMenu} style={{ flex: 1 }} />
      </Animated.View>

      {/* Floating action buttons - positioned above the tab bar */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            bottom: insets.bottom + 80,
            right: 16,
            zIndex: 50,
          },
          menuContainerStyle,
        ]}>
        <View className="flex-row" style={{ gap: 12 }}>
          {/* Scan Product Button */}
          <Animated.View style={scanButtonStyle}>
            <TouchableOpacity
              onPress={handleScanProduct}
              activeOpacity={0.85}
              className="bg-white rounded-2xl items-center justify-center"
              style={{
                width: 140,
                height: 120,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.15,
                shadowRadius: 12,
                elevation: 6,
              }}>
              <View className="w-14 h-14 rounded-full bg-gray-100 items-center justify-center mb-2.5">
                <Ionicons name="camera-outline" size={28} color="#000" />
              </View>
              <Text className="text-[14px] font-inter-semibold text-foreground">
                Scan Product
              </Text>
            </TouchableOpacity>
          </Animated.View>

          {/* Search Products Button */}
          <Animated.View style={searchButtonStyle}>
            <TouchableOpacity
              onPress={handleSearchProducts}
              activeOpacity={0.85}
              className="bg-white rounded-2xl items-center justify-center"
              style={{
                width: 140,
                height: 120,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.15,
                shadowRadius: 12,
                elevation: 6,
              }}>
              <View className="w-14 h-14 rounded-full bg-gray-100 items-center justify-center mb-2.5">
                <Ionicons name="search-outline" size={28} color="#000" />
              </View>
              <Text className="text-[14px] font-inter-semibold text-foreground">
                Search Products
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Animated.View>

      {/* Tab bar */}
      <View
        className="absolute bottom-0 left-0 right-0 flex-row items-center justify-center px-4"
        style={{ paddingBottom: insets.bottom + 8, zIndex: 45 }}>
        {/* Pill-shaped tab container */}
        <View
          className="flex-1 flex-row items-center justify-around rounded-full"
          style={{
            backgroundColor: 'rgba(255,255,255,0.95)',
            paddingVertical: 6,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 8,
            elevation: 5,
          }}>
          {tabs.map((tab) => {
            const active = isActive(tab.route);
            
            return (
              <TouchableOpacity
                key={tab.name}
                onPress={() => handleTabPress(tab.route)}
                activeOpacity={0.7}
                className={`items-center justify-center px-8 py-2 rounded-full ${
                  active ? 'bg-gray-200' : ''
                }`}>
                {tab.name === 'profile' ? (
                  <Avatar
                    imageUrl={isGuest ? undefined : profile?.avatarUrl}
                    name={isGuest ? 'User' : profile?.name}
                    size="sm"
                  />
                ) : (
                  <Ionicons
                    name={active ? tab.iconActive : tab.icon}
                    size={20}
                    color={active ? '#000000' : '#9CA3AF'}
                  />
                )}
                <Text
                  className={`mt-0.5 text-[10px] font-inter-medium ${
                    active ? 'text-foreground' : 'text-gray-400'
                  }`}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Plus / Close button */}
        <TouchableOpacity
          onPress={handlePlusPress}
          activeOpacity={0.9}
          className="ml-3 w-[60px] h-[60px] bg-foreground rounded-full items-center justify-center"
          style={{
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 8,
          }}>
          <Animated.View style={plusButtonStyle}>
            <Ionicons name="add" size={36} color="#FFFFFF" />
          </Animated.View>
        </TouchableOpacity>
      </View>
    </>
  );
}

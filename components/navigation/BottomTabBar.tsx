import { View, TouchableOpacity, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '../ui/Avatar';
import { useAuth } from '@/contexts/AuthContext';

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

  const handleTabPress = (route: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(route as any);
  };

  const handlePlusPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/(app)/snap');
  };

  const isActive = (route: string) => {
    // Check if the current path matches the tab route
    return pathname === route || pathname.startsWith(route + '/');
  };

  return (
    <View
      className="absolute bottom-0 left-0 right-0 flex-row items-center justify-center px-4"
      style={{ paddingBottom: insets.bottom + 8 }}>
      {/* Pill-shaped tab container */}
      <View
        className="flex-1 flex-row items-center justify-around bg-white rounded-full px-2"
        style={{
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
              className={`items-center justify-center px-4 py-1 rounded-full ${
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

      {/* Plus button - outside the pill, vertically centered */}
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
        <Ionicons name="add" size={30} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
}

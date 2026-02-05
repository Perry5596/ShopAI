import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface HeaderProps {
  streak?: number;
}

export function Header({ streak = 0 }: HeaderProps) {
  return (
    <View className="flex-row items-center justify-between px-5 py-3 mt-4">
      {/* Logo and App Name */}
      <View className="flex-row items-center">
        <Ionicons name="bag" size={32} color="#000000" />
        <Text className="text-[26px] font-inter-semibold text-foreground ml-2">Shop AI</Text>
      </View>

      {/* Daily Streak Indicator */}
      <View
        className="flex-row items-center bg-orange-50 px-3 py-1.5 rounded-full"
        style={{
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.05,
          shadowRadius: 2,
          elevation: 1,
        }}>
        <Text className="text-[18px]">🔥</Text>
        <Text className="text-[16px] font-inter-semibold text-orange-600 ml-1">
          {streak}
        </Text>
      </View>
    </View>
  );
}

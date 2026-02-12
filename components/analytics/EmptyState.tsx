import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface EmptyStateProps {
  icon: keyof typeof Ionicons.glyphMap;
  message: string;
}

export function EmptyState({ icon, message }: EmptyStateProps) {
  return (
    <View className="items-center py-6">
      <View className="w-12 h-12 bg-gray-100 rounded-full items-center justify-center mb-3">
        <Ionicons name={icon} size={22} color="#9CA3AF" />
      </View>
      <Text className="text-[13px] font-inter text-foreground-muted text-center px-4">
        {message}
      </Text>
    </View>
  );
}

import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PressableCard } from '../ui/Card';

interface InfoCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  onPress?: () => void;
}

export function InfoCard({
  title,
  value,
  subtitle,
  icon,
  iconColor = '#000000',
  onPress,
}: InfoCardProps) {
  return (
    <PressableCard
      variant="elevated"
      padding="md"
      className="w-40 mr-3"
      onPress={onPress}>
      <View className="flex-row items-center mb-2">
        {icon && (
          <View className="w-8 h-8 rounded-full bg-background-secondary items-center justify-center mr-2">
            <Ionicons name={icon} size={16} color={iconColor} />
          </View>
        )}
        <Text className="text-[12px] font-medium text-foreground-muted">{title}</Text>
      </View>
      
      <Text className="text-[28px] font-bold text-foreground">{value}</Text>
      
      {subtitle && (
        <Text className="text-[12px] text-foreground-subtle mt-1">{subtitle}</Text>
      )}
    </PressableCard>
  );
}

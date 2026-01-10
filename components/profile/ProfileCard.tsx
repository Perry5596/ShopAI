import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '../ui/Avatar';
import { Badge } from '../ui/Badge';

interface ProfileCardProps {
  name: string;
  username: string;
  avatarUrl?: string;
  isPremium?: boolean;
  onPress?: () => void;
}

export function ProfileCard({
  name,
  username,
  avatarUrl,
  isPremium = false,
  onPress,
}: ProfileCardProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      className="bg-card rounded-2xl p-4 flex-row items-center"
      style={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
        elevation: 2,
      }}>
      <Avatar imageUrl={avatarUrl} name={name} size="lg" />

      <View className="flex-1 ml-4">
        <View className="flex-row items-center">
          {isPremium && (
            <Badge
              text="Premium"
              variant="premium"
              icon="diamond-outline"
              className="mr-2"
            />
          )}
        </View>
        <Text className="text-[18px] font-inter-semibold text-foreground mt-1">{name}</Text>
        <Text className="text-[14px] font-inter-medium text-foreground-muted">@{username}</Text>
      </View>

      <Ionicons name="chevron-forward" size={24} color="#9CA3AF" />
    </TouchableOpacity>
  );
}

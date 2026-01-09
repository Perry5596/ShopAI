import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Avatar } from '../ui/Avatar';

interface HeaderProps {
  userName?: string;
  userAvatar?: string;
}

export function Header({ userName, userAvatar }: HeaderProps) {
  return (
    <View className="flex-row items-center justify-between px-5 py-3">
      {/* Logo and App Name */}
      <View className="flex-row items-center">
        <Ionicons name="bag" size={26} color="#000000" />
        <Text className="text-[22px] font-inter-semibold text-foreground ml-2">Shop AI</Text>
      </View>

      {/* Profile Button */}
      <TouchableOpacity
        onPress={() => router.push('/(app)/profile')}
        activeOpacity={0.7}>
        <Avatar imageUrl={userAvatar} name={userName} size="md" />
      </TouchableOpacity>
    </View>
  );
}

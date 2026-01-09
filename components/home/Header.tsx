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
        <View className="w-8 h-8 bg-accent rounded-lg items-center justify-center mr-2">
          <Ionicons name="bag" size={18} color="#FFFFFF" />
        </View>
        <Text className="text-[22px] font-bold text-foreground">Shop AI</Text>
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

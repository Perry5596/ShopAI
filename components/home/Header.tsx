import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Avatar } from '../ui/Avatar';

interface HeaderProps {
  userName?: string;
  userAvatar?: string;
  earnings?: number;
}

export function Header({ userName, userAvatar, earnings = 0 }: HeaderProps) {
  return (
    <View className="flex-row items-center justify-between px-5 py-3">
      {/* Logo and App Name */}
      <View className="flex-row items-center">
        <View className="w-8 h-8 bg-accent rounded-lg items-center justify-center mr-2">
          <Ionicons name="bag" size={18} color="#FFFFFF" />
        </View>
        <Text className="text-[22px] font-bold text-foreground">Shop AI</Text>
      </View>

      {/* Right side: Earnings + Profile */}
      <View className="flex-row items-center space-x-3">
        {/* Earnings Counter */}
        <TouchableOpacity
          className="flex-row items-center bg-background-secondary px-3 py-2 rounded-full"
          activeOpacity={0.7}>
          <Text className="text-[16px] mr-1">💵</Text>
          <Text className="text-[14px] font-semibold text-foreground">
            ${earnings.toFixed(2)}
          </Text>
        </TouchableOpacity>

        {/* Profile Button */}
        <TouchableOpacity
          onPress={() => router.push('/(app)/profile')}
          activeOpacity={0.7}>
          <Avatar imageUrl={userAvatar} name={userName} size="md" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

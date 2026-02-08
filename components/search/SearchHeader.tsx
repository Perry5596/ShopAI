import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

interface SearchHeaderProps {
  title?: string;
}

/**
 * Header bar for the search screen with back button and title.
 */
export function SearchHeader({ title }: SearchHeaderProps) {
  const insets = useSafeAreaInsets();

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  };

  return (
    <View
      className="bg-background border-b border-border-light"
      style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center px-4 py-3">
        <TouchableOpacity
          onPress={handleBack}
          activeOpacity={0.7}
          className="w-9 h-9 rounded-full bg-background-secondary items-center justify-center">
          <Ionicons name="chevron-back" size={20} color="#000" />
        </TouchableOpacity>
        <View className="flex-1 mx-3">
          <Text className="text-[17px] font-inter-semibold text-foreground" numberOfLines={1}>
            {title || 'Search Products'}
          </Text>
        </View>
      </View>
    </View>
  );
}

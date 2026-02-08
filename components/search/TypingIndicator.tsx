import { useEffect, useRef } from 'react';
import { View, Text, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface TypingIndicatorProps {
  /** Status text from the streaming agent (e.g., "Searching 3 categories...") */
  statusText?: string | null;
}

/**
 * Clean status indicator shown while the AI is working.
 * Displays a pulsing sparkle icon with the current status text.
 * No speech bubble — just centered, clean text with a subtle animation.
 */
export function TypingIndicator({ statusText }: TypingIndicatorProps) {
  const pulse = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.4,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();
    return () => animation.stop();
  }, [pulse]);

  return (
    <View className="items-center py-6 px-4">
      {/* Pulsing icon row */}
      <View className="flex-row items-center justify-center mb-2">
        <Animated.View style={{ opacity: pulse }}>
          <View className="flex-row items-center">
            <Ionicons name="sparkles" size={18} color="#6B7280" />
            <View className="mx-2.5 w-1 h-1 rounded-full bg-gray-300" />
            <Ionicons name="bag-outline" size={16} color="#9CA3AF" />
            <View className="mx-2.5 w-1 h-1 rounded-full bg-gray-300" />
            <Ionicons name="search" size={16} color="#9CA3AF" />
          </View>
        </Animated.View>
      </View>

      {/* Status text */}
      <Text className="text-[14px] font-inter-medium text-foreground-muted text-center">
        {statusText || 'Thinking...'}
      </Text>
    </View>
  );
}

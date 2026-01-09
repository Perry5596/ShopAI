import { View, Pressable, Dimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { useEffect } from 'react';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface BottomSheetModalProps {
  isVisible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  height?: number;
}

export function BottomSheetModal({
  isVisible,
  onClose,
  children,
  height = 300,
}: BottomSheetModalProps) {
  const translateY = useSharedValue(SCREEN_HEIGHT);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (isVisible) {
      translateY.value = withSpring(0, { damping: 20, stiffness: 300 });
      opacity.value = withTiming(1, { duration: 200 });
    } else {
      translateY.value = withSpring(SCREEN_HEIGHT, { damping: 20, stiffness: 300 });
      opacity.value = withTiming(0, { duration: 200 });
    }
  }, [isVisible]);

  const animatedSheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const animatedBackdropStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  if (!isVisible) return null;

  return (
    <View className="absolute inset-0 z-50">
      <Animated.View style={[{ flex: 1 }, animatedBackdropStyle]}>
        <Pressable onPress={onClose} className="flex-1">
          <BlurView intensity={20} tint="dark" className="flex-1" />
        </Pressable>
      </Animated.View>

      <Animated.View
        style={[
          {
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height,
          },
          animatedSheetStyle,
        ]}
        className="bg-background rounded-t-3xl">
        <View className="items-center pt-3 pb-2">
          <View className="w-10 h-1 bg-border rounded-full" />
        </View>
        {children}
      </Animated.View>
    </View>
  );
}

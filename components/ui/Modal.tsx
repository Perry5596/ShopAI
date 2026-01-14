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

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

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

interface CenteredModalProps {
  isVisible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  width?: number;
}

export function CenteredModal({
  isVisible,
  onClose,
  children,
  width = SCREEN_WIDTH * 0.8,
}: CenteredModalProps) {
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (isVisible) {
      scale.value = withTiming(1, { duration: 200 });
      opacity.value = withTiming(1, { duration: 200 });
    } else {
      scale.value = withTiming(0, { duration: 200 });
      opacity.value = withTiming(0, { duration: 200 });
    }
  }, [isVisible]);

  const animatedModalStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const animatedBackdropStyle = useAnimatedStyle(() => ({
    opacity: opacity.value * 0.4,
  }));

  if (!isVisible) return null;

  return (
    <View className="absolute inset-0 z-50">
      <Animated.View style={[{ flex: 1 }, animatedBackdropStyle]}>
        <Pressable onPress={onClose} className="flex-1">
          <View className="flex-1 bg-black" />
        </Pressable>
      </Animated.View>

      <View className="absolute inset-0 items-center justify-center px-5">
        <Pressable onPress={(e) => e.stopPropagation()}>
          <Animated.View
            style={[
              {
                width,
                maxWidth: 320,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 12,
                elevation: 8,
              },
              animatedModalStyle,
            ]}
            className="bg-background rounded-2xl overflow-hidden">
            {children}
          </Animated.View>
        </Pressable>
      </View>
    </View>
  );
}

interface FadeModalProps {
  isVisible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  width?: number;
}

/**
 * Simple fade-in/fade-out centered modal without scale animation.
 */
export function FadeModal({
  isVisible,
  onClose,
  children,
  width = SCREEN_WIDTH * 0.85,
}: FadeModalProps) {
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (isVisible) {
      opacity.value = withTiming(1, { duration: 200 });
    } else {
      opacity.value = withTiming(0, { duration: 150 });
    }
  }, [isVisible]);

  const animatedModalStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const animatedBackdropStyle = useAnimatedStyle(() => ({
    opacity: opacity.value * 0.5,
  }));

  if (!isVisible) return null;

  return (
    <View className="absolute inset-0 z-50">
      <Animated.View style={[{ flex: 1 }, animatedBackdropStyle]}>
        <Pressable onPress={onClose} className="flex-1">
          <View className="flex-1 bg-black" />
        </Pressable>
      </Animated.View>

      <View className="absolute inset-0 items-center justify-center px-5" pointerEvents="box-none">
        <Pressable onPress={(e) => e.stopPropagation()}>
          <Animated.View
            style={[
              {
                width,
                maxWidth: 340,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.25,
                shadowRadius: 16,
                elevation: 10,
              },
              animatedModalStyle,
            ]}
            className="bg-background rounded-2xl overflow-hidden">
            {children}
          </Animated.View>
        </Pressable>
      </View>
    </View>
  );
}

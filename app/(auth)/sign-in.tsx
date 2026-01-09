import { View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/ui/Button';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { useEffect } from 'react';

export default function SignInScreen() {
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(400);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    translateY.value = withSpring(0, { damping: 20, stiffness: 300 });
    backdropOpacity.value = withTiming(1, { duration: 200 });
  }, []);

  const handleClose = () => {
    translateY.value = withSpring(400, { damping: 20, stiffness: 300 });
    backdropOpacity.value = withTiming(0, { duration: 200 });
    setTimeout(() => router.back(), 200);
  };

  const handleAppleSignIn = () => {
    // TODO: Implement Apple Sign In
    router.replace('/(app)/home');
  };

  const handleGoogleSignIn = () => {
    // TODO: Implement Google Sign In
    router.replace('/(app)/home');
  };

  const animatedSheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const animatedBackdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  return (
    <View className="flex-1">
      {/* Backdrop */}
      <Animated.View style={[{ flex: 1 }, animatedBackdropStyle]}>
        <Pressable onPress={handleClose} className="flex-1">
          <BlurView intensity={25} tint="dark" className="flex-1" />
        </Pressable>
      </Animated.View>

      {/* Bottom Sheet */}
      <Animated.View
        style={animatedSheetStyle}
        className="absolute bottom-0 left-0 right-0 bg-background rounded-t-3xl">
        {/* Handle */}
        <View className="items-center pt-3 pb-2">
          <View className="w-10 h-1 bg-border rounded-full" />
        </View>

        {/* Content */}
        <View className="px-6 pt-4" style={{ paddingBottom: insets.bottom + 24 }}>
          {/* Title */}
          <Text className="text-[28px] font-bold text-foreground text-center mb-2">
            Welcome
          </Text>
          <Text className="text-[16px] text-foreground-muted text-center mb-8">
            Sign in to start shopping smarter
          </Text>

          {/* Sign In Buttons */}
          <View className="space-y-3">
            {/* Apple Sign In */}
            <Button
              title="Continue with Apple"
              variant="primary"
              size="lg"
              icon="logo-apple"
              fullWidth
              onPress={handleAppleSignIn}
              className="mb-3"
            />

            {/* Google Sign In */}
            <Button
              title="Continue with Google"
              variant="outline"
              size="lg"
              icon="logo-google"
              fullWidth
              onPress={handleGoogleSignIn}
            />
          </View>

          {/* Terms */}
          <Text className="text-[12px] text-foreground-subtle text-center mt-6 px-4">
            By signing in, you agree to our{' '}
            <Text className="text-foreground-muted underline">Terms of Service</Text>
            {' '}and{' '}
            <Text className="text-foreground-muted underline">Privacy Policy</Text>
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}

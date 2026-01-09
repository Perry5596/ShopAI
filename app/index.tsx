import { View, Text, Image } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/ui/Button';

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();

  const handleGetStarted = () => {
    router.push('/(auth)/sign-in');
  };

  return (
    <View className="flex-1 bg-background">
      {/* Main Content - Centered */}
      <View className="flex-1 items-center justify-center px-8">
        {/* Logo */}
        <View className="w-24 h-24 bg-accent rounded-3xl items-center justify-center mb-6 shadow-lg">
          <Ionicons name="bag" size={48} color="#FFFFFF" />
        </View>

        {/* App Name */}
        <Text className="text-[36px] font-bold text-foreground mb-3">
          Shop AI
        </Text>

        {/* Tagline */}
        <Text className="text-[18px] text-foreground-muted text-center leading-relaxed">
          See something you like?{'\n'}Just snap and shop.
        </Text>
      </View>

      {/* Bottom Section */}
      <View
        className="px-6"
        style={{ paddingBottom: insets.bottom + 24 }}>
        {/* Get Started Button */}
        <Button
          title="Get Started"
          variant="primary"
          size="lg"
          fullWidth
          onPress={handleGetStarted}
        />

        {/* Terms */}
        <Text className="text-[12px] text-foreground-subtle text-center mt-4 px-4">
          By continuing, you agree to our Terms of Service and Privacy Policy
        </Text>
      </View>
    </View>
  );
}

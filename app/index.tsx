import { View, Text, Linking } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/ui/Button';

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();

  const handleAppleSignIn = () => {
    // TODO: Implement Apple Sign In
    router.replace('/(app)/home');
  };

  const handleGoogleSignIn = () => {
    // TODO: Implement Google Sign In
    router.replace('/(app)/home');
  };

  const handleTermsPress = () => {
    // TODO: Replace with actual terms URL
    Linking.openURL('https://example.com/terms');
  };

  const handlePrivacyPress = () => {
    // TODO: Replace with actual privacy URL
    Linking.openURL('https://example.com/privacy');
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

      {/* Bottom Section - Sign In Buttons */}
      <View
        className="px-6"
        style={{ paddingBottom: insets.bottom + 24 }}>
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

        {/* Terms & Privacy */}
        <Text className="text-[12px] text-foreground-subtle text-center mt-6 px-4">
          By signing in, you agree to our{' '}
          <Text 
            className="text-foreground-muted underline"
            onPress={handleTermsPress}>
            Terms of Service
          </Text>
          {' '}and{' '}
          <Text 
            className="text-foreground-muted underline"
            onPress={handlePrivacyPress}>
            Privacy Policy
          </Text>
        </Text>
      </View>
    </View>
  );
}

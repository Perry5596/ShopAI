import { useEffect } from 'react';
import { View, Text, Linking, Alert, ActivityIndicator, Platform } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';
import * as Haptics from 'expo-haptics';

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const { signInWithGoogle, signInWithApple, isAuthenticated, isLoading } = useAuth();

  // Redirect to home if already authenticated
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      router.replace('/(app)/home');
    }
  }, [isAuthenticated, isLoading]);

  const handleAppleSignIn = async () => {
    try {
      await signInWithApple();
    } catch (error: any) {
      // Don't show error for user cancellation
      if (error?.code === 'ERR_REQUEST_CANCELED') {
        return;
      }
      console.error('Apple sign in error:', error);
      Alert.alert(
        'Sign In Error',
        error?.message || 'Failed to sign in with Apple. Please try again.'
      );
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch (error: any) {
      console.error('Google sign in error:', error);
      Alert.alert(
        'Sign In Error',
        error?.message || 'Failed to sign in with Google. Please try again.'
      );
    }
  };

  const handleTermsPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // TODO: Replace with actual terms URL
    Linking.openURL('https://example.com/terms');
  };

  const handlePrivacyPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // TODO: Replace with actual privacy URL
    Linking.openURL('https://example.com/privacy');
  };

  // Show loading if checking auth or signing in
  if (isLoading) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color="#000000" />
      </View>
    );
  }

  // Don't render welcome if already authenticated
  if (isAuthenticated) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color="#000000" />
      </View>
    );
  }

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
        {/* Apple Sign In - iOS only */}
        {Platform.OS === 'ios' && (
          <Button
            title="Continue with Apple"
            variant="primary"
            size="lg"
            icon="logo-apple"
            fullWidth
            onPress={handleAppleSignIn}
            className="mb-3"
          />
        )}

        {/* Google Sign In */}
        <Button
          title="Continue with Google"
          variant={Platform.OS === 'ios' ? 'outline' : 'primary'}
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

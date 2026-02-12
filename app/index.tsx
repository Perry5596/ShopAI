import { useEffect } from 'react';
import { View, Text, Linking, Alert, ActivityIndicator, Platform, Image } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';
import * as Haptics from 'expo-haptics';

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const { signInWithGoogle, signInWithApple, continueAsGuest, isAuthenticated, isGuest, isLoading, profile } = useAuth();
  const { showSignIn } = useLocalSearchParams<{ showSignIn?: string }>();

  // If showSignIn is true, a guest is explicitly trying to sign in - don't auto-redirect
  // But if they successfully authenticate, we should redirect them
  const isExplicitSignIn = showSignIn === 'true';
  const shouldSkipRedirect = isExplicitSignIn && isGuest && !isAuthenticated;

  // Redirect to home (or onboarding) if already authenticated or guest
  // Authenticated users who haven't completed onboarding go to onboarding first
  // Guests skip onboarding entirely
  //
  // IMPORTANT: For authenticated users we must wait until the DB profile has loaded
  // before deciding. The metadata-only profile (set immediately on sign-in) won't
  // have `onboardingCompleted` defined, so we use `undefined` as the signal that
  // the DB profile hasn't arrived yet. Only `false` (explicitly from the DB) means
  // the user truly hasn't completed onboarding.
  const profileReady = !isAuthenticated || (profile && profile.onboardingCompleted !== undefined);

  useEffect(() => {
    if ((isAuthenticated || isGuest) && !isLoading && !shouldSkipRedirect && profileReady) {
      const timeoutId = setTimeout(() => {
        // Authenticated users who haven't completed onboarding go to onboarding
        if (isAuthenticated && profile && profile.onboardingCompleted === false) {
          router.replace('/(app)/onboarding');
        } else {
          router.replace('/(app)/home');
        }
      }, 0);
      return () => clearTimeout(timeoutId);
    }
  }, [isAuthenticated, isGuest, isLoading, shouldSkipRedirect, profileReady, profile]);

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

  const handleContinueAsGuest = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      // If already a guest and explicitly showing sign-in, just go back
      if (isGuest && isExplicitSignIn) {
        router.back();
        return;
      }
      
      await continueAsGuest();
      // Navigation is handled by the useEffect when isGuest becomes true
      // Don't navigate here to avoid race conditions
    } catch (error: any) {
      console.error('Continue as guest error:', error);
      Alert.alert(
        'Error',
        error?.message || 'Failed to continue as guest. Please try again.'
      );
    }
  };

  const handleTermsPress = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const url = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
    } else {
      Alert.alert('Error', 'Unable to open the Terms and Conditions page.');
    }
  };

  const handlePrivacyPress = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const url = 'https://luminasoftware.app/privacy';
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
    } else {
      Alert.alert('Error', 'Unable to open the Privacy Policy page.');
    }
  };

  // Show loading if checking auth or signing in
  if (isLoading) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color="#000000" />
      </View>
    );
  }

  // Don't render welcome if already authenticated or guest (unless a guest is explicitly viewing sign-in options)
  if ((isAuthenticated || isGuest) && !shouldSkipRedirect) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color="#000000" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      {/* Skip (Continue as Guest) - Top Right */}
      <View
        className="absolute z-10 right-4"
        style={{ top: insets.top + 8 }}>
        <Text
          className="text-[15px] text-foreground-muted font-inter-medium"
          onPress={handleContinueAsGuest}>
          Skip
        </Text>
      </View>

      {/* Main Content - Centered */}
      <View className="flex-1 items-center justify-center px-8">
        {/* Logo */}
        <View
          className="mb-6"
          style={{
            width: 96,
            height: 96,
            borderRadius: 24,
            overflow: 'hidden',
            // iOS shadow
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.15,
            shadowRadius: 8,
            // Android shadow
            elevation: 8,
          }}>
          <Image 
            source={require('@/assets/icon.png')} 
            style={{ 
              width: 96, 
              height: 96,
            }}
            resizeMode="cover"
          />
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
        className="px-4"
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
          className="mb-3"
        />

        {/* Terms & Privacy */}
        <Text className="text-[12px] text-foreground-subtle text-center mt-4 px-4">
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

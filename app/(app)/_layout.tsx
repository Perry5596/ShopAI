import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Stack, router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';

export default function AppLayout() {
  const { isAuthenticated, isGuest, isLoading } = useAuth();

  // User has access if authenticated OR is a guest
  const hasAccess = isAuthenticated || isGuest;

  useEffect(() => {
    // Redirect to welcome screen if not authenticated and not a guest
    if (!isLoading && !hasAccess) {
      // Defer navigation to avoid conflicts with React's render cycle
      const timeoutId = setTimeout(() => {
        router.replace('/');
      }, 0);
      return () => clearTimeout(timeoutId);
    }
  }, [hasAccess, isLoading]);

  // Show loading while checking auth state
  if (isLoading) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color="#000000" />
      </View>
    );
  }

  // Don't render app routes if no access
  if (!hasAccess) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color="#000000" />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#FFFFFF' },
        animation: 'fade',
        animationDuration: 150,
      }}>
      <Stack.Screen name="home" />
      <Stack.Screen name="analytics" />
      <Stack.Screen name="profile" />
      <Stack.Screen
        name="snap"
        options={{
          presentation: 'fullScreenModal',
          animation: 'slide_from_bottom',
        }}
      />
      <Stack.Screen name="guest-results" />
      <Stack.Screen name="shop/[id]" />
      <Stack.Screen name="fix-issue/[id]" />
    </Stack>
  );
}

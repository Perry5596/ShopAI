import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Stack, router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';

export default function AppLayout() {
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    // Redirect to welcome screen if not authenticated
    if (!isLoading && !isAuthenticated) {
      router.replace('/');
    }
  }, [isAuthenticated, isLoading]);

  // Show loading while checking auth state
  if (isLoading) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color="#000000" />
      </View>
    );
  }

  // Don't render app routes if not authenticated
  if (!isAuthenticated) {
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
        animation: 'slide_from_right',
      }}>
      <Stack.Screen name="home" />
      <Stack.Screen name="profile" />
      <Stack.Screen
        name="snap"
        options={{
          presentation: 'fullScreenModal',
          animation: 'slide_from_bottom',
        }}
      />
      <Stack.Screen name="shop/[id]" />
      <Stack.Screen name="fix-issue/[id]" />
    </Stack>
  );
}

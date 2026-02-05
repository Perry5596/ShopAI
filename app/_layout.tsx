import '../global.css';

import { useCallback, useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFonts, Inter_300Light, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { updateLastActivity } from '@/utils/notifications';

// Prevent splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

/**
 * Component that tracks app activity and updates last_activity_at
 * when the app comes to the foreground
 */
function ActivityTracker() {
  const { user, isAuthenticated } = useAuth();
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;

    // Update activity when component mounts (app opens)
    updateLastActivity(user.id);

    // Listen for app state changes
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      // App came to foreground from background
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        console.log('App came to foreground, updating last activity');
        updateLastActivity(user.id);
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [isAuthenticated, user?.id]);

  // This component doesn't render anything
  return null;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_300Light,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  // Add timeout to ensure splash screen hides even if fonts fail
  useEffect(() => {
    const timeout = setTimeout(async () => {
      try {
        await SplashScreen.hideAsync();
      } catch (e) {
        // Ignore errors - splash screen may already be hidden
      }
    }, 3000); // 3 second timeout

    return () => clearTimeout(timeout);
  }, []);

  const onLayoutRootView = useCallback(async () => {
    // Hide splash screen once fonts are loaded (or if there was an error)
    if (fontsLoaded || fontError) {
      try {
        await SplashScreen.hideAsync();
      } catch (e) {
        // Ignore errors - splash screen may already be hidden
      }
    }
  }, [fontsLoaded, fontError]);

  // Don't block rendering - proceed even if fonts fail
  // The app will use system fonts as fallback
  return (
    <GestureHandlerRootView style={{ flex: 1 }} onLayout={onLayoutRootView}>
      <AuthProvider>
        <ActivityTracker />
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: '#FFFFFF' },
          }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(app)" />
        </Stack>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

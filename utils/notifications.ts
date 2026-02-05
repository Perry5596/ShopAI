import { Platform, Linking, Alert } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { profileService } from './supabase-service';

// Configure how notifications are handled when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Check if the device can receive push notifications
 * Push notifications only work on physical devices, not simulators/emulators or web
 */
export function canReceivePushNotifications(): boolean {
  // Web doesn't support Expo push notifications
  if (Platform.OS === 'web') return false;
  
  // Check if we're running on a physical device vs simulator
  // In Expo Go or dev client, this will be set
  const isDevice = Constants.appOwnership !== 'expo' || Constants.isDevice;
  return isDevice !== false;
}

/**
 * Get the current notification permission status
 */
export async function getNotificationPermissionStatus(): Promise<Notifications.PermissionStatus> {
  const { status } = await Notifications.getPermissionsAsync();
  return status;
}

/**
 * Check if notification permissions have been granted
 */
export async function hasNotificationPermission(): Promise<boolean> {
  const status = await getNotificationPermissionStatus();
  return status === 'granted';
}

/**
 * Request notification permissions from the user
 * @returns true if permissions were granted, false otherwise
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  if (!canReceivePushNotifications()) {
    console.log('Push notifications are not available on this device');
    return false;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  
  if (existingStatus === 'granted') {
    return true;
  }

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

/**
 * Get the Expo push token for this device
 * @returns The push token string, or null if unavailable
 */
export async function getExpoPushToken(): Promise<string | null> {
  if (!canReceivePushNotifications()) {
    console.log('Push notifications are not available on this device');
    return null;
  }

  try {
    // Get the project ID from Constants
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    
    if (!projectId) {
      console.error('EAS project ID not found in app config');
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId,
    });

    return tokenData.data;
  } catch (error) {
    console.error('Failed to get Expo push token:', error);
    return null;
  }
}

/**
 * Register for push notifications and store the token in Supabase
 * Call this after the user grants permission and signs in
 * @param userId - The authenticated user's ID
 * @returns true if registration was successful, false otherwise
 */
export async function registerForPushNotifications(userId: string): Promise<boolean> {
  try {
    const hasPermission = await hasNotificationPermission();
    
    if (!hasPermission) {
      console.log('Notification permissions not granted');
      return false;
    }

    const pushToken = await getExpoPushToken();
    
    if (!pushToken) {
      console.log('Could not get push token');
      return false;
    }

    // Store the token in Supabase
    await profileService.updatePushToken(userId, pushToken);
    console.log('Push token registered successfully:', pushToken.substring(0, 20) + '...');
    
    return true;
  } catch (error) {
    console.error('Failed to register for push notifications:', error);
    return false;
  }
}

/**
 * Unregister push notifications by removing the token from Supabase
 * Call this when the user disables notifications or signs out
 * @param userId - The authenticated user's ID
 */
export async function unregisterPushNotifications(userId: string): Promise<void> {
  try {
    await profileService.updatePushToken(userId, null);
    console.log('Push token unregistered successfully');
  } catch (error) {
    console.error('Failed to unregister push notifications:', error);
  }
}

/**
 * Update the last activity timestamp for a user
 * Call this when the app becomes active
 * @param userId - The authenticated user's ID
 */
export async function updateLastActivity(userId: string): Promise<void> {
  try {
    await profileService.updateLastActivity(userId);
  } catch (error) {
    // Silently fail - activity tracking should not break the app
    console.error('Failed to update last activity:', error);
  }
}

/**
 * Show an alert prompting the user to enable notifications in Settings
 * Used when the user tries to enable notifications but has previously denied permission
 */
export function showNotificationSettingsAlert(): void {
  Alert.alert(
    'Notifications Disabled',
    'To receive notifications, please enable them in your device settings.',
    [
      {
        text: 'Cancel',
        style: 'cancel',
      },
      {
        text: 'Open Settings',
        onPress: () => {
          Linking.openSettings();
        },
      },
    ]
  );
}

/**
 * Handle enabling notifications from the profile settings
 * This will request permissions if not granted, and show a settings alert if denied
 * @param userId - The authenticated user's ID
 * @returns true if notifications were enabled successfully
 */
export async function handleEnableNotifications(userId: string): Promise<boolean> {
  if (!canReceivePushNotifications()) {
    Alert.alert(
      'Not Available',
      'Push notifications are not available on this device.'
    );
    return false;
  }

  // Check current permission status
  const { status } = await Notifications.getPermissionsAsync();

  if (status === 'granted') {
    // Already have permission, just register the token
    const success = await registerForPushNotifications(userId);
    if (success) {
      await profileService.updateNotificationsEnabled(userId, true);
    }
    return success;
  }

  if (status === 'denied') {
    // Permission was previously denied, need to go to settings
    showNotificationSettingsAlert();
    return false;
  }

  // Permission not determined yet, request it
  const granted = await requestNotificationPermissions();

  if (granted) {
    const success = await registerForPushNotifications(userId);
    if (success) {
      await profileService.updateNotificationsEnabled(userId, true);
    }
    return success;
  }

  return false;
}

/**
 * Handle disabling notifications from the profile settings
 * @param userId - The authenticated user's ID
 */
export async function handleDisableNotifications(userId: string): Promise<void> {
  try {
    await profileService.updateNotificationsEnabled(userId, false);
    // Optionally remove the push token to stop receiving notifications
    // await unregisterPushNotifications(userId);
  } catch (error) {
    console.error('Failed to disable notifications:', error);
    throw error;
  }
}

/**
 * Set up notification listeners for when the app is running
 * Call this once when the app starts
 * @returns Cleanup function to remove listeners
 */
export function setupNotificationListeners(
  onNotificationReceived?: (notification: Notifications.Notification) => void,
  onNotificationResponse?: (response: Notifications.NotificationResponse) => void
): () => void {
  // Listener for when a notification is received while the app is foregrounded
  const receivedSubscription = Notifications.addNotificationReceivedListener(
    (notification) => {
      console.log('Notification received:', notification);
      onNotificationReceived?.(notification);
    }
  );

  // Listener for when the user taps on a notification
  const responseSubscription = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      console.log('Notification tapped:', response);
      onNotificationResponse?.(response);
    }
  );

  // Return cleanup function
  return () => {
    receivedSubscription.remove();
    responseSubscription.remove();
  };
}

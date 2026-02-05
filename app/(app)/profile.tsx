import { View, Text, ScrollView, Alert, Linking, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { IconButton } from '@/components/ui/IconButton';
import { ProfileCard, SettingsSection, RatingModal } from '@/components/profile';
import { useAuth } from '@/contexts/AuthContext';
import { useState } from 'react';
import type { SettingsSection as SettingsSectionType } from '@/types';
import { clearAllLocalData } from '@/utils/dev-tools';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { profile, signOut, deleteAccount, refreshProfile, user, isGuest, isAuthenticated } = useAuth();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRatingModalVisible, setIsRatingModalVisible] = useState(false);

  const handleSignIn = () => {
    // Pass showSignIn param to prevent auto-redirect back to home
    router.push('/?showSignIn=true');
  };

  const handleEditProfile = () => {
    router.push('/(app)/edit-profile');
  };

  const handleLanguage = () => {
    Alert.alert('Coming Soon', 'Language selection will be available soon!');
  };

  const handlePreferences = () => {
    router.push('/(app)/preferences');
  };

  const handleSavedItems = () => {
    router.push('/(app)/saved-items');
  };

  const handleTerms = async () => {
    const url = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
    } else {
      Alert.alert('Error', 'Unable to open the Terms and Conditions page.');
    }
  };

  const handlePrivacy = async () => {
    const url = 'https://luminasoftware.app/privacy';
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
    } else {
      Alert.alert('Error', 'Unable to open the Privacy Policy page.');
    }
  };

  const handleSyncData = async () => {
    try {
      await refreshProfile();
      Alert.alert('Success', 'Your data has been synced.');
    } catch (error) {
      console.error('Sync error:', error);
      Alert.alert('Error', 'Failed to sync data. Please try again.');
    }
  };

  const handleRequestFeature = async () => {
    const email = profile?.email || user?.email || 'user@example.com';
    const name = profile?.name || 'User';
    const subject = encodeURIComponent('Feature Request - Shop AI');
    const body = encodeURIComponent(
      `Hi Shop AI Team,\n\nI would like to request the following feature:\n\n[Please describe your feature request here]\n\n---\nUser Information:\nName: ${name}\nEmail: ${email}\nUser ID: ${user?.id || 'N/A'}\n\nThank you!`
    );
    const mailtoUrl = `mailto:support@luminasoftware.app?subject=${subject}&body=${body}`;
    
    const canOpen = await Linking.canOpenURL(mailtoUrl);
    if (canOpen) {
      await Linking.openURL(mailtoUrl);
    } else {
      Alert.alert('Error', 'Unable to open email client. Please contact support@luminasoftware.app directly.');
    }
  };

  const handleSupport = async () => {
    const url = 'https://shopai.luminasoftware.app/support';
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
    } else {
      Alert.alert('Error', 'Unable to open the support page.');
    }
  };

  const handleTikTok = async () => {
    const url = 'https://www.tiktok.com/@shopai.app';
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
    } else {
      Alert.alert('Error', 'Unable to open TikTok. Please make sure the TikTok app is installed.');
    }
  };

  const handleInstagram = async () => {
    const url = 'https://www.instagram.com/shopai.app';
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
    } else {
      Alert.alert('Error', 'Unable to open Instagram. Please make sure the Instagram app is installed.');
    }
  };

  const handleFacebook = async () => {
    const url = 'https://www.facebook.com/profile.php?id=61587340048121';
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
    } else {
      Alert.alert('Error', 'Unable to open Facebook. Please make sure the Facebook app is installed.');
    }
  };

  const handleRateUs = () => {
    setIsRatingModalVisible(true);
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut();
              router.replace('/');
            } catch (error) {
              console.error('Logout error:', error);
              Alert.alert('Error', 'Failed to logout. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This will permanently delete all your data including shops, products, and saved items. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            // Second confirmation for extra safety
            Alert.alert(
              'Final Confirmation',
              'Type DELETE to confirm account deletion.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Confirm Delete',
                  style: 'destructive',
                  onPress: async () => {
                    setIsDeleting(true);
                    try {
                      await deleteAccount();
                      router.replace('/');
                    } catch (error) {
                      console.error('Delete account error:', error);
                      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                      Alert.alert(
                        'Error',
                        `Failed to delete account: ${errorMessage}`
                      );
                    } finally {
                      setIsDeleting(false);
                    }
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  const handleClearCache = () => {
    Alert.alert(
      'Clear Cache',
      'This will wipe all locally stored data including authentication sessions, anonymous tokens, and cached app state. You will need to sign in again. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Cache',
          style: 'destructive',
          onPress: async () => {
            try {
              await clearAllLocalData();
              Alert.alert(
                'Success',
                'All local data has been cleared. The app will restart.',
                [
                  {
                    text: 'OK',
                    onPress: () => {
                      // Navigate to home screen (which will handle auth state)
                      router.replace('/');
                    },
                  },
                ]
              );
            } catch (error) {
              console.error('Clear cache error:', error);
              const errorMessage = error instanceof Error ? error.message : 'Unknown error';
              Alert.alert('Error', `Failed to clear cache: ${errorMessage}`);
            }
          },
        },
      ]
    );
  };

  // Generate username from email or use profile username
  const username = profile?.username || profile?.email?.split('@')[0] || 'user';

  // Get app version and current year
  const appVersion = Constants.expoConfig?.version || '1.0.0';
  const currentYear = new Date().getFullYear();

  const allSettingsSections: SettingsSectionType[] = [
    {
      title: 'Account',
      items: [
        {
          id: 'preferences',
          icon: 'settings-outline',
          title: 'Preferences',
          onPress: handlePreferences,
        },
        {
          id: 'saved-items',
          icon: 'bookmark-outline',
          title: 'Saved Items',
          onPress: handleSavedItems,
        },
        {
          id: 'language',
          icon: 'language-outline',
          title: 'Language',
          subtitle: 'English',
          onPress: handleLanguage,
        },
      ],
    },
    {
      title: 'Support & Legal',
      items: [
        {
          id: 'rate-us',
          icon: 'star-outline',
          title: 'Rate Us',
          onPress: handleRateUs,
        },
        {
          id: 'request-feature',
          icon: 'bulb-outline',
          title: 'Request a Feature',
          onPress: handleRequestFeature,
        },
        {
          id: 'support',
          icon: 'help-circle-outline',
          title: 'Support',
          onPress: handleSupport,
        },
        {
          id: 'terms',
          icon: 'document-text-outline',
          title: 'Terms and Conditions',
          onPress: handleTerms,
        },
        {
          id: 'privacy',
          icon: 'shield-checkmark-outline',
          title: 'Privacy Policy',
          onPress: handlePrivacy,
        },
      ],
    },
    {
      title: 'Follow Us',
      items: [
        {
          id: 'instagram',
          icon: 'logo-instagram',
          title: 'Instagram',
          onPress: handleInstagram,
        },
        {
          id: 'tiktok',
          icon: 'logo-tiktok',
          title: 'TikTok',
          onPress: handleTikTok,
        },
        {
          id: 'facebook',
          icon: 'logo-facebook',
          title: 'Facebook',
          onPress: handleFacebook,
        },
      ],
    },
    {
      title: 'Account Actions',
      items: [
        {
          id: 'sync-data',
          icon: 'sync-outline',
          title: 'Sync Data',
          onPress: handleSyncData,
        },
        {
          id: 'logout',
          icon: 'log-out-outline',
          title: 'Logout',
          onPress: handleLogout,
        },
        {
          id: 'delete-account',
          icon: 'trash-outline',
          title: isDeleting ? 'Deleting Account...' : 'Delete Account',
          isDestructive: true,
          onPress: isDeleting ? undefined : handleDeleteAccount,
        },
      ],
    },
  ];

  // Filter out Account Actions section for guests
  const settingsSections = isGuest
    ? allSettingsSections.filter(section => section.title !== 'Account Actions')
    : allSettingsSections;

  // Dev Tools section (only visible in dev mode)
  const devToolsSection: SettingsSectionType | null = __DEV__
    ? {
        title: 'Developer Tools',
        items: [
          {
            id: 'clear-cache',
            icon: 'trash-outline',
            title: 'Clear Cache',
            subtitle: 'Wipe all locally stored data',
            isDestructive: true,
            onPress: handleClearCache,
          },
        ],
      }
    : null;

  return (
    <View className="flex-1 bg-background-secondary">
      {/* Header */}
      <View
        className="bg-background-secondary"
        style={{ paddingTop: insets.top + 8 }}>
        <View className="flex-row items-center px-5 mb-4">
          <IconButton
            icon="chevron-back"
            variant="ghost"
            size="md"
            onPress={() => router.back()}
          />
          <Text className="text-[22px] font-inter-bold text-foreground ml-2">Profile</Text>
        </View>
      </View>

      {/* Settings Sections */}
      <ScrollView
        className="flex-1 px-5"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        {/* Profile Card or Sign In Button for guests */}
        {isGuest ? (
          <TouchableOpacity
            onPress={handleSignIn}
            activeOpacity={0.7}
            className="bg-card rounded-2xl p-4 flex-row items-center"
            style={{
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.06,
              shadowRadius: 4,
              elevation: 2,
            }}>
            <View className="w-14 h-14 rounded-full items-center justify-center bg-foreground">
              <Ionicons name="person-add" size={24} color="#FFFFFF" />
            </View>
            <View className="flex-1 ml-4">
              <Text className="text-[18px] font-inter-semibold text-foreground">Sign In</Text>
              <Text className="text-[14px] font-inter-medium text-foreground-muted">
                Create an account to save your scans
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#9CA3AF" />
          </TouchableOpacity>
        ) : (
          <ProfileCard
            name={profile?.name || 'User'}
            username={username}
            avatarUrl={profile?.avatarUrl}
            isPremium={profile?.isPremium || false}
            onPress={handleEditProfile}
          />
        )}
        
        <View className="h-6" />

        {settingsSections.map((section) => (
          <SettingsSection
            key={section.title}
            title={section.title}
            items={section.items}
          />
        ))}

        {/* Dev Tools Section (only visible in dev mode) */}
        {devToolsSection && (
          <SettingsSection
            key={devToolsSection.title}
            title={devToolsSection.title}
            items={devToolsSection.items}
          />
        )}

        {/* Copyright and Version Info */}
        <View className="items-center py-6 mt-4">
          <Text className="text-[11px] font-inter-medium text-foreground-subtle text-center">
            © {currentYear} Lumina Software LLC
          </Text>
          <Text className="text-[11px] font-inter-medium text-foreground-subtle text-center mt-1">
            Version {appVersion}
          </Text>
        </View>
      </ScrollView>

      {/* Rating Modal */}
      <RatingModal
        isVisible={isRatingModalVisible}
        onClose={() => setIsRatingModalVisible(false)}
        userEmail={profile?.email || user?.email}
        userName={profile?.name || 'User'}
      />
    </View>
  );
}

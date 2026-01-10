import { View, Text, ScrollView, Alert, Linking } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { IconButton } from '@/components/ui/IconButton';
import { ProfileCard, SettingsSection, RatingModal } from '@/components/profile';
import { useAuth } from '@/contexts/AuthContext';
import { useState } from 'react';
import type { SettingsSection as SettingsSectionType } from '@/types';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { profile, signOut, deleteAccount, refreshProfile, user } = useAuth();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRatingModalVisible, setIsRatingModalVisible] = useState(false);

  const handleEditProfile = () => {
    router.push('/(app)/edit-profile');
  };

  const handleShoppingPreferences = () => {
    Alert.alert('Coming Soon', 'Shopping preferences will be available soon!');
  };

  const handleLanguage = () => {
    Alert.alert('Coming Soon', 'Language selection will be available soon!');
  };

  const handlePreferences = () => {
    Alert.alert('Coming Soon', 'Preferences will be available soon!');
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

  const handleSupportEmail = async () => {
    const email = profile?.email || user?.email || 'user@example.com';
    const name = profile?.name || 'User';
    const subject = encodeURIComponent('Support Request - Shop AI');
    const body = encodeURIComponent(
      `Hi Shop AI Support,\n\nI need help with the following:\n\n[Please describe your issue or question here]\n\n---\nUser Information:\nName: ${name}\nEmail: ${email}\nUser ID: ${user?.id || 'N/A'}\n\nThank you!`
    );
    const mailtoUrl = `mailto:support@luminasoftware.app?subject=${subject}&body=${body}`;
    
    const canOpen = await Linking.canOpenURL(mailtoUrl);
    if (canOpen) {
      await Linking.openURL(mailtoUrl);
    } else {
      Alert.alert('Error', 'Unable to open email client. Please contact support@luminasoftware.app directly.');
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

  // Generate username from email or use profile username
  const username = profile?.username || profile?.email?.split('@')[0] || 'user';

  // Get app version and current year
  const appVersion = Constants.expoConfig?.version || '1.0.0';
  const currentYear = new Date().getFullYear();

  const settingsSections: SettingsSectionType[] = [
    {
      title: 'Account',
      items: [
        {
          id: 'preferences',
          icon: 'settings-outline',
          title: 'Preferences',
          subtitle: 'Coming Soon',
          onPress: handlePreferences,
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
      title: 'Shopping',
      items: [
        {
          id: 'saved-items',
          icon: 'bookmark-outline',
          title: 'Saved Items',
          onPress: handleSavedItems,
        },
        {
          id: 'shopping-preferences',
          icon: 'bag-outline',
          title: 'Shopping Preferences',
          onPress: handleShoppingPreferences,
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
          id: 'support-email',
          icon: 'mail-outline',
          title: 'Support Email',
          onPress: handleSupportEmail,
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
          onPress: () => Alert.alert('Instagram'),
        },
        {
          id: 'tiktok',
          icon: 'logo-tiktok',
          title: 'TikTok',
          onPress: () => Alert.alert('TikTok'),
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
        {/* Profile Card - Now in its own section */}
        <ProfileCard
          name={profile?.name || 'User'}
          username={username}
          avatarUrl={profile?.avatarUrl}
          isPremium={profile?.isPremium || false}
          onPress={handleEditProfile}
        />
        
        <View className="h-6" />

        {settingsSections.map((section) => (
          <SettingsSection
            key={section.title}
            title={section.title}
            items={section.items}
          />
        ))}

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
